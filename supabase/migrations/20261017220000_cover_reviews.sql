-- What the desk decided about a suggested cover (docs/photo-labels.md §11,
-- step 6A; owner, 17 Oct 2026).
--
-- ── what this is for ──
--
-- The photo labels name, for each place, the photographs that could make
-- a cover: an establishing view of the place, or — at a café or a place
-- to eat — the food. Where the cover is neither and another photograph
-- is, the desk's "Cover review" page puts the two side by side and an
-- editor answers: change the cover to the suggestion, or keep it.
--
-- Changing the cover is the cover's own write (`place_photos.is_cover`).
-- This table keeps the answer, for two reasons. A "keep" must stay
-- answered, or the same place comes back every time the page opens. And
-- the share of suggestions an editor takes is the measurement §11 asks
-- for before the suggestion is shown anywhere else: in the app, to guides.
--
-- ── one row per place ──
--
-- The latest answer only, keyed on the place: a place is asked again
-- when its cover changes after a "keep" (the page compares
-- `cover_photo_id` with the cover it sees), and asking again overwrites.
-- Earlier answers are not kept — what is measured is how the desk
-- answers a suggestion, not the history of one place.
--
-- The photograph columns go to null, not with the row, when a photograph
-- is deleted: the answer outlives the picture it was about.
--
-- Who answered and when are stamped by the database on every write, not
-- sent by the desk: an answer given again by a second editor is theirs,
-- and an upsert that leaves `decided_by` out would otherwise keep the
-- first editor's name on it — and fail its own policy.
--
-- ── who reads, who writes ──
--
-- Editors only, both ways. A local guide manages their own places'
-- covers from the app, but this is the desk's queue and the desk's
-- measurement; nothing in the app reads it.

create table if not exists public.cover_reviews (
  place_id           uuid primary key references public.places(id) on delete cascade,
  cover_photo_id     uuid references public.place_photos(id) on delete set null,
  suggested_photo_id uuid references public.place_photos(id) on delete set null,
  decision           text not null check (decision in ('changed', 'kept')),
  decided_by         uuid default auth.uid() references auth.users(id) on delete set null,
  decided_at         timestamptz not null default now()
);

create or replace function public.cover_reviews_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end
$$;

drop trigger if exists cover_reviews_stamp on public.cover_reviews;
create trigger cover_reviews_stamp
  before insert or update on public.cover_reviews
  for each row execute function public.cover_reviews_stamp();

alter table public.cover_reviews enable row level security;
grant select, insert, update on table public.cover_reviews to authenticated;

drop policy if exists "cover reviews read by editors" on public.cover_reviews;
create policy "cover reviews read by editors" on public.cover_reviews
  for select to authenticated
  using (public.is_editor());

drop policy if exists "cover reviews answered by editors" on public.cover_reviews;
create policy "cover reviews answered by editors" on public.cover_reviews
  for insert to authenticated
  with check (public.is_editor() and decided_by = (select auth.uid()));

drop policy if exists "cover reviews answered again by editors" on public.cover_reviews;
create policy "cover reviews answered again by editors" on public.cover_reviews
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor() and decided_by = (select auth.uid()));

comment on table public.cover_reviews is
  'The desk''s latest answer to a suggested cover: changed to the suggestion, or kept. One row per place; read and written by editors. docs/photo-labels.md §11.';
