-- Photo scores, second scorer: two rows under one photograph, each
-- rewritten by its own upsert, and the one-per-photograph rule gone.
--
-- Runs after both earlier photo score tests, which hold the table as it
-- was: this file is the proof that the migration that follows them
-- changes only what it says.

insert into public.places (id, slug, city_id, is_published, review_status)
values ('f3000000-0000-0000-0000-000000000001', 'ps-second', 'hue', true, 'approved')
on conflict (slug) do nothing;
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values ('f3000000-0000-0000-0000-0000000000c1', 'f3000000-0000-0000-0000-000000000001', 'ps/second', 0, 'google', true)
on conflict do nothing;

do $$
begin
  assert not exists (select 1 from pg_constraint where conname = 'photo_scores_one_per_photo'),
    'photo_scores_one_per_photo is still there';

  insert into public.photo_scores (photo_id, scorer, scorer_version, aesthetic)
  values ('f3000000-0000-0000-0000-0000000000c1', 'apple-vision', 1, 0.5);

  -- The labels' row, as the skill writes it: no looks score, nobody's
  -- name on it (it is written through MCP, not as a user), and the
  -- labels in `signals`.
  insert into public.photo_scores (photo_id, scorer, scorer_version, aesthetic, is_utility, scored_by, signals)
  values ('f3000000-0000-0000-0000-0000000000c1', 'claude-labels', 1, null, null, null,
          '{"v": 1, "kind": "exterior", "brand": true}')
  on conflict (photo_id, scorer) do update set signals = excluded.signals, scorer_version = excluded.scorer_version;

  assert (select count(*) from public.photo_scores where photo_id = 'f3000000-0000-0000-0000-0000000000c1') = 2,
    'a photograph could not hold a row from each scorer';

  -- Relabelled: its own row rewritten, Apple Vision's left alone.
  insert into public.photo_scores (photo_id, scorer, scorer_version, signals)
  values ('f3000000-0000-0000-0000-0000000000c1', 'claude-labels', 1, '{"v": 1, "kind": "interior"}')
  on conflict (photo_id, scorer) do update set signals = excluded.signals;
  assert (select signals->>'kind' from public.photo_scores
          where photo_id = 'f3000000-0000-0000-0000-0000000000c1' and scorer = 'claude-labels') = 'interior',
    'a relabel did not rewrite the labels'' row';
  assert (select aesthetic from public.photo_scores
          where photo_id = 'f3000000-0000-0000-0000-0000000000c1' and scorer = 'apple-vision') = 0.5,
    'a relabel touched Apple Vision''s row';

  -- The old upsert target is gone with the constraint: what a phone
  -- still on the 15 Oct JavaScript would meet, said here so it is known.
  begin
    insert into public.photo_scores (photo_id, scorer_version, aesthetic)
    values ('f3000000-0000-0000-0000-0000000000c1', 1, 0.25)
    on conflict (photo_id) do update set aesthetic = excluded.aesthetic;
    raise exception 'an upsert on (photo_id) alone still found a constraint to land on';
  exception when invalid_column_reference then null;
  end;
end $$;

-- Deleting the photograph takes both rows with it.
delete from public.places where slug = 'ps-second';
do $$
begin
  assert not exists (select 1 from public.photo_scores where photo_id = 'f3000000-0000-0000-0000-0000000000c1'),
    'a deleted photograph left a score behind';
end $$;

select 'all second-scorer photo score checks passed' as result;
