-- How many new Google reviews a place gains in thirty days, measured by the
-- refresh job between its last two visits.
--
-- TripAdvisor ranks by quality, quantity and recency (owner, 28 Oct 2026:
-- step 2 of 3). Explore has the first two; this is the measurement the
-- third needs, and it changes no order by itself. The ranking reads it once
-- a month of it exists.
--
-- ── why one column, not a table of snapshots ──
--
-- `refresh-places` writes a new `rating_count` over the old one about every
-- 25 days per place, never daily (`refresh-places/cron.sql`). So at each
-- refresh the row already holds the one earlier reading the difference
-- needs, with its date in `google_refreshed_at`. `_shared/refresh-place.ts`
-- takes the difference before it overwrites them and keeps only the result.
-- A dated table of counts, pruned at 30 days, was the first plan; it would
-- have kept a second copy of Google's numbers (C1 in
-- `docs/tech-eval-app-store.md`) and a pruning job, to say what this says
-- in one number.
--
-- ── what the number looks like ──
--
-- Twenty Hồ Chí Minh City places whose counts the 6 August import recorded
-- (`data/snapshot/citycrew-data.json`) and October's refresh re-read gained
-- 8 (Carmen Bar) to 483 (Independence Palace) reviews per 30 days. That
-- sixty-fold spread is why the ranking will read it on a log scale.
--
-- Null until a place has had two refreshes at least 20 days apart, and
-- again when Google stops giving a count. It can be negative: Google
-- removes reviews, and the number says so rather than rounding it away.

alter table public.places
  add column if not exists review_pace real;

comment on column public.places.review_pace is
  'New Google reviews per 30 days between the last two refreshes; written by refresh-places.';
