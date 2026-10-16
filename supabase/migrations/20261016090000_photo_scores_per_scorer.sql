-- A photograph's score, kept per scorer (owner, 16 Oct 2026).
--
-- ── what changes ──
--
-- `photo_scores` was one row per photograph, keyed on `photo_id`, and
-- which model had read it was implied: Apple Vision, because there was
-- no other. The owner asked whether a different or a second scorer could
-- be added later — a model on a server, a later Apple model, one that
-- reads a frame in the camera — and the answer was "not without changing
-- this table", because a second reading of the same photograph had
-- nowhere to go. So the row now names its scorer, and the key is the
-- pair: one reading per photograph per scorer.
--
-- The 265 rows here when this was applied (16 Oct 2026) are Apple
-- Vision's and take that name from the default; nothing is read again.
--
-- ── what a scorer promises ──
--
-- `aesthetic` and `is_utility` keep their names. They are not Apple's
-- words but the contract every scorer meets: one overall number on −1…1
-- (the check already holds it there), and "this is a record, not a
-- picture" or null where a scorer has no opinion. Everything a scorer
-- measures beyond that is its own `signals`. Renaming the two columns to
-- something neutral was weighed and left: it buys a word, and costs a
-- rewrite of every reader in the same moment as the phones that still
-- run the old one.
--
-- ── the constraint that stays, for now ──
--
-- `unique (photo_id)` is kept beside the new key, and it is what still
-- holds the table to one row per photograph. Phones keep the JavaScript
-- they have until an EAS Update reaches them, and the JavaScript before
-- this change upserts with `on conflict (photo_id)`; Postgres refuses
-- that conflict target without a unique constraint on exactly that
-- column, so dropping it today would turn every one of those phones'
-- "Chấm ảnh" into an error. It goes in the migration that brings the
-- second scorer, by which time those phones have moved on.
--
-- RLS is unchanged: every policy asks about `photo_id`, which a second
-- scorer's row shares with the first.

alter table public.photo_scores
  add column if not exists scorer text not null default 'apple-vision';

do $$
begin
  -- A name, lower case and hyphenated, as the app's registry keys it:
  -- free text here would let 'Apple Vision' and 'apple-vision' be two
  -- scorers of one photograph.
  if not exists (select 1 from pg_constraint where conname = 'photo_scores_scorer_name') then
    alter table public.photo_scores
      add constraint photo_scores_scorer_name check (scorer ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;

  -- The transitional one first, so the table is never without a
  -- one-per-photograph guarantee between the two statements below.
  if not exists (select 1 from pg_constraint where conname = 'photo_scores_one_per_photo') then
    alter table public.photo_scores
      add constraint photo_scores_one_per_photo unique (photo_id);
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conname = 'photo_scores_pkey'
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.photo_scores'::regclass and attname = 'photo_id'),
        (select attnum from pg_attribute where attrelid = 'public.photo_scores'::regclass and attname = 'scorer')
      ]::smallint[]
  ) then
    alter table public.photo_scores drop constraint photo_scores_pkey;
    alter table public.photo_scores add constraint photo_scores_pkey primary key (photo_id, scorer);
  end if;
end $$;

comment on column public.photo_scores.scorer is
  'Which model read the photograph, as the app''s scorer registry names it (''apple-vision''). scorer_version counts within it.';
comment on table public.photo_scores is
  'A model''s reading of a place photograph: aesthetic score (−1..1), utility flag, and that scorer''s own signals. One row per photograph per scorer; scored once per scorer_version. Held to one row per photograph by photo_scores_one_per_photo until a second scorer exists.';
