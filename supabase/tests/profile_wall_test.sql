-- The cover a person chooses (20261121120000_profile_wall): what the owner
-- may write into `wall_kind`/`wall_ref`, and the desk taking it down.
--
--   …0a  the owner
--   …0b  somebody else, whose upload the owner must not borrow
--   …0e  the desk

grant usage on schema public to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d2e00000-0000-0000-0000-00000000000a', 'wall-a@x.com', '{"handle":"wallowner"}'),
 ('d2e00000-0000-0000-0000-00000000000b', 'wall-b@x.com', '{"handle":"wallother"}'),
 ('d2e00000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"walldesk"}')
on conflict (id) do nothing;

-- ── what the owner may write ──
do $$
declare
  base constant text := 'https://amdvitzpogaejzzqroco.supabase.co/storage/v1/object/public/avatars/';
  me constant uuid := 'd2e00000-0000-0000-0000-00000000000a';
  ok text[][] := array[
    array['city', 'hanoi'],
    array['collection', 'd2e00000-0000-0000-0000-0000000000c1'],
    array['upload', base || 'd2e00000-0000-0000-0000-00000000000a/wall.jpg?v=1732170000']
  ];
  bad text[][] := array[
    -- a kind with nothing named, and a name with no kind
    array['city', null],
    array[null, 'hanoi'],
    array['sky', 'hanoi'],
    array['city', 'Hà Nội'],
    array['collection', 'not-a-list'],
    -- somebody else's upload, a page elsewhere, and the right path on
    -- another host
    array['upload', base || 'd2e00000-0000-0000-0000-00000000000b/wall.jpg'],
    array['upload', 'https://example.com/wall.jpg'],
    array['upload', 'https://evil.example/storage/v1/object/public/avatars/d2e00000-0000-0000-0000-00000000000a/wall.jpg'],
    -- the owner's own avatar is not a cover
    array['upload', base || 'd2e00000-0000-0000-0000-00000000000a/avatar.jpg']
  ];
  i int;
begin
  set local role rls_client;
  set local test.uid = 'd2e00000-0000-0000-0000-00000000000a';
  set local test.jwt = '{"email": "wall-a@x.com"}';
  for i in 1 .. array_length(ok, 1) loop
    update public.profiles set wall_kind = ok[i][1], wall_ref = ok[i][2] where id = me;
    assert found, format('the owner could not set %s', ok[i][1]);
  end loop;
  for i in 1 .. array_length(bad, 1) loop
    begin
      update public.profiles set wall_kind = bad[i][1], wall_ref = bad[i][2] where id = me;
      assert false, format('the owner set %s / %s', bad[i][1], bad[i][2]);
    exception when check_violation then null;
    end;
  end loop;
  -- Back to automatic.
  update public.profiles set wall_kind = null, wall_ref = null where id = me;
  assert found, 'the owner could not go back to automatic';
  -- And not someone else's row: RLS, untouched by this migration.
  update public.profiles set wall_kind = 'city', wall_ref = 'hanoi'
   where id = 'd2e00000-0000-0000-0000-00000000000b';
  assert not found, 'the owner set somebody else''s cover';
  reset role;
end $$;

-- ── the desk takes a cover down, and says so ──
do $$
declare r record; n int;
begin
  update public.profiles set wall_kind = 'city', wall_ref = 'hanoi', bio = 'kept'
   where id = 'd2e00000-0000-0000-0000-00000000000a';
  delete from public.moderation_log;

  set local role rls_client;
  set local test.uid = 'd2e00000-0000-0000-0000-00000000000b';
  set local test.jwt = '{"email": "wall-b@x.com"}';
  begin
    perform public.moderate_profile('d2e00000-0000-0000-0000-00000000000a', clear_wall => true);
    assert false, 'a reader took a cover down';
  exception when raise_exception then null;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = 'd2e00000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  perform public.moderate_profile('d2e00000-0000-0000-0000-00000000000a', clear_wall => true);
  reset role;

  select * into r from public.profiles where id = 'd2e00000-0000-0000-0000-00000000000a';
  assert r.wall_kind is null and r.wall_ref is null,
    format('the cover is still %s / %s', r.wall_kind, r.wall_ref);
  assert r.bio = 'kept', 'taking the cover down blanked the bio';
  select count(*) into n from public.moderation_log;
  assert n = 1, format('expected one line, found %s', n);
  select * into r from public.moderation_log;
  assert r.detail = '{"bio": false, "avatar": false, "name": false, "wall": true}'::jsonb,
    format('clear_profile recorded %s', r.detail);
end $$;

-- ── one function, closed to the signed-out ──
do $$
declare n int;
begin
  select count(*) into n from pg_proc where proname = 'moderate_profile'
    and pronamespace = 'public'::regnamespace;
  assert n = 1, format('%s moderate_profile functions', n);
  assert not has_function_privilege('anon',
    'public.moderate_profile(uuid, boolean, boolean, boolean, boolean)', 'execute'),
    'moderate_profile is open to anon';
end $$;
