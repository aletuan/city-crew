-- A list's likes outlive its going private (20261113120000): the count
-- to its owner and to a friend it is shared with, and to nobody else; the
-- names and the copies to its owner alone; and a new like still refused.
-- A public list is counted for everybody, exactly as before.
--
-- Exercised, not read: `rls_client` with `test.uid` in each reader's
-- seat, and `anon` signed out — the seat that matters for the one call
-- this migration adds, `shared_with_me` from inside a function anon may
-- execute while it may not execute `shared_with_me` itself.
--
--   e5…0a  the curator: one list going private, one staying public
--   e5…0b  a friend the private list is shared with
--   e5…0c  a stranger
--   e5…0d  a fan who liked and copied both lists while they were public
--   e5…0e  a fan the curator has blocked, who liked the private one
--   e5…0f  a late reader, who tries to like the list once it is private

grant usage on schema public to rls_client, anon;
grant select, insert, delete on public.collection_likes to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('e5000000-0000-0000-0000-00000000000a', 'kept-curator@x.com',  '{"handle":"keptcurator","full_name":"Kept Curator"}'),
 ('e5000000-0000-0000-0000-00000000000b', 'kept-friend@x.com',   '{"handle":"keptfriend"}'),
 ('e5000000-0000-0000-0000-00000000000c', 'kept-stranger@x.com', '{"handle":"keptstranger"}'),
 ('e5000000-0000-0000-0000-00000000000d', 'kept-fan@x.com',      '{"handle":"keptfan","full_name":"Kept Fan"}'),
 ('e5000000-0000-0000-0000-00000000000e', 'kept-blocked@x.com',  '{"handle":"keptblocked"}'),
 ('e5000000-0000-0000-0000-00000000000f', 'kept-late@x.com',     '{"handle":"keptlate"}');

-- Born private, published by an update (the publish migration's insert
-- trigger), as every list is.
insert into public.collections (id, slug, owner_id) values
 ('e5000000-0000-0000-0000-0000000000c1', 'kept-going-private', 'e5000000-0000-0000-0000-00000000000a'),
 ('e5000000-0000-0000-0000-0000000000c2', 'kept-staying-public', 'e5000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000c2');

-- While both are public: the fan likes both, the blocked fan likes the
-- first, and the curator likes their own first list — three readers'
-- kinds of like, each cast through the policy as the app casts it.
do $$
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000d';
  insert into public.collection_likes (collection_id, user_id) values
   ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000d'),
   ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-00000000000d');
  set local test.uid = 'e5000000-0000-0000-0000-00000000000e';
  insert into public.collection_likes (collection_id, user_id) values
   ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000e');
  set local test.uid = 'e5000000-0000-0000-0000-00000000000a';
  insert into public.collection_likes (collection_id, user_id) values
   ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000a');
  reset role;
end $$;

-- The fan saves a copy of each, the blocked fan of the first, and the
-- curator of their own first list, which is not news to them. The
-- copies are the copiers' own lists, made by the runner as the desk
-- makes fixtures: what is under test is the feed, not the copy's insert.
insert into public.collections (slug, owner_id, copied_from) values
 ('kept-copy-of-private', 'e5000000-0000-0000-0000-00000000000d', 'e5000000-0000-0000-0000-0000000000c1'),
 ('kept-copy-of-public',  'e5000000-0000-0000-0000-00000000000d', 'e5000000-0000-0000-0000-0000000000c2'),
 ('kept-copy-by-blocked', 'e5000000-0000-0000-0000-00000000000e', 'e5000000-0000-0000-0000-0000000000c1'),
 ('kept-copy-by-curator', 'e5000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-0000000000c1');

-- The block, by the curator; the friendship and the share, as the app
-- would leave them. Made by the runner: the share's own policies are
-- `collection_shares_test`'s business.
insert into public.blocks (blocker, blocked) values
 ('e5000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-00000000000e');
insert into public.friendships (requester, addressee, status) values
 ('e5000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-00000000000b', 'accepted');
insert into public.collection_shares (collection_id, user_id) values
 ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000b');

-- ── and now the first list goes private ──
update public.collections set is_public = false where id = 'e5000000-0000-0000-0000-0000000000c1';

-- The rows were never what went missing: all three are still there.
do $$
declare n int;
begin
  select count(*) into n from public.collection_likes where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  assert n = 3, format('going private took likes with it: %s of 3 left', n);
end $$;

-- ── the count, seat by seat ──
--
-- `likes` and `others` both, so a rewrite that kept the row and lost the
-- owner's own-like rule (`others`) is caught as surely as one that lost
-- the row. The private list: 3 likes, 2 not the curator's. The public
-- one: 1 and 1, whoever asks.
do $$
declare priv_l int; priv_o int; priv_rows int; pub_l int; pub_o int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000a';
  select count(*), max(likes), max(others) into priv_rows, priv_l, priv_o
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select likes, others into pub_l, pub_o
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  reset role;
  assert priv_rows = 1, 'the owner lost the count on their list gone private';
  assert priv_l = 3 and priv_o = 2, format('the owner reads %s/%s on their private list, not 3/2', priv_l, priv_o);
  assert pub_l = 1 and pub_o = 1, format('the owner reads %s/%s on their public list, not 1/1', pub_l, pub_o);
end $$;

do $$
declare priv_l int; priv_o int; priv_rows int; pub_l int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000b';
  select count(*), max(likes), max(others) into priv_rows, priv_l, priv_o
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select likes into pub_l
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  reset role;
  assert priv_rows = 1, 'a friend the list is shared with cannot see its count';
  assert priv_l = 3 and priv_o = 2, format('the friend reads %s/%s, not 3/2', priv_l, priv_o);
  assert pub_l = 1, format('the friend reads %s on the public list, not 1', pub_l);
end $$;

do $$
declare priv_rows int; pub_l int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000c';
  select count(*) into priv_rows
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select likes into pub_l
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  reset role;
  assert priv_rows = 0, 'a stranger reads the count on a private list';
  assert pub_l = 1, format('a stranger reads %s on the public list, not 1', pub_l);
end $$;

-- Signed out, as `anon` — not `rls_client` with no uid. This is the seat
-- that proves `shared_with_me`, granted to the signed-in alone, is
-- reached as the definer's owner: called as anon directly it is refused,
-- and through the count it answers, false.
do $$
declare priv_rows int; pub_l int; refused boolean := false;
begin
  set local role anon;
  begin
    perform public.shared_with_me('e5000000-0000-0000-0000-0000000000c1');
  exception when insufficient_privilege then refused := true;
  end;
  select count(*) into priv_rows
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select likes into pub_l
    from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  reset role;
  assert refused, 'shared_with_me is callable by anon directly, so this seat proves nothing about the definer';
  assert priv_rows = 0, 'a guest reads the count on a private list';
  assert pub_l = 1, format('a guest reads %s on the public list, not 1', pub_l);
end $$;

-- ── who liked and who copied: the owner, and nobody else ──
--
-- The owner hears of the fan's like and copy on the list gone private;
-- not their own like or copy, and not the blocked fan's like or copy. Every
-- other exclusion `likes_on_mine` and `copies_of_mine` had still holds.
do $$
declare likes_priv text; copies_priv text; likes_pub int; copies_pub int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000a';
  select string_agg(liker_handle, ',' order by liker_handle) into likes_priv
    from public.likes_on_mine(now() - interval '1 day') where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select string_agg(copier_handle, ',' order by copier_handle) into copies_priv
    from public.copies_of_mine(now() - interval '1 day') where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  select count(*) into likes_pub
    from public.likes_on_mine(now() - interval '1 day') where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  select count(*) into copies_pub
    from public.copies_of_mine(now() - interval '1 day') where collection_id = 'e5000000-0000-0000-0000-0000000000c2';
  reset role;
  assert likes_priv = 'keptfan', format('the owner hears of likes on their private list from %L, not keptfan alone', likes_priv);
  assert copies_priv = 'keptfan', format('the owner hears of copies of their private list from %L, not keptfan alone', copies_priv);
  assert likes_pub = 1 and copies_pub = 1, format('the public list reads %s likes, %s copies, not 1 and 1', likes_pub, copies_pub);
end $$;

-- `since` still cuts, on a private list as on a public one.
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000a';
  select count(*) into n from public.likes_on_mine(now() + interval '1 minute');
  reset role;
  assert n = 0, format('since no longer cuts: %s likes from the future', n);
end $$;

-- The friend it is shared with, the stranger, and the fan who acted on
-- it: none of them hears a name. Each owns nothing here, and each feed
-- answers only about the caller's own lists.
do $$
declare uid text; l int; c int;
begin
  foreach uid in array array[
    'e5000000-0000-0000-0000-00000000000b',
    'e5000000-0000-0000-0000-00000000000c',
    'e5000000-0000-0000-0000-00000000000d'
  ] loop
    set local role rls_client;
    perform set_config('test.uid', uid, true);
    select count(*) into l from public.likes_on_mine(now() - interval '1 day')
     where collection_id in ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000c2');
    select count(*) into c from public.copies_of_mine(now() - interval '1 day')
     where collection_id in ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000c2');
    reset role;
    assert l = 0 and c = 0, format('%s hears %s likes and %s copies on somebody else''s lists', uid, l, c);
  end loop;
end $$;

-- And still closed to the signed-out.
do $$
begin
  assert not has_function_privilege('anon', 'public.likes_on_mine(timestamptz)', 'execute'), 'likes_on_mine is open to anon';
  assert not has_function_privilege('anon', 'public.copies_of_mine(timestamptz)', 'execute'), 'copies_of_mine is open to anon';
  assert has_function_privilege('anon', 'public.collection_like_counts()', 'execute'), 'the guest''s shelf lost its counts';
  assert has_function_privilege('authenticated', 'public.likes_on_mine(timestamptz)', 'execute'), 'likes_on_mine is closed to readers';
  assert has_function_privilege('authenticated', 'public.copies_of_mine(timestamptz)', 'execute'), 'copies_of_mine is closed to readers';
end $$;

-- ── a new like on a private list is still refused ──
--
-- By the late reader, and by the friend it is shared with: the count is
-- kept, the button is not. The public list still takes one, so the
-- refusal is the list's privacy and not a broken insert.
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000f';
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000f');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000b';
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000f';
  insert into public.collection_likes (collection_id, user_id)
  values ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-00000000000f');
  reset role;
  select count(*) into n from public.collection_likes where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  assert refused = 2, format('%s of 2 likes on a private list were refused', refused);
  assert n = 3, format('the private list holds %s likes, not the 3 it had', n);
end $$;

-- ── the share ends, and the friend's count with it ──
delete from public.collection_shares where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'e5000000-0000-0000-0000-00000000000b';
  select count(*) into n from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  reset role;
  assert n = 0, 'a friend no longer shared the list still reads its count';
end $$;

-- ── back to public: counted for everyone again, nothing lost ──
update public.collections set is_public = true where id = 'e5000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  set local role anon;
  select likes into n from public.collection_like_counts() where collection_id = 'e5000000-0000-0000-0000-0000000000c1';
  reset role;
  assert n = 3, format('republished, the list reads %s likes to a guest, not 3', n);
end $$;

-- Leave nothing behind: the lists take their likes and shares with them.
delete from public.collections where slug like 'kept-%';
delete from public.blocks where blocker = 'e5000000-0000-0000-0000-00000000000a';
delete from public.friendships where requester = 'e5000000-0000-0000-0000-00000000000a';

select 'all likes-kept-off-public checks passed';
