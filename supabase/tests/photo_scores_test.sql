-- Photo scores: written by the photograph's hands, read with the
-- photograph, scored once per version.
--
-- Run as `rls_client` (which holds `authenticated`), with `test.uid` for
-- who is asking and `test.jwt` for the email `is_editor()` reads:
--
--   8888…  an editor (from `editor_gallery_test.sql`), submitted nothing
--   1111…  a local guide, and the submitter of `ps-theirs`
--   3333…  a local guide who submitted nothing

grant select, insert, update, delete on public.photo_scores to rls_client;

-- The editor and the two guides `editor_gallery_test.sql` made; it takes
-- its editor away when it ends, so the grant is made again here.
insert into auth.users (id, email, raw_user_meta_data)
values ('88888888-8888-8888-8888-888888888888', 'super@eg.test', '{}')
on conflict do nothing;
insert into public.editors (email) values ('super@eg.test') on conflict do nothing;
insert into public.local_guides (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.places (id, slug, city_id, is_published, review_status, submitted_by)
values ('f1000000-0000-0000-0000-000000000001', 'ps-theirs', 'hue', true, 'approved',
        '11111111-1111-1111-1111-111111111111')
on conflict (slug) do nothing;
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values
  ('f1000000-0000-0000-0000-0000000000c1', 'f1000000-0000-0000-0000-000000000001', 'ps/one', 0, 'google', true),
  ('f1000000-0000-0000-0000-0000000000c2', 'f1000000-0000-0000-0000-000000000001', 'ps/two', 1, 'guide', false)
on conflict do nothing;

-- ── who may write ────────────────────────────────────────────────────
do $$
begin
  set local role rls_client;

  -- The guide who submitted the place scores its photograph, stamped as
  -- themselves by default.
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  set local test.jwt = '';
  insert into public.photo_scores (photo_id, scorer_version, aesthetic, is_utility, signals)
  values ('f1000000-0000-0000-0000-0000000000c1', 1, 0.42, false, '{"brightness": 0.61, "people": 0}');
  assert (select scored_by from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1')
    = '11111111-1111-1111-1111-111111111111', 'a score was not stamped with who scored it';

  -- …but not in somebody else's name.
  begin
    insert into public.photo_scores (photo_id, scorer_version, scored_by)
    values ('f1000000-0000-0000-0000-0000000000c2', 1, '33333333-3333-3333-3333-333333333333');
    raise exception 'a score was written in somebody else''s name';
  exception when insufficient_privilege then null;
  end;

  -- A guide who did not submit the place may not score it.
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    insert into public.photo_scores (photo_id, scorer_version) values ('f1000000-0000-0000-0000-0000000000c2', 1);
    raise exception 'a guide scored a photograph on a place they did not submit';
  exception when insufficient_privilege then null;
  end;
  -- …nor rewrite or remove one: the rows are simply not theirs to touch.
  update public.photo_scores set aesthetic = -1 where photo_id = 'f1000000-0000-0000-0000-0000000000c1';
  delete from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1';

  -- An editor scores anywhere, and may rescore under a new version.
  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';
  insert into public.photo_scores (photo_id, scorer_version, aesthetic)
  values ('f1000000-0000-0000-0000-0000000000c2', 1, 0.1);
  insert into public.photo_scores (photo_id, scorer_version, aesthetic)
  values ('f1000000-0000-0000-0000-0000000000c1', 2, 0.5)
  on conflict (photo_id) do update
    set scorer_version = excluded.scorer_version, aesthetic = excluded.aesthetic,
        scored_by = excluded.scored_by, scored_at = now();
end $$;

-- The guide's touch above changed nothing; the editor's rescore did.
do $$
begin
  assert (select count(*) from public.photo_scores where photo_id::text like 'f1000000%') = 2,
    'a score was lost or added where none should be';
  assert (select scorer_version from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1') = 2,
    'the editor''s rescore did not land';
  assert (select aesthetic from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1') = 0.5,
    'a guide who may not manage the photograph changed its score';
end $$;

-- ── what a row may hold ──────────────────────────────────────────────
do $$
begin
  begin
    insert into public.photo_scores (photo_id, scorer_version, aesthetic)
    values ('f1000000-0000-0000-0000-0000000000c2', 3, 1.5)
    on conflict (photo_id) do update set aesthetic = excluded.aesthetic;
    raise exception 'an aesthetic score outside Apple''s −1..1 was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.photo_scores set signals = '[1, 2]' where photo_id = 'f1000000-0000-0000-0000-0000000000c2';
    raise exception 'signals that are not an object were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.photo_scores set scorer_version = 0 where photo_id = 'f1000000-0000-0000-0000-0000000000c2';
    raise exception 'a scorer version of zero was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ── who may read ─────────────────────────────────────────────────────
-- As much as the photograph: hidden, its score is the gallery's hands'
-- alone — the submitter still reads it, a stranger does not.
update public.place_photos set is_hidden = true where id = 'f1000000-0000-0000-0000-0000000000c1';
do $$
begin
  set local role rls_client;
  set local test.jwt = '';
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  assert exists (select 1 from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c2'),
    'a stranger cannot read the score of a photograph they can see';
  assert not exists (select 1 from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1'),
    'a stranger read the score of a hidden photograph';
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  assert exists (select 1 from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c1'),
    'the submitter lost the score of their own hidden photograph';
end $$;
update public.place_photos set is_hidden = false where id = 'f1000000-0000-0000-0000-0000000000c1';

-- ── a score goes with its photograph ─────────────────────────────────
delete from public.place_photos where id = 'f1000000-0000-0000-0000-0000000000c2';
do $$
begin
  assert not exists (select 1 from public.photo_scores where photo_id = 'f1000000-0000-0000-0000-0000000000c2'),
    'a score outlived its photograph';
end $$;

delete from public.places where slug = 'ps-theirs';
delete from public.editors where email = 'super@eg.test';

select 'all photo score checks passed' as result;
