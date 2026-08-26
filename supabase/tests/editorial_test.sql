-- Integration test for 20260826000000_editorial_identities.sql.
--
-- Run against a throwaway Postgres with `_harness.sql` loaded and the
-- migration applied — see run.sh. Every check raises rather than
-- reporting, so a silent pass is the only pass.
--
-- The migration's own guard already proves the seven profiles exist;
-- what is asserted here is everything around that guard: the identities
-- came out whole, the reservations came back, the ownerless bylines were
-- adopted, and a rename now carries its bylines with it.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------- identities

-- Seven accounts, each wearing its wanted handle and its photograph —
-- the front door honoured the metadata rather than falling back.
do $$
declare p record;
begin
  for p in
    select v.handle, pr.id, pr.full_name, pr.avatar_url
    from (values ('hanoicrew'), ('saigonnights'), ('danangcrew'), ('quietcorners'),
                 ('citycrew'), ('foodmapvn'), ('saigoncaphe')) as v(handle)
    left join public.profiles pr on pr.handle = v.handle
  loop
    assert p.id is not null, format('%s has no profile', p.handle);
    assert p.id::text like '5eed0000-%', format('%s wears a foreign id: %s', p.handle, p.id);
    assert p.full_name <> '', format('%s has no name', p.handle);
    assert p.avatar_url like 'https://%', format('%s has no photograph', p.handle);
  end loop;
end $$;

-- The courier was emptied: the trigger strips the profile fields from
-- the metadata after use, for the desk exactly as for anyone.
do $$
declare still int;
begin
  select count(*) into still from auth.users
   where id::text like '5eed0000-%' and raw_user_meta_data <> '{}'::jsonb;
  assert still = 0, format('%s editorial accounts still carry metadata', still);
end $$;

-- ----------------------------------------------------------- reservations

-- The names stepped aside for one transaction and are reserved again,
-- reasons intact — a sign-up asking for one still falls back.
do $$
declare back int;
begin
  select count(*) into back from public.reserved_handles
   where reason = 'editorial'
     and handle in ('hanoicrew', 'saigonnights', 'danangcrew', 'quietcorners',
                    'citycrew', 'foodmapvn', 'saigoncaphe');
  assert back = 7, format('only %s of 7 editorial reservations came back', back);
end $$;

do $$
declare got text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-00000000000e', 'imp2@x.com', '{"handle":"saigoncaphe"}');
  select handle into got from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
  assert got <> 'saigoncaphe', 'an editorial handle was handed out after the seed';
end $$;

-- --------------------------------------------------------------- adoption

-- No public byline in the editorial set is ownerless any more.
do $$
declare orphan int;
begin
  select count(*) into orphan from public.collections
   where owner_id is null
     and curator_handle in ('hanoicrew', 'saigonnights', 'danangcrew', 'quietcorners',
                            'citycrew', 'foodmapvn', 'saigoncaphe');
  assert orphan = 0, format('%s editorial bylines still have no owner', orphan);
end $$;

-- ----------------------------------------------------------- rename sync

-- A rename carries its public bylines and leaves private rows alone —
-- the cure for the stale byline the migration also fixed.
do $$
declare h text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-00000000000f', 'ren@x.com', '{"handle":"renamebefore"}');

  insert into public.collections (slug, owner_id, is_public)
  values ('rename-public',  'aaaaaaaa-0000-0000-0000-00000000000f', true),
         ('rename-private', 'aaaaaaaa-0000-0000-0000-00000000000f', false);

  update public.profiles set handle = 'renameafter'
   where id = 'aaaaaaaa-0000-0000-0000-00000000000f';

  select curator_handle into h from public.collections where slug = 'rename-public';
  assert h = 'renameafter', format('the public byline did not follow the rename: %s', h);

  select curator_handle into h from public.collections where slug = 'rename-private';
  assert h is null, format('a private list grew a byline: %s', h);

  delete from public.collections where slug in ('rename-public', 'rename-private');
end $$;

select 'all editorial checks passed' as result;
