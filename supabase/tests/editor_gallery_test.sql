-- An editor keeps every gallery; nobody else gains anything.
--
-- Run as `rls_client`, with `test.uid` for who is asking and `test.jwt`
-- for the email `is_editor()` reads:
--
--   8888…  an editor — not a local guide, and submitted nothing
--   1111…  a local guide, and the submitter of `eg-theirs`
--   3333…  a local guide who submitted nothing
--
-- The editor is deliberately not a guide: the rule under test is the
-- desk's hand, and a guide grant must not be what makes it work.

grant usage on schema public, storage to rls_client;
grant select, insert, update, delete on public.places, public.place_photos to rls_client;
grant select on public.local_guides to rls_client;
grant select, insert on storage.objects to rls_client;

insert into auth.users (id, email, raw_user_meta_data)
values ('88888888-8888-8888-8888-888888888888', 'super@eg.test', '{}')
on conflict do nothing;
insert into public.editors (email) values ('super@eg.test') on conflict do nothing;
insert into public.local_guides (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.places (id, slug, city_id, is_published, review_status, submitted_by)
values ('e1000000-0000-0000-0000-000000000001', 'eg-theirs', 'hue', true, 'approved',
        '11111111-1111-1111-1111-111111111111')
on conflict (slug) do nothing;
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values
  ('e1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-000000000001', 'eg/one', 0, 'google', true),
  ('e1000000-0000-0000-0000-0000000000b2', 'e1000000-0000-0000-0000-000000000001', 'eg/two', 1, 'google', false);

-- ── who may manage a photograph ──────────────────────────────────────
do $$
begin
  set local role rls_client;

  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';
  assert public.guide_may_manage('e1000000-0000-0000-0000-0000000000b2'),
    'an editor cannot manage a photograph on a place somebody else imported';

  -- The same account without the editor's email is nobody in particular.
  set local test.jwt = '';
  assert not public.guide_may_manage('e1000000-0000-0000-0000-0000000000b2'),
    'the editor clause answered for somebody who is not an editor';

  -- Unchanged for guides: the submitter may, another guide may not.
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  assert public.guide_may_manage('e1000000-0000-0000-0000-0000000000b2'),
    'the guide who imported the place lost it';
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  assert not public.guide_may_manage('e1000000-0000-0000-0000-0000000000b2'),
    'a guide who did not import the place gained it';

  -- A photograph that does not exist is nobody's, editor or not.
  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';
  assert not public.guide_may_manage('e1000000-0000-0000-0000-0000000000ff'),
    'the editor clause answered for a photograph that is not there';
  reset role;
end $$;

-- ── the two RPCs, as the editor ──────────────────────────────────────
do $$
declare r record; refused bool := false;
begin
  set local role rls_client;
  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';
  perform public.guide_set_cover('e1000000-0000-0000-0000-0000000000b2');
  perform public.guide_set_hidden('e1000000-0000-0000-0000-0000000000b1', true);

  -- And refused the moment the email is not an editor's.
  set local test.jwt = '';
  begin
    perform public.guide_set_hidden('e1000000-0000-0000-0000-0000000000b1', false);
  exception when insufficient_privilege then refused := true;
  end;
  reset role;

  assert refused, 'guide_set_hidden went through for somebody who is neither editor nor submitter';
  select is_cover into r from public.place_photos where id = 'e1000000-0000-0000-0000-0000000000b2';
  assert r.is_cover, 'the editor''s cover did not take';
  select is_hidden, is_cover into r from public.place_photos where id = 'e1000000-0000-0000-0000-0000000000b1';
  assert r.is_hidden and not r.is_cover, 'the editor''s hide did not take';
end $$;

-- ── the file, before the row ──────────────────────────────────────
-- Not changed by the migration — `editors upload place photos` already
-- lets an editor file a picture — but it is the step the phone takes
-- first, so it is held here beside the rest: the editor may, and the same
-- account without the editor's email, being no guide either, may not.
do $$
declare refused_nobody bool := false;
begin
  set local role rls_client;
  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';
  insert into storage.objects (bucket_id, name)
  values ('place-photos', '88888888-8888-8888-8888-888888888888/eg-theirs-1.jpg');

  set local test.jwt = '';
  begin
    insert into storage.objects (bucket_id, name)
    values ('place-photos', '88888888-8888-8888-8888-888888888888/eg-theirs-2.jpg');
  exception when insufficient_privilege then refused_nobody := true;
  end;
  reset role;

  assert refused_nobody, 'somebody who is neither guide nor editor uploaded a place photo';
end $$;

delete from storage.objects where name like '88888888-8888-8888-8888-888888888888/%';
delete from public.place_photos where place_id = 'e1000000-0000-0000-0000-000000000001';
delete from public.places where slug = 'eg-theirs';
delete from public.editors where email = 'super@eg.test';

select 'all editor gallery checks passed' as result;
