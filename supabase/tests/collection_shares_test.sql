-- A list shared with chosen friends, as a client sees it: only the owner
-- shares, only with an accepted friend, never with themselves, a stranger,
-- someone still asked, or someone blocked. A friend reads the list and its
-- live places and nothing else; nobody else reads anything; a guest's read
-- of the catalog does not trip over the new policy. And a share ends by
-- itself when the friendship does, when either blocks the other, and when
-- the list goes.
--
-- Exercised, not read off pg_policy: `rls_client` as the owner, the
-- friend, a stranger and a pending friend, and `anon` signed out.

grant usage on schema public to rls_client, anon;
grant select, insert, delete on public.collection_shares to rls_client;
grant select on public.collections, public.collection_places, public.places to rls_client, anon;
grant select, insert, update, delete on public.friendships, public.blocks to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d4000000-0000-0000-0000-00000000000a', 'share-owner@x.com',   '{"handle":"shareowner"}'),
 ('d4000000-0000-0000-0000-00000000000b', 'share-friend@x.com',  '{"handle":"sharefriend"}'),
 ('d4000000-0000-0000-0000-00000000000c', 'share-stranger@x.com','{"handle":"sharestranger"}'),
 ('d4000000-0000-0000-0000-00000000000d', 'share-asked@x.com',   '{"handle":"shareasked"}');

-- One live place and one still waiting on the desk, both on one private list.
insert into public.places (id, slug, is_published, review_status) values
 ('d4000000-0000-0000-0000-0000000000f1', 'share-live-place', true, 'approved'),
 ('d4000000-0000-0000-0000-0000000000f2', 'share-pending-place', false, 'pending');
insert into public.collections (id, slug, owner_id) values
 ('d4000000-0000-0000-0000-0000000000c1', 'share-private-list', 'd4000000-0000-0000-0000-00000000000a');
insert into public.collection_places (collection_id, place_id) values
 ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-0000000000f1'),
 ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-0000000000f2');

-- B is a friend; D has been asked and has not answered.
insert into public.friendships (requester, addressee, status) values
 ('d4000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000b', 'accepted'),
 ('d4000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000d', 'pending');

-- ── before any share, the friend sees nothing ──
do $$
declare lists int; members int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  select count(*) into lists from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
  select count(*) into members from public.collection_places where collection_id = 'd4000000-0000-0000-0000-0000000000c1';
  reset role;
  assert lists = 0 and members = 0, format('a private list was readable before it was shared: %s, %s', lists, members);
end $$;

-- ── who may be on the list ──
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000a';
  -- A stranger, someone only asked, and the owner themselves: each refused.
  begin
    insert into public.collection_shares (collection_id, user_id)
    values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000c');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.collection_shares (collection_id, user_id)
    values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000d');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.collection_shares (collection_id, user_id)
    values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- The friend: allowed.
  insert into public.collection_shares (collection_id, user_id)
  values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000b');
  reset role;
  assert refused = 3, format('expected 3 refusals for stranger, pending and self, got %s', refused);
end $$;

-- Only the owner shares: the friend cannot pass the list on.
do $$
declare refused int := 0;
begin
  insert into public.friendships (requester, addressee, status) values
   ('d4000000-0000-0000-0000-00000000000b', 'd4000000-0000-0000-0000-00000000000c', 'accepted');
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  begin
    insert into public.collection_shares (collection_id, user_id)
    values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000c');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 1, 'a friend passed a shared list on to their own friend';
  delete from public.friendships
   where requester = 'd4000000-0000-0000-0000-00000000000b' and addressee = 'd4000000-0000-0000-0000-00000000000c';
end $$;

-- ── what the friend reads, and what nobody else does ──
do $$
declare lists int; live int; waiting int; public_lists int; shares int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  select count(*) into lists from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
  select count(*) filter (where place_id = 'd4000000-0000-0000-0000-0000000000f1'),
         count(*) filter (where place_id = 'd4000000-0000-0000-0000-0000000000f2')
    into live, waiting
    from public.collection_places where collection_id = 'd4000000-0000-0000-0000-0000000000c1';
  -- The catalog's own read, `is_public = true`, still leaves it out.
  select count(*) into public_lists from public.collections
   where id = 'd4000000-0000-0000-0000-0000000000c1' and is_public;
  select count(*) into shares from public.collection_shares;
  reset role;
  assert lists = 1, 'the friend cannot read the list shared with them';
  assert live = 1, 'the friend cannot read the live place on the list';
  assert waiting = 0, 'the friend can read a place still waiting on the desk';
  assert public_lists = 0, 'a shared list reads as public';
  assert shares = 1, format('the friend sees %s shares, not the one naming them', shares);
end $$;

do $$
declare lists int; members int; shares int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000c';
  select count(*) into lists from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
  select count(*) into members from public.collection_places where collection_id = 'd4000000-0000-0000-0000-0000000000c1';
  select count(*) into shares from public.collection_shares;
  reset role;
  assert lists = 0 and members = 0 and shares = 0,
    format('a stranger reads a list shared with someone else: %s, %s, %s', lists, members, shares);
end $$;

do $$
declare shares int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000a';
  select count(*) into shares from public.collection_shares;
  reset role;
  assert shares = 1, 'the owner cannot see who their list is shared with';
end $$;

-- Signed out, the catalog read still works: the new policy is not
-- evaluated for a guest, so it cannot error on a function a guest may not call.
do $$
declare lists int;
begin
  set local role anon;
  select count(*) into lists from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
  reset role;
  assert lists = 0, 'a guest reads a shared list';
end $$;

-- ── the friend takes themselves off ──
do $$
declare left_ int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  delete from public.collection_shares where collection_id = 'd4000000-0000-0000-0000-0000000000c1';
  reset role;
  select count(*) into left_ from public.collection_shares where collection_id = 'd4000000-0000-0000-0000-0000000000c1';
  assert left_ = 0, 'the friend could not take themselves off the list';
end $$;

-- ── a share ends with the friendship ──
insert into public.collection_shares (collection_id, user_id)
values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000b');
do $$
declare left_ int;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  delete from public.friendships
   where requester = 'd4000000-0000-0000-0000-00000000000a' and addressee = 'd4000000-0000-0000-0000-00000000000b';
  reset role;
  select count(*) into left_ from public.collection_shares;
  assert left_ = 0, 'an unfriending left the share behind';
end $$;

-- ── and with a block, made either way ──
insert into public.friendships (requester, addressee, status) values
 ('d4000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000b', 'accepted');
insert into public.collection_shares (collection_id, user_id)
values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000b');
do $$
declare left_ int;
begin
  -- The friend blocks the owner with a bare insert, not `block_user`:
  -- the friendship row is left standing, and the share must still go.
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000b';
  insert into public.blocks (blocker, blocked)
  values ('d4000000-0000-0000-0000-00000000000b', 'd4000000-0000-0000-0000-00000000000a');
  reset role;
  select count(*) into left_ from public.collection_shares;
  assert left_ = 0, 'a block left the share behind';
end $$;

-- While blocked, the owner cannot share again, friendship or not.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000a';
  begin
    insert into public.collection_shares (collection_id, user_id)
    values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 1, 'a list was shared with someone who had blocked its owner';
end $$;
delete from public.blocks where blocker = 'd4000000-0000-0000-0000-00000000000b';

-- ── and with the list ──
insert into public.collection_shares (collection_id, user_id)
values ('d4000000-0000-0000-0000-0000000000c1', 'd4000000-0000-0000-0000-00000000000b');
delete from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
do $$
declare left_ int;
begin
  select count(*) into left_ from public.collection_shares;
  assert left_ = 0, 'a deleted list left its shares behind';
end $$;

-- ── the helpers stay closed to the signed-out ──
do $$
begin
  assert not has_function_privilege('anon', 'public.shared_with_me(uuid)', 'execute'), 'shared_with_me is open to anon';
  assert not has_function_privilege('anon', 'public.owns_collection(uuid)', 'execute'), 'owns_collection is open to anon';
  assert not has_function_privilege('anon', 'public.friends_with(uuid)', 'execute'), 'friends_with is open to anon';
  assert not has_function_privilege('authenticated', 'public.unshare_pair(uuid, uuid)', 'execute'), 'unshare_pair is open to callers';
end $$;

select 'all collection share checks passed';
