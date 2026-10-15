-- What the phone's own eye made of a photograph (owner, 15 Oct 2026).
--
-- ── what this is for ──
--
-- A gallery's "Chấm ảnh" button runs Apple's Vision framework on the
-- device over the photographs a place holds, and writes what it measured
-- here: Apple's aesthetic score, its "utility" flag (a menu, a receipt, a
-- screenshot), and the plainer measurements the explanation is built
-- from — light, sharpness, where the subject sits, tilt, people, text,
-- what the picture shows. The app turns these into the 0–10 on a tile
-- and the sentence under it; nothing is said that was not measured.
--
-- The same measurements are the start of the in-app camera the owner
-- has in mind, which will read them off a frame before it is taken.
--
-- ── one row per photograph, scored once ──
--
-- A photograph is scored once and kept: the button scores only the
-- photographs without a row, so adding two pictures to a gallery of
-- twelve costs two. `scorer_version` is what lets a later, better scorer
-- redo the old rows without guessing which ones it already did — a row
-- below the app's current version counts as unscored.
--
-- ── why the measurements are a jsonb ──
--
-- The two values the app sorts and labels by are columns: `aesthetic`,
-- Apple's overall score as given (−1 to 1, not the 0–10 shown, so the
-- mapping can be tuned without a rescore), and `is_utility`. The rest
-- (`signals`) is a bag whose keys `scorer_version` names, documented in
-- `app/src/lib/photoScore.ts`, which arrives with the scorer: the set
-- will grow as the explanation and the camera learn what they need, and
-- a column per measurement would be a migration per idea. `aesthetic` is null where the device cannot
-- give it (Apple's request needs iOS 18; the app hides the button below
-- it, but a future scorer may not).
--
-- ── who reads, who writes ──
--
-- Read by whoever can read the photograph: the policy asks
-- `place_photos` under the caller's own rules, so a hidden or
-- unpublished photograph's score is exactly as visible as the picture.
-- Written by whoever may manage the photograph (`guide_may_manage`: an
-- editor anywhere, a local guide on a place they submitted) — the same
-- hands that set the cover — and stamped with who scored it. A score is
-- advice to those hands, never applied by itself, which is why trusting
-- the device that measured it is acceptable.
--
-- Google's photographs are scored too, by the owner's decision. Note
-- `docs/tech-eval-app-store.md` C1: the catalog already keeps Google's
-- photographs longer than the Maps Platform terms allow, and a score is
-- one more thing derived from them.

create table if not exists public.photo_scores (
  photo_id       uuid primary key references public.place_photos(id) on delete cascade,
  scorer_version smallint not null check (scorer_version > 0),
  aesthetic      real check (aesthetic between -1 and 1),
  is_utility     boolean,
  signals        jsonb not null default '{}' check (jsonb_typeof(signals) = 'object'),
  scored_by      uuid default auth.uid() references auth.users(id) on delete set null,
  scored_at      timestamptz not null default now()
);

alter table public.photo_scores enable row level security;
grant select on table public.photo_scores to anon, authenticated;
grant insert, update, delete on table public.photo_scores to authenticated;

drop policy if exists "photo scores read with their photo" on public.photo_scores;
create policy "photo scores read with their photo" on public.photo_scores
  for select to anon, authenticated
  using (exists (select 1 from public.place_photos ph where ph.id = photo_id));

drop policy if exists "photo scores written by the photo's hands" on public.photo_scores;
create policy "photo scores written by the photo's hands" on public.photo_scores
  for insert to authenticated
  with check (public.guide_may_manage(photo_id) and scored_by = (select auth.uid()));

drop policy if exists "photo scores rewritten by the photo's hands" on public.photo_scores;
create policy "photo scores rewritten by the photo's hands" on public.photo_scores
  for update to authenticated
  using (public.guide_may_manage(photo_id))
  with check (public.guide_may_manage(photo_id) and scored_by = (select auth.uid()));

drop policy if exists "photo scores removed by the photo's hands" on public.photo_scores;
create policy "photo scores removed by the photo's hands" on public.photo_scores
  for delete to authenticated
  using (public.guide_may_manage(photo_id));

comment on table public.photo_scores is
  'Apple Vision''s reading of a place photograph, measured on a device: aesthetic score (−1..1), utility flag, and the signals the app''s explanation is built from. One row per photograph; scored once per scorer_version.';
