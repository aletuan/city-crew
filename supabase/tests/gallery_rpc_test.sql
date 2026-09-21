-- The gallery a guide may keep, exercised from the outside.
--
-- Two definer functions and one policy open a door that row security
-- could not, and a door is worth walking through as the wrong person.
-- Everything here runs as `rls_client` with `test.uid` for who is asking:
--
--   1111…  a local guide, and the submitter of `gal-mine`
--   3333…  a local guide who submitted nothing
--   9999…  an editor, for the desk's own hand
--
-- The rule under test is the plain one: on a place the guide brought in,
-- the guide and the desk may do the same things to any photograph, and
-- whoever acts last wins.

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

-- Four photographs, one of each kind there is — and the point is that
-- the kind no longer matters.
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
  assert public.guide_may_manage('f1000000-0000-0000-0000-0000000000a3'), 'the desk''s upload should be manageable too';
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

  -- The desk's upload is the guide's to choose as well.
  perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a3');
  select id into holder from public.place_photos
   where place_id = 'f1000000-0000-0000-0000-000000000001' and is_cover;
  assert holder = 'f1000000-0000-0000-0000-0000000000a3', 'a guide could not make the desk''s upload the cover';

  -- The wrong guide is refused outright.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a1');
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide who did not submit the place set its cover';
  reset role;
end $$;

-- ── hiding ───────────────────────────────────────────────────────────
do $$
declare r record; ok boolean;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';

  -- Hiding the current cover clears the flag with it. Read back still as
  -- the guide: a hidden photograph on their own place has to be visible
  -- to them, or there is nothing on the screen to unhide.
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a3', true);
  select is_hidden, is_cover, hidden_by into r from public.place_photos
   where id = 'f1000000-0000-0000-0000-0000000000a3';
  assert r.is_hidden, 'the photograph was not hidden, or the guide cannot see their own hidden rows';
  assert not r.is_cover, 'a hidden photograph kept the cover';
  assert r.hidden_by = '11111111-1111-1111-1111-111111111111', format('hidden_by is %s', r.hidden_by);

  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a3', false);
  select is_hidden, hidden_by into r from public.place_photos
   where id = 'f1000000-0000-0000-0000-0000000000a3';
  assert not r.is_hidden, 'the guide could not unhide';
  assert r.hidden_by is null, format('hidden_by was not cleared: %s', r.hidden_by);

  -- The wrong guide cannot hide anything here.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a1', true);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  assert not ok, 'a guide hid a photograph on a place they did not submit';
  reset role;
end $$;

-- ── last hand wins ───────────────────────────────────────────────────
--
-- The desk hides one, as an editor would from the dashboard — a plain
-- update, no function. The guide then shows it again, and may: there is
-- no veto. Then the guide hides it and the desk shows it, the other way
-- round, so the rule is seen to be symmetric rather than assumed.
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
declare r record; seen int;
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

  -- The guide shows it again. No veto.
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a1', false);
  reset role;
  select is_hidden into r from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a1';
  assert not r.is_hidden, 'the guide could not show again what the desk hid';

  -- And the other way round.
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a1', true);
  set local test.uid = '99999999-9999-9999-9999-999999999999';
  set local test.jwt = '{"email": "desk@gal.test"}';
  update public.place_photos set is_hidden = false where id = 'f1000000-0000-0000-0000-0000000000a1';
  set local test.jwt = '';
  reset role;
  select is_hidden into r from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a1';
  assert not r.is_hidden, 'the desk could not show again what the guide hid';
end $$;

-- A hidden photograph cannot be made the cover.
do $$
declare ok boolean;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  perform public.guide_set_hidden('f1000000-0000-0000-0000-0000000000a2', true);
  begin
    perform public.guide_set_cover('f1000000-0000-0000-0000-0000000000a2');
    ok := true;
  exception when check_violation then ok := false;
  end;
  assert not ok, 'a hidden photograph became the cover';
  reset role;
end $$;

-- ── delete, any photograph on the place ──────────────────────────────
do $$
declare left_over int;
begin
  set local role rls_client;

  -- The wrong guide deletes nothing, and RLS answers with silence. The
  -- count is taken as the runner: as the guide it would be the public
  -- read policy's answer, which leaves out a hidden row and would fail
  -- this for the wrong reason.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  delete from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000a3';
  reset role;
  select count(*) into left_over from public.place_photos where photo_uri like 'gal/%';
  assert left_over = 4, format('a guide deleted from a place they did not submit: %s rows left', left_over);

  -- The submitter deletes the desk's upload and a Google row alike.
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  delete from public.place_photos where id in (
    'f1000000-0000-0000-0000-0000000000a3', 'f1000000-0000-0000-0000-0000000000a2');
  reset role;
  select count(*) into left_over from public.place_photos where photo_uri like 'gal/%';
  assert left_over = 2, format('the guide could not delete the desk''s and Google''s rows: %s left', left_over);
end $$;

-- ── shut to the signed-out, and the order gone ───────────────────────
do $$
begin
  assert not has_function_privilege('anon', 'public.guide_set_cover(uuid)', 'execute'), 'guide_set_cover is open to anon';
  assert not has_function_privilege('anon', 'public.guide_set_hidden(uuid, boolean)', 'execute'), 'guide_set_hidden is open to anon';
  assert not has_function_privilege('anon', 'public.guide_may_manage(uuid)', 'execute'), 'guide_may_manage is open to anon';
  assert has_function_privilege('authenticated', 'public.guide_set_cover(uuid)', 'execute'), 'guide_set_cover is closed to readers';
  assert not exists (select 1 from pg_proc where proname = 'guide_reorder_photos'), 'guide_reorder_photos is still there';
end $$;

-- Leave the bench as it was found.
delete from public.place_photos where photo_uri like 'gal/%';
delete from public.places where slug = 'gal-mine';
delete from public.local_guides where user_id in (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');
delete from public.editors where email = 'desk@gal.test';
delete from auth.users where id = '99999999-9999-9999-9999-999999999999';

select 'all gallery rpc checks passed' as result;
