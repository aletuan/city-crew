-- The gallery a guide may keep, exercised from the outside.
--
-- Three definer functions open a door that row security could not, and a
-- door is worth walking through as the wrong person. Everything here runs
-- as `rls_client` with `test.uid` for who is asking:
--
--   1111…  a local guide, and the submitter of `gal-mine`
--   3333…  a local guide who submitted nothing
--   9999…  an editor, for the desk's own hand

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.places, public.place_photos to rls_client;
grant select on public.local_guides to rls_client;

insert into public.local_guides (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- The desk's hand. `is_editor()` reads an email out of the JWT, so the
-- editor is seeded by email and the desk block below sets `test.jwt`. The
-- account has to exist too: `hidden_by` is a foreign key to it.
insert into auth.users (id, email, raw_user_meta_data)
values ('99999999-9999-9999-9999-999999999999', 'desk@gal.test', '{}')
on conflict do nothing;
insert into public.editors (email) values ('desk@gal.test') on conflict do nothing;

insert into public.places (id, slug, city_id, is_published, review_status, submitted_by)
values ('f1000000-0000-0000-0000-000000000001', 'gal-mine', 'hanoi', true, 'approved',
        '11111111-1111-1111-1111-111111111111')
on conflict (slug) do nothing;

-- Four photographs, one of each kind the boundary distinguishes.
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, uploaded_by, is_cover)
values
  ('f1000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000001', 'gal/google-cover', 0, 'google', null, true),
  ('f1000000-0000-0000-0000-0000000000a2', 'f1000000-0000-0000-0000-000000000001', 'gal/google-2',     1, 'google', null, false),
  ('f1000000-0000-0000-0000-0000000000a3', 'f1000000-0000-0000-0000-000000000001', 'gal/desk',         2, 'upload', null, false),
  ('f1000000-0000-0000-0000-0000000000a4', 'f1000000-0000-0000-0000-000000000001', 'gal/mine',         3, 'upload', '11111111-1111-1111-1111-111111111111', false);

-- The insert trigger just made the guide's upload the cover. Put it back
-- on the Google row so the tests below start from the desk's world.
update public.place_photos set is_cover = (id = 'f1000000-0000-0000-0000-0000000000a1')
 where place_id = 'f1000000-0000-0000-0000-000000000001';

-- ── the boundary, read directly ──────────────────────────────────────
do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  assert public.guide_may_manage('f1000000-0000-0000-0000-0000000000a4'), 'own upload should be manageable';
  assert public.guide_may_manage('f1000000-0000-0000-0000-0000000000a1'), 'an imported photo should be manageable';
  assert not public.guide_may_manage('f1000000-0000-0000-0000-0000000000a3'), 'the desk''s upload must not be';
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  assert not public.guide_may_manage('f1000000-0000-0000-0000-0000000000a1'), 'a guide who did not submit the place may not manage it';
  reset role;
end $$;

-- ── the cover ────────────────────────────────────────────────────────
do $$
declare c int; holder uuid; ok boolean;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';

  perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a2');
  select count(*) into c from public.place_photos
   where place_id = 'f1000000-0000-0000-0000-000000000001' and is_cover;
  select id into holder from public.place_photos
   where place_id = 'f1000000-0000-0000-0000-000000000001' and is_cover;
  assert c = 1, format('setting a cover left %s of them', c);
  assert holder = 'f1000000-0000-0000-0000-0000000000a2', format('the cover is on %s', holder);

  -- The desk's upload is view-only, even for the cover.
  begin
    perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a3');
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide set the desk''s upload as cover';

  -- And the wrong guide is refused outright.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a1');
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide who did not submit the place set its cover';
  reset role;
end $$;

-- ── hiding, and the veto ─────────────────────────────────────────────
do $$
declare r record; ok boolean;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';

  -- Hiding the current cover clears the flag with it. Read back still as
  -- the guide: a hidden photograph on their own place has to be visible
  -- to them, or there is nothing on the screen to unhide.
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a2', true);
  select is_hidden, is_cover, hidden_by into r from public.place_photos
   where id = 'f1000000-0000-0000-0000-0000000000a2';
  assert r.is_hidden, 'the photograph was not hidden, or the guide cannot see their own hidden rows';
  assert not r.is_cover, 'a hidden photograph kept the cover';
  assert r.hidden_by = '11111111-1111-1111-1111-111111111111', format('hidden_by is %s', r.hidden_by);

  -- Their own hide, they may undo.
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a2', false);
  select is_hidden, hidden_by into r from public.place_photos
   where id = 'f1000000-0000-0000-0000-0000000000a2';
  assert not r.is_hidden, 'the guide could not unhide their own hide';
  assert r.hidden_by is null, format('hidden_by was not cleared: %s', r.hidden_by);

  -- The desk's upload cannot be hidden by the guide at all.
  begin
    perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a3', true);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide hid the desk''s upload';
  reset role;
end $$;

-- The desk hides one. Written as an editor would from the dashboard — a
-- plain update, no function — so what is being tested is the trigger's
-- stamp and the veto that reads it, not a path the desk does not use.
do $$
begin
  set local role rls_client;
  set local test.uid = '99999999-9999-9999-9999-999999999999';
  set local test.jwt = '{"email": "desk@gal.test"}';
  update public.place_photos set is_hidden = true where id = 'f1000000-0000-0000-0000-0000000000a1';
  set local test.jwt = '';
  reset role;
end $$;

do $$
declare r record; ok boolean; seen int;
begin
  select is_hidden, hidden_by into r from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a1';
  assert r.is_hidden and r.hidden_by = '99999999-9999-9999-9999-999999999999',
    format('the desk''s hide was not stamped: hidden=%s by=%s', r.is_hidden, r.hidden_by);

  -- The submitter sees it, hidden. Anybody else does not see it at all.
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select count(*) into seen from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a1';
  assert seen = 1, 'the submitter cannot see a photograph the desk hid on their own place';
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  select count(*) into seen from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a1';
  assert seen = 0, 'a hidden photograph leaked to somebody who did not submit the place';
  reset role;

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  begin
    perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a1', false);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide unhid a photograph the desk had hidden';

  -- And a hidden photograph cannot be made the cover.
  begin
    perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a1');
    ok := true;
  exception when check_violation then ok := false;
  end;
  assert not ok, 'a hidden photograph became the cover';
  reset role;
end $$;

-- ── the order ────────────────────────────────────────────────────────
do $$
declare got text; ok boolean;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';

  -- The whole gallery, desk row included: it moves, it does not change.
  perform public.guide_reorder_photos('f1000000-0000-0000-0000-000000000001', array[
    'f1000000-0000-0000-0000-0000000000a4',
    'f1000000-0000-0000-0000-0000000000a3',
    'f1000000-0000-0000-0000-0000000000a1',
    'f1000000-0000-0000-0000-0000000000a2']::uuid[]);
  select string_agg(photo_uri, ',' order by sort_order) into got
    from public.place_photos where place_id = 'f1000000-0000-0000-0000-000000000001';
  assert got = 'gal/mine,gal/desk,gal/google-cover,gal/google-2', format('order came out as %s', got);

  -- A partial list is refused, and so is one with a stranger in it.
  begin
    perform public.guide_reorder_photos('f1000000-0000-0000-0000-000000000001', array[
      'f1000000-0000-0000-0000-0000000000a1',
      'f1000000-0000-0000-0000-0000000000a2']::uuid[]);
    ok := true;
  exception when check_violation then ok := false;
  end;
  assert not ok, 'a partial order was accepted';

  begin
    perform public.guide_reorder_photos('f1000000-0000-0000-0000-000000000001', array[
      'f1000000-0000-0000-0000-0000000000a4',
      'f1000000-0000-0000-0000-0000000000a3',
      'f1000000-0000-0000-0000-0000000000a1',
      'e1000000-0000-0000-0000-0000000000ff']::uuid[]);
    ok := true;
  exception when check_violation then ok := false;
  end;
  assert not ok, 'an order naming another place''s photograph was accepted';

  -- The wrong guide cannot order it at all.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    perform public.guide_reorder_photos('f1000000-0000-0000-0000-000000000001', array[
      'f1000000-0000-0000-0000-0000000000a1',
      'f1000000-0000-0000-0000-0000000000a2',
      'f1000000-0000-0000-0000-0000000000a3',
      'f1000000-0000-0000-0000-0000000000a4']::uuid[]);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide ordered a place they did not submit';
  reset role;
end $$;

-- ── shut to the signed-out ───────────────────────────────────────────
do $$
begin
  assert not has_function_privilege('anon', 'public.guide_set_cover(uuid)', 'execute'), 'guide_set_cover is open to anon';
  assert not has_function_privilege('anon', 'public.guide_set_hidden(uuid, boolean)', 'execute'), 'guide_set_hidden is open to anon';
  assert not has_function_privilege('anon', 'public.guide_reorder_photos(uuid, uuid[])', 'execute'), 'guide_reorder_photos is open to anon';
  assert not has_function_privilege('anon', 'public.guide_may_manage(uuid)', 'execute'), 'guide_may_manage is open to anon';
  assert has_function_privilege('authenticated', 'public.guide_set_cover(uuid)', 'execute'), 'guide_set_cover is closed to readers';
end $$;

-- Leave the bench as it was found.
delete from public.place_photos where photo_uri like 'gal/%';
delete from public.places where slug = 'gal-mine';
delete from public.local_guides where user_id in (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');
delete from public.editors where email = 'desk@gal.test';
delete from auth.users where id = '99999999-9999-9999-9999-999999999999';

select 'all gallery rpc checks passed' as result;
