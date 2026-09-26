-- The columns a refresh of Google's data needs, and the memory it needs to
-- tell Google's values from the desk's.
--
-- Until now nothing asked Google about a place twice: the import copied
-- rating, review count, price level, opening hours, website, phone and
-- Google's summary once and kept them for good. Google Maps Platform's
-- terms keep a `place_id` indefinitely and the rest only for a while, and
-- the first rows date from 6 August. The `refresh-places` job asks again;
-- `supabase/functions/_shared/refresh-place.ts` says what it does with the
-- answer, and C1 in `docs/tech-eval-app-store.md` says why.
--
-- ── the five columns ──
--
--   google_refreshed_at  when Google last answered for this row. Null means
--                        never since import, which is what the job picks
--                        first.
--   business_status      Google's word for whether the place still trades
--                        (OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY),
--                        or NOT_FOUND when Google no longer knows the id. No
--                        check constraint: the value is Google's vocabulary,
--                        and a new word from Google must not fail the write
--                        that brings it.
--   google_summary       Google's one-line summary, kept fresh for the desk
--                        to reuse whether or not `desc_en` shows it.
--   google_website,      what Google last said. Nothing recorded whether a
--   google_phone         hand had changed `website` or `phone`, and a
--                        refresh must not undo that; with these, a value
--                        that still matches Google's follows it, and one
--                        that does not was edited and is left alone.
--
-- ── the backfill, and its one assumption ──
--
-- The memory starts from today's values, because the import wrote them from
-- Google. A website or phone a hand changed *before* this migration cannot
-- be told apart now: it will be taken for Google's, and followed the first
-- time Google's differs. From here on, edits are protected. Only rows never
-- refreshed are filled, so a second run of this file leaves the job's own
-- writes alone.
--
-- `google_summary` is filled where the desk has marked `desc_en` as Google's
-- words — the only rows whose text is known to be Google's.
--
-- ── `updated_at` ──
--
-- The stamping trigger (`20260821120000_stamp_updated_at.sql`) moves
-- `updated_at` on every update, so a refresh moves it too: it now means
-- "this row last changed", machine or hand. Nothing orders or filters places
-- by it today. Something that ever needs "the desk last edited this" should
-- compare it with `google_refreshed_at`, not read it alone.

alter table public.places
  add column if not exists google_refreshed_at timestamptz,
  add column if not exists business_status text,
  add column if not exists google_summary text,
  add column if not exists google_website text,
  add column if not exists google_phone text;

update public.places
   set google_website = website
 where google_refreshed_at is null and google_website is null and website is not null;

update public.places
   set google_phone = phone
 where google_refreshed_at is null and google_phone is null and phone is not null;

update public.places
   set google_summary = desc_en
 where google_refreshed_at is null and google_summary is null and reviewer_source = 'google';

-- What the job asks every run: the rows Google has answered for longest ago.
create index if not exists places_google_refresh_due
  on public.places (google_refreshed_at asc nulls first)
  where google_place_id is not null;
