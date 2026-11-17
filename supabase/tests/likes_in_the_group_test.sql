-- A list shared with friends can be liked by them and by its owner
-- (20261117233000); a private list by nobody; a public one by anybody,
-- as before. Exercised through the policy as `rls_client`.
--
--   9d17…0a  the curator: one list shared, one private, one public
--   9d17…0b  a friend the shared list is shared with
--   9d17…0c  a friend it is not shared with
--   9d17…0d  a fan who liked the shared list while it was public

grant usage on schema public to rls_client, anon;
grant select, insert, delete on public.collection_likes to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('9d170000-0000-0000-0000-00000000000a', 'group-curator@x.com', '{"handle":"groupcurator"}'),
 ('9d170000-0000-0000-0000-00000000000b', 'group-friend@x.com',  '{"handle":"groupfriend"}'),
 ('9d170000-0000-0000-0000-00000000000c', 'group-other@x.com',   '{"handle":"groupother"}'),
 ('9d170000-0000-0000-0000-00000000000d', 'group-fan@x.com',     '{"handle":"groupfan"}');

insert into public.collections (id, slug, owner_id) values
 ('9d170000-0000-0000-0000-0000000000c1', 'group-shared',  '9d170000-0000-0000-0000-00000000000a'),
 ('9d170000-0000-0000-0000-0000000000c2', 'group-private', '9d170000-0000-0000-0000-00000000000a'),
 ('9d170000-0000-0000-0000-0000000000c3', 'group-public',  '9d170000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-0000000000c3');

-- The owner's example, from its start: public, and liked by a fan.
do $$
begin
  set local role rls_client;
  set local test.uid = '9d170000-0000-0000-0000-00000000000d';
  insert into public.collection_likes (collection_id, user_id) values
   ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000d');
  reset role;
end $$;

-- Then it goes to a group of one friend.
update public.collections set is_public = false where id = '9d170000-0000-0000-0000-0000000000c1';
insert into public.collection_shares (collection_id, user_id) values
 ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000b');

-- ── the friend in the group likes it, and so does the owner; the count grows on what it kept ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '9d170000-0000-0000-0000-00000000000b';
  insert into public.collection_likes (collection_id, user_id) values
   ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000b');
  select likes into n from public.collection_like_counts()
   where collection_id = '9d170000-0000-0000-0000-0000000000c1';
  assert n = 2, format('the friend should count 2 likes on the shared list, counted %s', n);

  set local test.uid = '9d170000-0000-0000-0000-00000000000a';
  insert into public.collection_likes (collection_id, user_id) values
   ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000a');
  select likes into n from public.collection_like_counts()
   where collection_id = '9d170000-0000-0000-0000-0000000000c1';
  assert n = 3, format('the owner should count 3 likes on the shared list, counted %s', n);
  reset role;
end $$;

-- ── nobody outside the group, under nobody else's name, and not on a private list ──
do $$
declare refused int := 0;
begin
  set local role rls_client;
  -- A friend it is not shared with.
  set local test.uid = '9d170000-0000-0000-0000-00000000000c';
  begin
    insert into public.collection_likes (collection_id, user_id) values
     ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000c');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- The friend in the group, filing a like under the outsider's name.
  set local test.uid = '9d170000-0000-0000-0000-00000000000b';
  begin
    insert into public.collection_likes (collection_id, user_id) values
     ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000c');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- The owner, on the list shared with nobody.
  set local test.uid = '9d170000-0000-0000-0000-00000000000a';
  begin
    insert into public.collection_likes (collection_id, user_id) values
     ('9d170000-0000-0000-0000-0000000000c2', '9d170000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- The friend, on that private list they cannot read.
  set local test.uid = '9d170000-0000-0000-0000-00000000000b';
  begin
    insert into public.collection_likes (collection_id, user_id) values
     ('9d170000-0000-0000-0000-0000000000c2', '9d170000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 4, format('%s of 4 improper likes were refused', refused);
end $$;

-- ── a public list is anybody's to like, as before ──
do $$
begin
  set local role rls_client;
  set local test.uid = '9d170000-0000-0000-0000-00000000000c';
  insert into public.collection_likes (collection_id, user_id) values
   ('9d170000-0000-0000-0000-0000000000c3', '9d170000-0000-0000-0000-00000000000c');
  reset role;
end $$;

-- ── unshared, the list is private again: no new like, and the three it has are kept ──
delete from public.collection_shares where collection_id = '9d170000-0000-0000-0000-0000000000c1';
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = '9d170000-0000-0000-0000-00000000000a';
  begin
    delete from public.collection_likes
     where collection_id = '9d170000-0000-0000-0000-0000000000c1' and user_id = '9d170000-0000-0000-0000-00000000000a';
    insert into public.collection_likes (collection_id, user_id) values
     ('9d170000-0000-0000-0000-0000000000c1', '9d170000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  assert refused = 1, 'the owner should not be able to like a list shared with nobody';
  select likes into n from public.collection_like_counts()
   where collection_id = '9d170000-0000-0000-0000-0000000000c1';
  assert n = 3, format('the list should keep its 3 likes once unshared, kept %s', n);
  reset role;
end $$;

select 'likes in the group: ok' as result;
