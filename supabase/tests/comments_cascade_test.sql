-- Comments after 20261118150000: deleting one takes its answers with it,
-- an account takes its comments and theirs, and a reader is shown
-- nothing by somebody blocked nor anything under it. No husks anywhere:
-- what a thread returns has no `gone`, and a body is never null.
--
--   ca…0a  the owner of one public list (c1)
--   ca…0b  a writer
--   ca…0c  a second writer
--   ca…0d  a third, whom c will block
--   ca…0e  the desk

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('ca5c0000-0000-0000-0000-00000000000a', 'cc-owner@x.com',  '{"handle":"ccowner"}'),
 ('ca5c0000-0000-0000-0000-00000000000b', 'cc-b@x.com',      '{"handle":"ccb"}'),
 ('ca5c0000-0000-0000-0000-00000000000c', 'cc-c@x.com',      '{"handle":"ccc"}'),
 ('ca5c0000-0000-0000-0000-00000000000d', 'cc-d@x.com',      '{"handle":"ccd"}'),
 ('ca5c0000-0000-0000-0000-00000000000e', 'desk@cc.test',    '{"handle":"ccdesk"}');
insert into public.editors (email) values ('desk@cc.test') on conflict do nothing;
insert into public.collections (id, slug, owner_id) values
 ('ca5c0000-0000-0000-0000-0000000000c1', 'cc-public', 'ca5c0000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'ca5c0000-0000-0000-0000-0000000000c1';

create function public._cc_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._cc_why(text) to rls_client, anon;

-- ── what the first rule left was cleared: the husk, and the answer under it ──
do $$
declare left_ text;
begin
  select string_agg(body, ',' order by body) into left_ from public.comments
   where collection_id = 'ca5e0000-0000-0000-0000-0000000000c1';
  assert left_ = 'stays', format('of the seeded thread there is left: %s', left_);
end $$;
delete from public.collections where id = 'ca5e0000-0000-0000-0000-0000000000c1';
delete from auth.users where email in ('cs-owner@x.com', 'cs-b@x.com');

-- ── the shape: nothing left of the husk ──
do $$
begin
  assert not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'comments' and column_name = 'deleted_at'),
    'comments still has deleted_at';
  assert (select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = 'comments' and column_name = 'body') = 'NO', 'a body may be null';
  assert (select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = 'comments' and column_name = 'author') = 'NO', 'an author may be null';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in ('comment_prune', 'comments_after_gone', 'comments_author_gone')),
    'a function that existed for husks is still here';
  assert not exists (select 1 from pg_trigger where tgrelid = 'public.comments'::regclass
                      and tgname in ('comments_after_gone', 'comments_author_gone')), 'a husk trigger is still here';
  -- What a thread returns has no `gone`.
  assert (select pg_get_function_result('public.comment_thread(uuid, text)'::regprocedure)) not like '%gone%',
    'comment_thread still returns gone';
  -- Open to a guest, as before: exactly the two reads.
  assert (select string_agg(p.proname, ', ' order by p.proname)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'comment%'
             and has_function_privilege('anon', p.oid, 'execute')) = 'comment_previews, comment_thread',
    'the comment functions open to a guest are not exactly the two reads';
  assert not has_function_privilege('authenticated', 'public.comments_seen(uuid[])', 'execute'),
    'a reader may call comments_seen';
end $$;

-- A thread, written straight in and dated by hand:
--
--   r1 (b) ─ x1 (c) ─ x2 (b) ─ x3 (d)
--          └ y1 (d)
--   r2 (d) ─ z1 (b)
--   r3 (c)
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('ca5c0000-0000-0000-0000-0000000000a1', 'ca5c0000-0000-0000-0000-00000000000b', 'ca5c0000-0000-0000-0000-0000000000c1', null, 'r1', '2026-11-01'),
 ('ca5c0000-0000-0000-0000-0000000000a2', 'ca5c0000-0000-0000-0000-00000000000d', 'ca5c0000-0000-0000-0000-0000000000c1', null, 'r2', '2026-11-02'),
 ('ca5c0000-0000-0000-0000-0000000000a3', 'ca5c0000-0000-0000-0000-00000000000c', 'ca5c0000-0000-0000-0000-0000000000c1', null, 'r3', '2026-11-03');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('ca5c0000-0000-0000-0000-0000000000b1', 'ca5c0000-0000-0000-0000-00000000000c', 'ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000a1', 'x1', '2026-11-04'),
 ('ca5c0000-0000-0000-0000-0000000000d1', 'ca5c0000-0000-0000-0000-00000000000d', 'ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000a1', 'y1', '2026-11-05'),
 ('ca5c0000-0000-0000-0000-0000000000e1', 'ca5c0000-0000-0000-0000-00000000000b', 'ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000a2', 'z1', '2026-11-06');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('ca5c0000-0000-0000-0000-0000000000b2', 'ca5c0000-0000-0000-0000-00000000000b', 'ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000b1', 'x2', '2026-11-07');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('ca5c0000-0000-0000-0000-0000000000b3', 'ca5c0000-0000-0000-0000-00000000000d', 'ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000b2', 'x3', '2026-11-08');

-- What a reader is shown, as the bodies in drawing order, and the card's count.
create function public._cc_reads(as_user text) returns text
language plpgsql set search_path = public as $$
declare seen text; n int;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select string_agg(t.body, ' ' order by t.ord) into seen
    from public.comment_thread('ca5c0000-0000-0000-0000-0000000000c1') with ordinality
      as t(id, parent_id, root_id, depth, body, created_at, author, handle, full_name, avatar_url, mentions, ord);
  select p.n into n from public.comment_previews(array['ca5c0000-0000-0000-0000-0000000000c1']::uuid[]) p;
  reset role;
  return coalesce(seen, '') || ' | ' || coalesce(n, 0);
end $$;

-- ── everybody, to somebody with no blocks — and to a guest ──
do $$
declare got text;
begin
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000a');
  assert got = 'r3 r2 z1 r1 x1 y1 x2 x3 | 8', format('the owner reads: %s', got);
  got := public._cc_reads('');
  assert got = 'r3 r2 z1 r1 x1 y1 x2 x3 | 8', format('a guest reads: %s', got);
end $$;

-- ── a list gone private shows nothing, and loses nothing ──
update public.collections set is_public = false where id = 'ca5c0000-0000-0000-0000-0000000000c1';
do $$
declare got text;
begin
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000a');
  assert got = ' | 0', format('a private list reads: %s', got);
  assert (select count(*) from public.comments where collection_id = 'ca5c0000-0000-0000-0000-0000000000c1') = 8,
    'a private list lost comments';
end $$;
update public.collections set is_public = true where id = 'ca5c0000-0000-0000-0000-0000000000c1';

-- ── a block hides the blocked writer's comments and what is under them, both ways ──
insert into public.blocks (blocker, blocked) values
 ('ca5c0000-0000-0000-0000-00000000000c', 'ca5c0000-0000-0000-0000-00000000000d');
do $$
declare got text;
begin
  -- c has blocked d: r2 goes with z1 under it; y1 and x3 go; the count is what is left.
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000c');
  assert got = 'r3 r1 x1 x2 | 4', format('the blocker reads: %s', got);
  -- d is blocked by c: r3 goes, and x1 with x2 and d's own x3 under it.
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000d');
  assert got = 'r2 z1 r1 y1 | 4', format('the blocked reads: %s', got);
  -- Nobody else is shown any less.
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000b');
  assert got = 'r3 r2 z1 r1 x1 y1 x2 x3 | 8', format('a third reader reads: %s', got);
end $$;

-- Neither answers the other, as before.
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000d';
  got := public._cc_why('select public.post_comment(''ca5c0000-0000-0000-0000-0000000000c1'', ''ca5c0000-0000-0000-0000-0000000000b1'', ''hello'')');
  reset role;
  assert got = 'comment:parent', format('answering one who blocked you: %s', got);
end $$;
delete from public.blocks where blocker = 'ca5c0000-0000-0000-0000-00000000000c';

-- ── a delete takes the answers with it ──
do $$
declare got text; refused text;
begin
  set local role rls_client;
  -- Not a stranger's to take.
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000d';
  refused := public._cc_why('select public.delete_comment(''ca5c0000-0000-0000-0000-0000000000b1'')');
  assert refused = 'comment:not_yours', format('a stranger deleting: %s', refused);
  -- c takes x1: x2 and x3 under it go, y1 beside it stays.
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000c';
  perform public.delete_comment('ca5c0000-0000-0000-0000-0000000000b1');
  perform public.delete_comment('ca5c0000-0000-0000-0000-0000000000b1');
  reset role;
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000a');
  assert got = 'r3 r2 z1 r1 y1 | 5', format('after an answered comment was deleted: %s', got);
  assert (select count(*) from public.comments where body is null) = 0, 'a husk was left';
end $$;

-- The owner of the list takes a root with an answer under it; the desk takes a leaf.
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000a';
  perform public.delete_comment('ca5c0000-0000-0000-0000-0000000000a2');
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email":"desk@cc.test"}';
  perform public.delete_comment('ca5c0000-0000-0000-0000-0000000000d1');
  reset role;
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000a');
  assert got = 'r3 r1 | 2', format('after the owner and the desk: %s', got);
end $$;

-- ── a deleted comment is not counted against the day ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000c';
  perform public.delete_comment(public.post_comment('ca5c0000-0000-0000-0000-0000000000c1', null, 'written and taken back'));
  n := public.own_comments_today();
  reset role;
  -- r3 is dated the 3rd of November: not today's.
  assert n = 0, format('counted %s of today''s after writing one and deleting it', n);
end $$;

-- ── an account goes: its comments go, and what was said under them ──
do $$
declare made uuid;
begin
  set local role rls_client;
  set local test.uid = 'ca5c0000-0000-0000-0000-00000000000c';
  made := public.post_comment('ca5c0000-0000-0000-0000-0000000000c1', 'ca5c0000-0000-0000-0000-0000000000a1', 'under b');
  reset role;
end $$;
delete from auth.users where id = 'ca5c0000-0000-0000-0000-00000000000b';
do $$
declare got text;
begin
  got := public._cc_reads('ca5c0000-0000-0000-0000-00000000000a');
  -- r1 was b's: it went, and c's answer under it.
  assert got = 'r3 | 1', format('after an account was deleted: %s', got);
  assert (select count(*) from public.comments) = 1, 'something of the deleted account is still stored';
end $$;

-- ── a list is deleted: its thread goes with it ──
delete from public.collections where id = 'ca5c0000-0000-0000-0000-0000000000c1';
do $$
begin
  assert (select count(*) from public.comments where collection_id = 'ca5c0000-0000-0000-0000-0000000000c1') = 0,
    'comments outlived their list';
end $$;

drop function public._cc_reads(text);
drop function public._cc_why(text);
delete from public.editors where email = 'desk@cc.test';
delete from auth.users where email in ('cc-owner@x.com', 'cc-c@x.com', 'cc-d@x.com', 'desk@cc.test');

select 'all comment cascade checks passed' as result;
