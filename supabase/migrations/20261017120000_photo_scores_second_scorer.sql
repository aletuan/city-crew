-- The second scorer arrives: Claude's photo labels (docs/photo-labels.md,
-- owner 17 Oct 2026), a row per photograph beside Apple Vision's, keyed
-- `(photo_id, 'claude-labels')`.
--
-- `20261016090000_photo_scores_per_scorer.sql` re-keyed the table on
-- (photo, scorer) and kept `unique (photo_id)` beside the new key, for one
-- reason: the JavaScript before that change upserted `on conflict
-- (photo_id)`, and Postgres refuses a conflict target with no unique
-- constraint on exactly it. That migration said the constraint goes with
-- the second scorer, "by which time those phones have moved on". They
-- have: the app has upserted on `(photo_id, scorer)` since the EAS Update
-- of 16 Oct, and every update since (through #849) carries it. A phone
-- that somehow has not taken one would see "Chấm ảnh" fail with an error
-- and work again on its next launch, which fetches the update.
--
-- Nothing else changes. The gallery already reads only the shown scorer's
-- row (`photo_scores.scorer` filter, app/src/lib/data/gallery.ts), so a
-- second row under a photograph is invisible to it until the app asks for
-- it by name. RLS asks about `photo_id`, which both rows share.
alter table public.photo_scores drop constraint if exists photo_scores_one_per_photo;

comment on table public.photo_scores is
  'A model''s reading of a place photograph: aesthetic score (−1..1, or null for a scorer that does not judge looks), utility flag, and that scorer''s own signals. One row per photograph per scorer; scored once per scorer_version. Scorers: apple-vision (on the phone), claude-labels (docs/photo-labels.md).';
