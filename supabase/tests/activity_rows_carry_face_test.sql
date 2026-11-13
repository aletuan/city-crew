-- An activity row carries the actor's id and face (20261113150000): the
-- owner of a list hears who liked it and who copied it as before, and now
-- with each one's account id and `avatar_url` beside the handle and the
-- name. Nobody else hears anything, as before. The filters the two bodies
-- kept are pinned again here because the functions were dropped and made
-- anew, which is the one way to lose a filter without editing it.
--
-- Exercised, not read, like `likes_kept_off_public_test`: `rls_client`
-- with `test.uid` in each reader's seat.
--
--   e6…0a  the curator, with one list
--   e6…0b  a fan with a photograph, who likes it and copies it
--   e6…0c  a fan whose face the desk cleared: an empty `avatar_url`
--   e6…0d  a fan the curator has blocked, who likes it and copies it
--   e6…0e  a stranger, who owns nothing here
--   e6…0f  a fan whose profile is gone, though their like and copy stay

grant usage on schema public to rls_client, anon;
grant select, insert, delete on public.collection_likes to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('e6000000-0000-0000-0000-00000000000a', 'face-curator@x.com',  '{"handle":"facecurator","full_name":"Face Curator"}'),
 ('e6000000-0000-0000-0000-00000000000b', 'face-fan@x.com',      '{"handle":"facefan","full_name":"Face Fan","avatar_url":"https://faces/fan.jpg"}'),
 ('e6000000-0000-0000-0000-00000000000c', 'face-cleared@x.com',  '{"handle":"facecleared"}'),
 ('e6000000-0000-0000-0000-00000000000d', 'face-blocked@x.com',  '{"handle":"faceblocked","avatar_url":"https://faces/blocked.jpg"}'),
 ('e6000000-0000-0000-0000-00000000000e', 'face-stranger@x.com', '{"handle":"facestranger"}'),
 ('e6000000-0000-0000-0000-00000000000f', 'face-gone@x.com',     '{"handle":"facegone","avatar_url":"https://faces/gone.jpg"}');

-- The cleared face as `moderate_profile` leaves it: the column emptied.
-- (A new profile with none gets an animal preset at insert, so the empty
-- string is only ever reached this way.)
update public.profiles set avatar_url = '' where id = 'e6000000-0000-0000-0000-00000000000c';

insert into public.collections (id, slug, owner_id) values
 ('e6000000-0000-0000-0000-0000000000c1', 'face-list', 'e6000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'e6000000-0000-0000-0000-0000000000c1';

-- Each like cast through the policy, as the app casts it — including the
-- curator's own, which the feed must still leave out.
do $$
declare uid text;
begin
  foreach uid in array array[
    'e6000000-0000-0000-0000-00000000000b', 'e6000000-0000-0000-0000-00000000000c',
    'e6000000-0000-0000-0000-00000000000d', 'e6000000-0000-0000-0000-00000000000f',
    'e6000000-0000-0000-0000-00000000000a'
  ] loop
    set local role rls_client;
    perform set_config('test.uid', uid, true);
    insert into public.collection_likes (collection_id, user_id)
    values ('e6000000-0000-0000-0000-0000000000c1', uid::uuid);
    reset role;
  end loop;
end $$;

-- The copies, made by the runner: the feed is under test, not the insert.
insert into public.collections (slug, owner_id, copied_from) values
 ('face-copy-by-fan',     'e6000000-0000-0000-0000-00000000000b', 'e6000000-0000-0000-0000-0000000000c1'),
 ('face-copy-by-cleared', 'e6000000-0000-0000-0000-00000000000c', 'e6000000-0000-0000-0000-0000000000c1'),
 ('face-copy-by-blocked', 'e6000000-0000-0000-0000-00000000000d', 'e6000000-0000-0000-0000-0000000000c1'),
 ('face-copy-by-curator', 'e6000000-0000-0000-0000-00000000000a', 'e6000000-0000-0000-0000-0000000000c1'),
 ('face-copy-by-gone',    'e6000000-0000-0000-0000-00000000000f', 'e6000000-0000-0000-0000-0000000000c1');

insert into public.blocks (blocker, blocked) values
 ('e6000000-0000-0000-0000-00000000000a', 'e6000000-0000-0000-0000-00000000000d');

-- The gone fan's profile, removed under their like and their copy: what
-- a row says of somebody with no profile left. Both key on `auth.users`,
-- so the rows stay while the profile goes.
delete from public.profiles where id = 'e6000000-0000-0000-0000-00000000000f';

-- ── the shape ──
--
-- The four columns where they were, the two new ones after them, by name
-- and by type: the app reads them by name, and a reader of the old four
-- still finds them in place.
do $$
declare l text; c text;
begin
  select pg_get_function_result('public.likes_on_mine(timestamptz)'::regprocedure) into l;
  select pg_get_function_result('public.copies_of_mine(timestamptz)'::regprocedure) into c;
  assert l = 'TABLE(collection_id uuid, liked_at timestamp with time zone, liker_handle text, liker_name text, liker_id uuid, liker_avatar_url text)',
    format('likes_on_mine returns %s', l);
  assert c = 'TABLE(collection_id uuid, copied_at timestamp with time zone, copier_handle text, copier_name text, copier_id uuid, copier_avatar_url text)',
    format('copies_of_mine returns %s', c);
end $$;

-- ── the owner: every row with its id and its face ──
do $$
declare likes text; copies text;
begin
  set local role rls_client;
  set local test.uid = 'e6000000-0000-0000-0000-00000000000a';
  select string_agg(format('%s|%s|%s', coalesce(liker_handle, '-'), coalesce(liker_id::text, '-'), coalesce(liker_avatar_url, '-')), ',' order by liker_handle nulls last)
    into likes from public.likes_on_mine(now() - interval '1 day');
  select string_agg(format('%s|%s|%s', coalesce(copier_handle, '-'), coalesce(copier_id::text, '-'), coalesce(copier_avatar_url, '-')), ',' order by copier_handle nulls last)
    into copies from public.copies_of_mine(now() - interval '1 day');
  reset role;
  -- The fan with their photograph, the cleared fan with an empty one, the
  -- gone fan with nothing at all — no id either, so no button. Not the
  -- blocked fan, not the curator.
  assert likes = 'facecleared|e6000000-0000-0000-0000-00000000000c|,'
              || 'facefan|e6000000-0000-0000-0000-00000000000b|https://faces/fan.jpg,'
              || '-|-|-',
    format('the owner hears these likes: %s', likes);
  assert copies = 'facecleared|e6000000-0000-0000-0000-00000000000c|,'
               || 'facefan|e6000000-0000-0000-0000-00000000000b|https://faces/fan.jpg,'
               || '-|-|-',
    format('the owner hears these copies: %s', copies);
end $$;

-- The name is still beside them: the old columns did not move.
do $$
declare n text; at_ok boolean;
begin
  set local role rls_client;
  set local test.uid = 'e6000000-0000-0000-0000-00000000000a';
  select liker_name, liked_at <= now() into n, at_ok from public.likes_on_mine(now() - interval '1 day')
   where liker_handle = 'facefan';
  reset role;
  assert n = 'Face Fan' and at_ok, format('the fan''s like reads %L', n);
end $$;

-- `since` still cuts, both functions.
do $$
declare l int; c int;
begin
  set local role rls_client;
  set local test.uid = 'e6000000-0000-0000-0000-00000000000a';
  select count(*) into l from public.likes_on_mine(now() + interval '1 minute');
  select count(*) into c from public.copies_of_mine(now() + interval '1 minute');
  reset role;
  assert l = 0 and c = 0, format('since no longer cuts: %s likes and %s copies from the future', l, c);
end $$;

-- ── everybody else: nothing, as before ──
--
-- The stranger owns nothing, and the fans own nothing that was liked or
-- copied: none of them hears an id, a face, or a row.
do $$
declare uid text; l int; c int;
begin
  foreach uid in array array[
    'e6000000-0000-0000-0000-00000000000b',
    'e6000000-0000-0000-0000-00000000000d',
    'e6000000-0000-0000-0000-00000000000e'
  ] loop
    set local role rls_client;
    perform set_config('test.uid', uid, true);
    select count(*) into l from public.likes_on_mine(now() - interval '1 day');
    select count(*) into c from public.copies_of_mine(now() - interval '1 day');
    reset role;
    assert l = 0 and c = 0, format('%s hears %s likes and %s copies on somebody else''s list', uid, l, c);
  end loop;
end $$;

-- ── what the drop could have lost ──
--
-- The grants the functions end up with: signed-in callers, and neither
-- `anon` nor `public`. `public` is checked on the ACL itself, since
-- `has_function_privilege` takes a role and `public` is not one. What
-- gives them today is the schema's defaults as much as the migration's
-- own revoke and grant (see its header), so this holds the outcome, not
-- which statement produced it.
do $$
declare f text;
begin
  foreach f in array array['public.likes_on_mine(timestamptz)', 'public.copies_of_mine(timestamptz)'] loop
    assert not has_function_privilege('anon', f, 'execute'), format('%s is open to anon', f);
    assert has_function_privilege('authenticated', f, 'execute'), format('%s is closed to readers', f);
    assert not exists (
      select 1 from pg_proc p, aclexplode(p.proacl) a
      where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), format('%s is executable by public', f);
  end loop;
end $$;

-- And what makes them work at all: definer rights (an owner reads
-- `profiles` and other people's copies through them) and the pinned
-- search path. Both are in the function's header, which the drop
-- discarded and the create had to say again.
do $$
declare f text; def boolean; cfg text[];
begin
  foreach f in array array['public.likes_on_mine(timestamptz)', 'public.copies_of_mine(timestamptz)'] loop
    select prosecdef, proconfig into def, cfg from pg_proc where oid = f::regprocedure;
    assert def, format('%s is no longer security definer', f);
    assert cfg = array['search_path=public'], format('%s runs with %s', f, cfg);
  end loop;
end $$;

-- Leave nothing behind.
delete from public.collections where slug like 'face-%';
delete from public.blocks where blocker = 'e6000000-0000-0000-0000-00000000000a';

select 'all activity-rows-carry-face checks passed';
