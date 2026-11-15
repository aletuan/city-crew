-- A list's activity, read by whoever can read the list
-- (`20261115090000_list_activity_for_readers`).
--
-- The cast: a curator with a public list and a private one; a fan who
-- liked and copied; somebody the curator blocked, who also liked and
-- copied; a reader; a friend the private list is shared with; and two
-- who have a block between them and the reader, one each way.

grant usage on schema public to rls_client, anon;
grant select, insert, delete on public.collection_likes to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f7000000-0000-0000-0000-00000000000a', 'ra-curator@x.com',   '{"handle":"racurator","full_name":"Ra Curator"}'),
 ('f7000000-0000-0000-0000-00000000000b', 'ra-fan@x.com',       '{"handle":"rafan","full_name":"Ra Fan","avatar_url":"https://faces/rafan.jpg"}'),
 ('f7000000-0000-0000-0000-00000000000c', 'ra-outcast@x.com',   '{"handle":"raoutcast"}'),
 ('f7000000-0000-0000-0000-00000000000d', 'ra-reader@x.com',    '{"handle":"rareader"}'),
 ('f7000000-0000-0000-0000-00000000000e', 'ra-friend@x.com',    '{"handle":"rafriend"}'),
 ('f7000000-0000-0000-0000-00000000000f', 'ra-muted@x.com',     '{"handle":"ramuted"}'),
 ('f7000000-0000-0000-0000-000000000010', 'ra-muter@x.com',     '{"handle":"ramuter"}');

insert into public.collections (id, slug, owner_id) values
 ('f7000000-0000-0000-0000-0000000000c1', 'ra-public',  'f7000000-0000-0000-0000-00000000000a'),
 ('f7000000-0000-0000-0000-0000000000c2', 'ra-private', 'f7000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'f7000000-0000-0000-0000-0000000000c1';

-- Likes on the public list: the fan, the outcast, the reader, the two
-- with a block against the reader, and the curator's own.
do $$
declare uid text;
begin
  foreach uid in array array[
    'f7000000-0000-0000-0000-00000000000b', 'f7000000-0000-0000-0000-00000000000c',
    'f7000000-0000-0000-0000-00000000000d', 'f7000000-0000-0000-0000-00000000000f',
    'f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-00000000000a'
  ] loop
    set local role rls_client;
    perform set_config('test.uid', uid, true);
    insert into public.collection_likes (collection_id, user_id)
    values ('f7000000-0000-0000-0000-0000000000c1', uid::uuid);
    reset role;
  end loop;
end $$;

-- One like the private list kept from when it was public.
insert into public.collection_likes (collection_id, user_id) values
 ('f7000000-0000-0000-0000-0000000000c2', 'f7000000-0000-0000-0000-00000000000b');

insert into public.collections (slug, owner_id, copied_from) values
 ('ra-copy-by-fan',     'f7000000-0000-0000-0000-00000000000b', 'f7000000-0000-0000-0000-0000000000c1'),
 ('ra-copy-by-outcast', 'f7000000-0000-0000-0000-00000000000c', 'f7000000-0000-0000-0000-0000000000c1'),
 ('ra-copy-by-muted',   'f7000000-0000-0000-0000-00000000000f', 'f7000000-0000-0000-0000-0000000000c1'),
 ('ra-copy-by-curator', 'f7000000-0000-0000-0000-00000000000a', 'f7000000-0000-0000-0000-0000000000c1'),
 ('ra-copy-by-friend',  'f7000000-0000-0000-0000-00000000000e', 'f7000000-0000-0000-0000-0000000000c1'),
 -- And one of the private list, from when it was public.
 ('ra-copy-of-private', 'f7000000-0000-0000-0000-00000000000b', 'f7000000-0000-0000-0000-0000000000c2');

-- When each copy was made, against the day a reader starts being told
-- (16 Nov 2026, Vietnam's): the fan's before it, under the policy that
-- named the curator alone; the rest after. Dated, not `now()`, so the
-- test reads the same on any day it runs.
update public.collections set created_at = '2026-11-15 23:59:59+07' where slug = 'ra-copy-by-fan';
update public.collections set created_at = '2026-11-16 00:00:00+07'
 where slug in ('ra-copy-by-outcast', 'ra-copy-by-muted', 'ra-copy-by-curator', 'ra-copy-by-friend', 'ra-copy-of-private');

insert into public.blocks (blocker, blocked) values
 ('f7000000-0000-0000-0000-00000000000a', 'f7000000-0000-0000-0000-00000000000c'),  -- the curator's
 ('f7000000-0000-0000-0000-00000000000d', 'f7000000-0000-0000-0000-00000000000f'),  -- the reader blocked one
 ('f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-00000000000d');  -- and one blocked the reader

insert into public.collection_shares (collection_id, user_id) values
 ('f7000000-0000-0000-0000-0000000000c2', 'f7000000-0000-0000-0000-00000000000e');

-- ── the owner: what `likes_on_mine` says for this list, row for row ──
do $$
declare mine text; list text; cmine text; clist text;
begin
  set local role rls_client;
  set local test.uid = 'f7000000-0000-0000-0000-00000000000a';
  select string_agg(liker_handle, ',' order by liker_handle) into mine
    from public.likes_on_mine('epoch') where collection_id = 'f7000000-0000-0000-0000-0000000000c1';
  select string_agg(liker_handle, ',' order by liker_handle) into list
    from public.likes_on_list('f7000000-0000-0000-0000-0000000000c1');
  select string_agg(copier_handle, ',' order by copier_handle) into cmine
    from public.copies_of_mine('epoch') where collection_id = 'f7000000-0000-0000-0000-0000000000c1';
  select string_agg(copier_handle, ',' order by copier_handle) into clist
    from public.copies_of_list('f7000000-0000-0000-0000-0000000000c1');
  reset role;
  assert list = 'rafan,ramuted,ramuter,rareader', format('the owner reads these likes: %s', list);
  assert list = mine, format('the owner''s list (%s) is not likes_on_mine''s (%s)', list, mine);
  assert clist = 'rafan,rafriend,ramuted', format('the owner reads these copies: %s', clist);
  assert clist = cmine, format('the owner''s copies (%s) are not copies_of_mine''s (%s)', clist, cmine);
end $$;

-- ── a reader of a public list: the owner's answer, less the two a
--    block stands between ──
do $$
declare likes text; copies text; face text; id_ uuid;
begin
  set local role rls_client;
  set local test.uid = 'f7000000-0000-0000-0000-00000000000d';
  select string_agg(liker_handle, ',' order by liker_handle) into likes
    from public.likes_on_list('f7000000-0000-0000-0000-0000000000c1');
  select string_agg(copier_handle, ',' order by copier_handle) into copies
    from public.copies_of_list('f7000000-0000-0000-0000-0000000000c1');
  select liker_avatar_url, liker_id into face, id_
    from public.likes_on_list('f7000000-0000-0000-0000-0000000000c1') where liker_handle = 'rafan';
  reset role;
  -- Not the outcast (the owner's block), not the curator's own, not
  -- `ramuted` (the reader blocked them), not `ramuter` (they blocked the
  -- reader). The reader's own like is a like, and is there.
  assert likes = 'rafan,rareader', format('a reader reads these likes: %s', likes);
  -- Not the fan's: it was made a second before the day a reader is told
  -- from, when the policy named the curator alone.
  assert copies = 'rafriend', format('a reader reads these copies: %s', copies);
  assert face = 'https://faces/rafan.jpg' and id_ = 'f7000000-0000-0000-0000-00000000000b',
    format('a reader''s row carries %s and %s', face, id_);
end $$;

-- ── a private list: its owner, the friend it is shared with, nobody else ──
do $$
declare who text; n int; s int; k int;
begin
  foreach who in array array['f7000000-0000-0000-0000-00000000000a', 'f7000000-0000-0000-0000-00000000000e'] loop
    set local role rls_client;
    perform set_config('test.uid', who, true);
    select count(*) into n from public.likes_on_list('f7000000-0000-0000-0000-0000000000c2');
    select count(*) into k from public.copies_of_list('f7000000-0000-0000-0000-0000000000c2');
    select count(*) into s from public.collection_stats('f7000000-0000-0000-0000-0000000000c2');
    reset role;
    assert n = 1 and k = 1 and s = 1, format('%s reads %s likes, %s copies and %s rows of figures on the private list', who, n, k, s);
  end loop;
  -- The fan is refused too, though the like and the copy are theirs.
  foreach who in array array['f7000000-0000-0000-0000-00000000000d', 'f7000000-0000-0000-0000-00000000000b'] loop
    set local role rls_client;
    perform set_config('test.uid', who, true);
    select count(*) into n from public.likes_on_list('f7000000-0000-0000-0000-0000000000c2');
    select count(*) into s from public.collection_stats('f7000000-0000-0000-0000-0000000000c2');
    reset role;
    assert n = 0 and s = 0, format('%s reads %s likes and %s rows of figures on a list they cannot open', who, n, s);
    set local role rls_client;
    perform set_config('test.uid', who, true);
    select count(*) into n from public.copies_of_list('f7000000-0000-0000-0000-0000000000c2');
    reset role;
    assert n = 0, format('%s reads %s copies of a list they cannot open', who, n);
  end loop;
end $$;

-- ── the figures: one answer, whoever asks ──
--
-- Four likes and three copies stand for the owner (the outcast's and the
-- owner's own left out). The reader is told the same four and three,
-- though their page of people lists two and one: a figure that moved with the
-- asker would tell them a block exists.
do $$
declare o record; r record; f record;
begin
  set local role rls_client;
  set local test.uid = 'f7000000-0000-0000-0000-00000000000a';
  select * into o from public.collection_stats('f7000000-0000-0000-0000-0000000000c1');
  set local test.uid = 'f7000000-0000-0000-0000-00000000000d';
  select * into r from public.collection_stats('f7000000-0000-0000-0000-0000000000c1');
  -- And somebody who has liked nothing: with the caller's own like left
  -- out in place of the owner's, the reader above still counts four (one
  -- of theirs out, the owner's in) and only this asker shows the five.
  set local test.uid = 'f7000000-0000-0000-0000-00000000000e';
  select * into f from public.collection_stats('f7000000-0000-0000-0000-0000000000c1');
  reset role;
  assert o.likes_total = 4 and o.copies_total = 3, format('the owner''s figures: %s likes, %s copies', o.likes_total, o.copies_total);
  assert r = o, format('a reader''s figures %s are not the owner''s %s', r, o);
  assert f = o, format('another reader''s figures %s are not the owner''s %s', f, o);
end $$;

-- ── who may call ──
do $$
declare f text;
begin
  foreach f in array array['public.likes_on_list(uuid)', 'public.copies_of_list(uuid)', 'public.collection_stats(uuid)'] loop
    assert not has_function_privilege('anon', f, 'execute'), format('%s is open to anon', f);
    assert has_function_privilege('authenticated', f, 'execute'), format('%s is closed to readers', f);
    assert not exists (
      select 1 from pg_proc p, aclexplode(p.proacl) a
      where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), format('%s is executable by public', f);
    assert (select prosecdef from pg_proc where oid = f::regprocedure), format('%s is not security definer', f);
    assert (select proconfig from pg_proc where oid = f::regprocedure) = array['search_path=public'], format('%s has no pinned search path', f);
  end loop;
end $$;

-- Leave nothing behind.
delete from public.collections where slug like 'ra-%';
delete from public.blocks where blocker in (
  'f7000000-0000-0000-0000-00000000000a', 'f7000000-0000-0000-0000-00000000000d', 'f7000000-0000-0000-0000-000000000010');

select 'all list-activity-for-readers checks passed';
