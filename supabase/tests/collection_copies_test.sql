-- Who hears that their list was copied: the owner of a public original,
-- about copies made by others, minus anyone they have blocked.
--
-- Run as `rls_client` with `test.uid`; the function is a definer, so the
-- thing under test is its own where-clause, exercised, not read.
--
--   c1000000-…-0001  the curator, owns a public list and a private one
--   c1000000-…-0002  a reader who copied both
--   c1000000-…-0003  a reader the curator has blocked, who copied the public one
grant usage on schema public to rls_client;
-- Profiles come from the auth trigger, as they do in production.
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-0000-0000-000000000001', 'cur@cc.test', '{"handle":"curator","full_name":"Cu Rator"}'),
  ('c1000000-0000-0000-0000-000000000002', 'rdr@cc.test', '{"handle":"reader","full_name":"Rea Der"}'),
  ('c1000000-0000-0000-0000-000000000003', 'blk@cc.test', '{"handle":"blocked","full_name":"Blo Cked"}');
insert into public.collections (id, slug, city_id, owner_id) values
  ('c1000000-0000-0000-0000-0000000000a1', 'cc-public', 'hanoi', 'c1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-0000000000a2', 'cc-private', 'hanoi', 'c1000000-0000-0000-0000-000000000001');
-- Born private, published by an update — see the publish migration's
-- insert trigger. Only the first goes public.
update public.collections set is_public = true where id = 'c1000000-0000-0000-0000-0000000000a1';
-- The copies. The reader's two, one of each original; the blocked
-- reader's one, public; and the curator's own copy of their own list,
-- which is not news to them.
insert into public.collections (slug, city_id, owner_id, copied_from, created_at) values
  ('cc-copy-pub', 'hanoi', 'c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-0000000000a1', now() - interval '2 hours'),
  ('cc-copy-priv', 'hanoi', 'c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-0000000000a2', now() - interval '1 hour'),
  ('cc-copy-blk', 'hanoi', 'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-0000000000a1', now() - interval '30 minutes'),
  ('cc-copy-own', 'hanoi', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000a1', now() - interval '10 minutes');

-- ── before any block: the public original's copies by others, named ──
do $$
declare n int; who text; oldest int;
begin
  set local role rls_client;
  set local test.uid = 'c1000000-0000-0000-0000-000000000001';
  select count(*), min(copier_handle) into n, who from public.copies_of_mine(now() - interval '1 day');
  select count(*) into oldest from public.copies_of_mine(now() - interval '1 hour');
  reset role;
  assert n = 2, format('expected the two copies by others of the public list, saw %s', n);
  assert who in ('blocked', 'reader'), format('the copier is named by handle, saw %L', who);
  assert oldest = 1, format('since should cut the older copy, saw %s', oldest);
end $$;

-- ── a private original says nothing, even to its owner ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'c1000000-0000-0000-0000-000000000001';
  select count(*) into n from public.copies_of_mine(now() - interval '1 day') where collection_id = 'c1000000-0000-0000-0000-0000000000a2';
  reset role;
  assert n = 0, 'a copy of a private list was reported';
end $$;

-- ── somebody else asking hears nothing about lists that are not theirs ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'c1000000-0000-0000-0000-000000000002';
  select count(*) into n from public.copies_of_mine(now() - interval '1 day');
  reset role;
  assert n = 0, format('a non-owner was told about copies, saw %s', n);
end $$;

-- ── a block takes the blocked reader's copy off the feed ──
insert into public.blocks (blocker, blocked) values
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003')
on conflict do nothing;
do $$
declare n int; who text;
begin
  set local role rls_client;
  set local test.uid = 'c1000000-0000-0000-0000-000000000001';
  select count(*), min(copier_handle) into n, who from public.copies_of_mine(now() - interval '1 day');
  reset role;
  assert n = 1 and who = 'reader', format('after the block expected the reader alone, saw %s / %L', n, who);
end $$;

-- ── deleting the original leaves the copy standing, unlinked ──
do $$
declare still int; linked uuid;
begin
  delete from public.collections where slug = 'cc-public';
  select count(*) into still from public.collections where slug = 'cc-copy-pub';
  select copied_from into linked from public.collections where slug = 'cc-copy-pub';
  assert still = 1, 'deleting the original deleted the copy';
  assert linked is null, 'the copy still points at a list that is gone';
end $$;

-- ── closed to the signed-out ──
do $$
begin
  assert not has_function_privilege('anon', 'public.copies_of_mine(timestamptz)', 'execute'), 'copies_of_mine is open to anon';
  assert has_function_privilege('authenticated', 'public.copies_of_mine(timestamptz)', 'execute'), 'copies_of_mine is closed to readers';
end $$;

delete from public.blocks where blocker = 'c1000000-0000-0000-0000-000000000001';
delete from public.collections where slug like 'cc-%';
delete from auth.users where id in ('c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003');

select 'all collection copies checks passed' as result;
