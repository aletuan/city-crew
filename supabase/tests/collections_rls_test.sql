-- A person's lists, as the database enforces them: made only as your own
-- and only private, read by you until you publish, filled and emptied by
-- you alone, and by an editor.
--
-- Exercised as `rls_client` — the position PostgREST puts a signed-in
-- reader in — as three accounts in turn: the owner (1111…), another
-- person (2222…), and a stranger who is nobody to anybody (3333…). The
-- static checks in `publish_test.sql` stay; this is the half they could
-- not do.

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.collections, public.collection_places to rls_client;
grant select on public.places to rls_client;

insert into public.places (slug, city_id, is_published, review_status, categories)
values ('rls-cafe', 'hanoi', true, 'approved', '{cafes}')
on conflict (slug) do nothing;

-- ── making one ───────────────────────────────────────────────────────
do $$
declare refused_owner bool := false; refused_public bool := false;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.collections (slug, city_id, owner_id, is_public)
  values ('rls-mine', 'hanoi', '11111111-1111-1111-1111-111111111111', false);
  begin
    insert into public.collections (slug, city_id, owner_id, is_public)
    values ('rls-forged', 'hanoi', '22222222-2222-2222-2222-222222222222', false);
  exception when insufficient_privilege then refused_owner := true;
  end;
  begin
    insert into public.collections (slug, city_id, owner_id, is_public)
    values ('rls-born-public', 'hanoi', '11111111-1111-1111-1111-111111111111', true);
  exception when insufficient_privilege then refused_public := true;
  end;
  reset role;
  assert refused_owner, 'a client made a list owned by somebody else';
  assert refused_public, 'a list was born public; publishing is a separate act';
end $$;

-- ── who sees a private list ──────────────────────────────────────────
do $$
declare mine int; theirs int; nobody int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select count(*) into mine from public.collections where slug = 'rls-mine';
  reset role;
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select count(*) into theirs from public.collections where slug = 'rls-mine';
  reset role;
  set local role rls_client;
  set local test.uid = '';
  select count(*) into nobody from public.collections where slug = 'rls-mine';
  reset role;
  assert mine = 1, 'the owner cannot see their own private list';
  assert theirs = 0, 'another person can see a private list';
  assert nobody = 0, 'a signed-out reader can see a private list';
end $$;

-- ── filling it ───────────────────────────────────────────────────────
do $$
declare cid uuid; pid uuid; refused bool := false; theirs int;
begin
  select id into cid from public.collections where slug = 'rls-mine';
  select id into pid from public.places where slug = 'rls-cafe';

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.collection_places (collection_id, place_id, sort_order) values (cid, pid, 0);
  reset role;

  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  begin
    insert into public.collection_places (collection_id, place_id, sort_order) values (cid, pid, 1);
  exception when insufficient_privilege or unique_violation then refused := true;
  end;
  select count(*) into theirs from public.collection_places where collection_id = cid;
  reset role;

  assert refused, 'another person put a place into somebody else''s list';
  assert theirs = 0, 'another person can see the members of a private list';
end $$;

-- ── changing it ──────────────────────────────────────────────────────
do $$
declare mine int; theirs int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (update public.collections set city_id = 'hanoi' where slug = 'rls-mine' returning 1)
  select count(*) into mine from u;
  reset role;
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (update public.collections set city_id = 'hcmc' where slug = 'rls-mine' returning 1)
  select count(*) into theirs from u;
  reset role;
  assert mine = 1, 'the owner could not edit their own list';
  assert theirs = 0, 'another person edited somebody else''s list';
end $$;

-- ── publishing, and what that opens ──────────────────────────────────
-- The list holds one live place, so the gate lets it through; once
-- public, the stranger and the signed-out reader both see it and its
-- members — and still cannot touch it.
do $$
declare flipped int; stranger int; stranger_members int; anon_ int; deleted int; added bool := false;
declare cid uuid; pid uuid;
begin
  select id into cid from public.collections where slug = 'rls-mine';
  select id into pid from public.places where slug = 'rls-cafe';

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (update public.collections set is_public = true where slug = 'rls-mine' returning 1)
  select count(*) into flipped from u;
  reset role;

  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  select count(*) into stranger from public.collections where slug = 'rls-mine';
  select count(*) into stranger_members from public.collection_places where collection_id = cid;
  with d as (delete from public.collections where slug = 'rls-mine' returning 1)
  select count(*) into deleted from d;
  begin
    insert into public.collection_places (collection_id, place_id, sort_order) values (cid, pid, 9);
  exception when insufficient_privilege or unique_violation then added := true;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = '';
  select count(*) into anon_ from public.collections where slug = 'rls-mine';
  reset role;

  assert flipped = 1, 'the owner could not publish their list';
  assert stranger = 1, 'a published list is invisible to a stranger';
  assert stranger_members = 1, 'a published list''s members are invisible to a stranger';
  assert anon_ = 1, 'a published list is invisible signed out';
  assert deleted = 0, 'a stranger deleted a published list';
  assert added, 'a stranger added to a published list';
end $$;

-- ── the editor ───────────────────────────────────────────────────────
-- The desk's key: an account whose email is on the allow-list edits any
-- list. An email that is not on it is just another person.
do $$
declare by_editor int; by_other int;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  with u as (update public.collections set city_id = 'danang' where slug = 'rls-mine' returning 1)
  select count(*) into by_editor from u;
  reset role;

  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  set local test.jwt = '{"email": "nobody@example.com"}';
  with u as (update public.collections set city_id = 'hcmc' where slug = 'rls-mine' returning 1)
  select count(*) into by_other from u;
  reset role;

  assert by_editor = 1, 'an editor could not edit a user''s list';
  assert by_other = 0, 'an email off the allow-list edited somebody''s list';
end $$;

-- ── taking it down ───────────────────────────────────────────────────
do $$
declare gone int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with d as (delete from public.collections where slug = 'rls-mine' returning 1)
  select count(*) into gone from d;
  reset role;
  assert gone = 1, 'the owner could not delete their own list';
end $$;

delete from public.places where slug = 'rls-cafe';

select 'all collection RLS checks passed' as result;
