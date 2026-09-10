-- blocks, as a client sees them: a block is yours alone to make, to see
-- and to lift — the person blocked is never told, and cannot see or undo
-- it. And a block reaches past its own table: it ends the friendship,
-- stops a new request either way, drops the other person out of
-- suggestions, and takes their name off the applause on your lists.
--
-- Exercised, not read off pg_policy: `rls_client` as the blocker, the
-- blocked, and a signed-out caller.

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.blocks, public.friendships to rls_client;
grant select, insert, delete on public.collection_likes to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d2000000-0000-0000-0000-00000000000a', 'blocker@x.com', '{"handle":"blocker"}'),
 ('d2000000-0000-0000-0000-00000000000b', 'blocked@x.com', '{"handle":"blocked","full_name":"Blocked"}'),
 ('d2000000-0000-0000-0000-00000000000c', 'bystander@x.com', '{"handle":"bystander"}');

-- Two public lists sharing a place, so each owner is the other's
-- suggestion; a like on the blocker's list from the person about to be
-- blocked; and an accepted friendship between them.
-- A live place: a list holding an unpublished one falls back to private
-- (see `place_submissions`), and a private list suggests nobody.
insert into public.places (id, slug, is_published, review_status) values ('d2000000-0000-0000-0000-0000000000f1', 'blocks-shared-place', true, 'approved');
insert into public.collections (id, slug, owner_id) values
 ('d2000000-0000-0000-0000-0000000000c1', 'blocker-list', 'd2000000-0000-0000-0000-00000000000a'),
 ('d2000000-0000-0000-0000-0000000000c2', 'blocked-list', 'd2000000-0000-0000-0000-00000000000b');
-- Published by a second statement: a list is always born private (see the
-- publish migration's insert trigger), and only an update makes it public.
update public.collections set is_public = true
 where id in ('d2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-0000000000c2');
insert into public.collection_places (collection_id, place_id) values
 ('d2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-0000000000f1'),
 ('d2000000-0000-0000-0000-0000000000c2', 'd2000000-0000-0000-0000-0000000000f1');
insert into public.collection_likes (collection_id, user_id) values
 ('d2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-00000000000b');

-- ── before: the other person is suggested, and named on the applause ──
do $$
declare suggested int; named text;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  select count(*) into suggested from public.suggested_friends() where other = 'd2000000-0000-0000-0000-00000000000b';
  select liker_handle into named from public.likes_on_mine(now() - interval '1 hour') limit 1;
  reset role;
  assert suggested = 1, 'the fixture is wrong: the other curator is not suggested before any block';
  assert named = 'blocked', format('the fixture is wrong: the applause names %L', named);
end $$;

-- Now they are friends, which a block has to undo.
insert into public.friendships (requester, addressee, status) values
 ('d2000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000a', 'accepted');

-- ── making a block ───────────────────────────────────────────────────
-- In your own name only; never on yourself; not signed out.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  begin
    insert into public.blocks (blocker, blocked)
    values ('d2000000-0000-0000-0000-00000000000c', 'd2000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    perform public.block_user('d2000000-0000-0000-0000-00000000000a');
  exception when raise_exception then refused := refused + 1;
  end;
  begin
    perform public.block_user(null);
  exception when raise_exception then refused := refused + 1;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = '';
  begin
    insert into public.blocks (blocker, blocked)
    values ('d2000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege or not_null_violation then refused := refused + 1;
  end;
  reset role;
  assert refused = 4, format('%s of 4 improper blocks were refused', refused);
end $$;

-- `block_user` is what the app calls: the block, and the friendship gone
-- in the same breath.
do $$
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  perform public.block_user('d2000000-0000-0000-0000-00000000000b');
  -- Twice is harmless: a second tap on "Block" must not fail.
  perform public.block_user('d2000000-0000-0000-0000-00000000000b');
  reset role;
end $$;

do $$
declare blocks int; edges int;
begin
  select count(*) into blocks from public.blocks where blocker = 'd2000000-0000-0000-0000-00000000000a';
  select count(*) into edges from public.friendships
   where 'd2000000-0000-0000-0000-00000000000a' in (requester, addressee)
     and 'd2000000-0000-0000-0000-00000000000b' in (requester, addressee);
  assert blocks = 1, format('block_user left %s blocks', blocks);
  assert edges = 0, 'the friendship survived the block';
end $$;

-- ── seeing it ────────────────────────────────────────────────────────
-- The blocker sees their block. The person blocked is never told, and a
-- signed-out caller sees nothing.
do $$
declare by_blocker int; by_blocked int; by_nobody int;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  select count(*) into by_blocker from public.blocks;
  reset role;
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000b';
  select count(*) into by_blocked from public.blocks;
  reset role;
  set local role rls_client;
  set local test.uid = '';
  select count(*) into by_nobody from public.blocks;
  reset role;
  assert by_blocker = 1, format('the blocker sees %s of their 1 block', by_blocker);
  assert by_blocked = 0, 'the blocked person can see the block';
  assert by_nobody = 0, 'a signed-out caller can see a block';
end $$;

-- ── what the block reaches ───────────────────────────────────────────
-- No friend request either way.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000b';
  begin
    insert into public.friendships (requester, addressee, status)
    values ('d2000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000a', 'pending');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  begin
    insert into public.friendships (requester, addressee, status)
    values ('d2000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000b', 'pending');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 2, format('%s of 2 friend requests across a block were refused', refused);
end $$;

-- A bystander is untouched: they can still ask either of them.
do $$
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000c';
  insert into public.friendships (requester, addressee, status)
  values ('d2000000-0000-0000-0000-00000000000c', 'd2000000-0000-0000-0000-00000000000b', 'pending');
  reset role;
end $$;

-- Out of each other's suggestions, both ways, and off the applause.
do $$
declare a_sees int; b_sees int; applause int;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  select count(*) into a_sees from public.suggested_friends() where other = 'd2000000-0000-0000-0000-00000000000b';
  select count(*) into applause from public.likes_on_mine(now() - interval '1 hour');
  reset role;
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000b';
  select count(*) into b_sees from public.suggested_friends() where other = 'd2000000-0000-0000-0000-00000000000a';
  reset role;
  assert a_sees = 0, 'the blocked person is still suggested to the blocker';
  assert b_sees = 0, 'the blocker is still suggested to the person they blocked';
  assert applause = 0, 'the blocked person still appears on the blocker''s applause';
end $$;

-- ── lifting it ───────────────────────────────────────────────────────
-- Only the blocker can. An attempt by the blocked person finds nothing.
do $$
declare by_blocked int; by_blocker int;
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000b';
  with d as (delete from public.blocks returning 1) select count(*) into by_blocked from d;
  reset role;
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000a';
  with d as (delete from public.blocks where blocked = 'd2000000-0000-0000-0000-00000000000b' returning 1)
  select count(*) into by_blocker from d;
  reset role;
  assert by_blocked = 0, 'the blocked person lifted the block';
  assert by_blocker = 1, 'the blocker could not lift their own block';
end $$;

-- Lifted, they can ask again.
do $$
begin
  set local role rls_client;
  set local test.uid = 'd2000000-0000-0000-0000-00000000000b';
  insert into public.friendships (requester, addressee, status)
  values ('d2000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000a', 'pending');
  reset role;
end $$;

-- Leave nothing behind.
delete from public.collections where id in ('d2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-0000000000c2');
delete from public.places where id = 'd2000000-0000-0000-0000-0000000000f1';
delete from auth.users where id in (
  'd2000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000c');

select 'all block checks passed' as result;
