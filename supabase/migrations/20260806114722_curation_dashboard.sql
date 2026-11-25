-- Applied on 6 Aug 2026 before this folder existed; copied from the live
-- history on 25 Nov 2026, byte for byte.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

-- Review workflow on places
alter table public.places
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'flagged')),
  add column review_note text,
  add column reviewed_at timestamptz;

-- Relax place_photos for user uploads; track source and visibility
alter table public.place_photos
  add column source text not null default 'google'
    check (source in ('google', 'upload')),
  add column is_hidden boolean not null default false,
  add column storage_path text;
alter table public.place_photos alter column photo_ref drop not null;
alter table public.place_photos
  add constraint place_photos_ref_required
    check (source <> 'google' or photo_ref is not null);

-- Dedupe guard for the photo-expansion script
create unique index place_photos_place_ref_uniq
  on public.place_photos (place_id, photo_ref) where photo_ref is not null;
