-- Photo scores, per scorer: the row names who read it, both the app's
-- old upsert and its new one land, and — until a second scorer exists —
-- a photograph still holds one row.
--
-- Runs after `photo_scores_test.sql`, which passing unchanged on the new
-- table is the first half of the proof: that file upserts `on conflict
-- (photo_id)`, as the phones before this change still do.
--
--   8888…  the editor `photo_scores_test.sql` grants and takes away again

insert into public.editors (email) values ('super@eg.test') on conflict do nothing;

insert into public.places (id, slug, city_id, is_published, review_status)
values ('f2000000-0000-0000-0000-000000000001', 'ps-scorer', 'hue', true, 'approved')
on conflict (slug) do nothing;
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values ('f2000000-0000-0000-0000-0000000000c1', 'f2000000-0000-0000-0000-000000000001', 'ps/scorer', 0, 'google', true)
on conflict do nothing;

-- ── the key is the pair ──────────────────────────────────────────────
do $$
begin
  assert (
    select array_agg(a.attname::text order by k.ord)
    from pg_constraint c
    cross join unnest(c.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.conname = 'photo_scores_pkey'
  ) = array['photo_id', 'scorer'], 'the key is not (photo_id, scorer)';
end $$;

do $$
begin
  set local role rls_client;
  set local test.uid = '88888888-8888-8888-8888-888888888888';
  set local test.jwt = '{"email": "super@eg.test"}';

  -- A row that names no scorer is Apple Vision's, as every row before
  -- this change was.
  insert into public.photo_scores (photo_id, scorer_version, aesthetic)
  values ('f2000000-0000-0000-0000-0000000000c1', 1, 0.2);
  assert (select scorer from public.photo_scores where photo_id = 'f2000000-0000-0000-0000-0000000000c1')
    = 'apple-vision', 'a row with no scorer was not taken as Apple Vision''s';

  -- (Quarters and halves: `aesthetic` is a real, and 0.6 as a real is
  -- not 0.6 as the numeric it is compared with.)
  -- The app's upsert from now on: its conflict target is the pair, and
  -- through RLS it rewrites the row it found.
  insert into public.photo_scores (photo_id, scorer, scorer_version, aesthetic)
  values ('f2000000-0000-0000-0000-0000000000c1', 'apple-vision', 2, 0.5)
  on conflict (photo_id, scorer) do update
    set scorer_version = excluded.scorer_version, aesthetic = excluded.aesthetic,
        scored_by = excluded.scored_by, scored_at = now();
  assert (select aesthetic from public.photo_scores where photo_id = 'f2000000-0000-0000-0000-0000000000c1') = 0.5,
    'an upsert on (photo_id, scorer) did not rewrite the row';

  -- The phones still on the old JavaScript: `on conflict (photo_id)`.
  insert into public.photo_scores (photo_id, scorer_version, aesthetic)
  values ('f2000000-0000-0000-0000-0000000000c1', 2, 0.75)
  on conflict (photo_id) do update set aesthetic = excluded.aesthetic;
  assert (select aesthetic from public.photo_scores where photo_id = 'f2000000-0000-0000-0000-0000000000c1') = 0.75,
    'the old upsert on (photo_id) stopped landing';
end $$;

-- ── what a scorer may be called ──────────────────────────────────────
do $$
begin
  begin
    update public.photo_scores set scorer = 'Apple Vision' where photo_id = 'f2000000-0000-0000-0000-0000000000c1';
    raise exception 'a scorer named outside lower-case-hyphenated was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.photo_scores set scorer = 'apple-' where photo_id = 'f2000000-0000-0000-0000-0000000000c1';
    raise exception 'a scorer name ending in a hyphen was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ── one row per photograph, until the second scorer ──────────────────
-- `photo_scores_one_per_photo` kept the old upsert working until the
-- second scorer (`20261017120000_photo_scores_second_scorer.sql`) dropped
-- it. run.sh applies that migration after this file, so this block still
-- holds the table as it stood between the two.
do $$
begin
  begin
    insert into public.photo_scores (photo_id, scorer, scorer_version)
    values ('f2000000-0000-0000-0000-0000000000c1', 'later-model', 1);
    raise exception 'a second scorer''s row was accepted while the old upsert still needs one per photograph';
  exception when unique_violation then null;
  end;
end $$;

delete from public.places where slug = 'ps-scorer';
delete from public.editors where email = 'super@eg.test';

select 'all per-scorer photo score checks passed' as result;
