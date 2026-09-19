-- A cover photograph that belongs to the city, not to one of its places.
--
-- Until now `cities.hero_place_slug` was the only way to dress the Explore
-- hero: it points at a place and the app draws that place's cover. That
-- works while the best picture of a city happens to be a picture of a
-- shop in it. Đà Lạt is where it stopped working — the hero line is the
-- town's old motto, and no café front says it.
--
-- One photo per city, replaced rather than collected: `hero_photo_path`
-- exists so the desk can delete the object it is replacing instead of
-- leaving it in the bucket. (Storage has form here — see the note at the
-- top of dashboard/src/storage.js about the 63 files that outlived their
-- places.)
--
-- Credit is not optional furniture. `place_photos` already carries
-- `attribution_name` / `attribution_uri` for every Google photo; a
-- photograph someone took and handed us deserves at least the same, and
-- the desk has nowhere to type it without these columns.

alter table public.cities
  add column if not exists hero_photo_uri        text,
  add column if not exists hero_photo_path       text,
  add column if not exists hero_photo_credit     text,
  add column if not exists hero_photo_credit_uri text;

comment on column public.cities.hero_photo_uri is
  'Public URL of the city cover. Takes precedence over hero_place_slug.';
comment on column public.cities.hero_photo_path is
  'Object path inside the place-photos bucket, so a replacement can delete the file it replaces.';
comment on column public.cities.hero_photo_credit is
  'Who took it — shown on the hero. Required by the desk whenever a photo is set.';
comment on column public.cities.hero_photo_credit_uri is
  'Where that credit links, if anywhere.';

-- Everything is nullable and nothing is backfilled: a city with no photo
-- falls through to hero_place_slug exactly as it does today.
