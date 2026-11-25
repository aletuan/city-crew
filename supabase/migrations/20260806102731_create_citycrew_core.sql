-- The first schema, applied to the live project on 6 Aug 2026 before
-- this folder existed. Copied here on 25 Nov 2026 from the live
-- migration history, byte for byte (md5 checked), so the repo holds
-- the tables every later file alters.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

-- cityCrew demo dataset: core schema
-- places: bilingual EN/VI place entities sourced from Google Places API + manual curation

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  google_place_id text unique,
  name_en text not null,
  name_vi text not null,
  category text not null check (category in ('food', 'out')),
  is_featured boolean not null default false,
  vibe_tags text[] not null default '{}'
    check (vibe_tags <@ array['cafes','food_tour','outdoors','views','culture','shopping','nightlife','chill']),
  neighborhood_en text,
  neighborhood_vi text,
  address text,
  lat double precision,
  lng double precision,
  rating numeric(2,1),
  rating_count integer,
  price_level text,
  price_display text,
  price_vnd integer,
  duration_min smallint,
  duration_max smallint,
  desc_en text,
  desc_vi text,
  emoji text,
  opening_hours jsonb,
  website text,
  phone text,
  saved_count integer not null default 0,
  sort_order integer,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  photo_ref text not null,
  photo_uri text,
  width_px integer,
  height_px integer,
  attribution_name text,
  attribution_uri text,
  sort_order integer not null default 0,
  is_cover boolean not null default false
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_vi text not null,
  desc_en text,
  desc_vi text,
  curator_handle text,
  cover_photo_id uuid references public.place_photos (id) on delete set null,
  is_public boolean not null default true,
  sort_order integer
);

create table public.collection_places (
  collection_id uuid not null references public.collections (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, place_id)
);

create index place_photos_place_id_idx on public.place_photos (place_id);
create index collection_places_place_id_idx on public.collection_places (place_id);

-- RLS: anon may read published/public rows only; all writes go through the service role
alter table public.places enable row level security;
alter table public.place_photos enable row level security;
alter table public.collections enable row level security;
alter table public.collection_places enable row level security;

create policy "anon read published places"
  on public.places for select
  using (is_published);

create policy "anon read photos of published places"
  on public.place_photos for select
  using (exists (
    select 1 from public.places p
    where p.id = place_photos.place_id and p.is_published
  ));

create policy "anon read public collections"
  on public.collections for select
  using (is_public);

create policy "anon read places of public collections"
  on public.collection_places for select
  using (exists (
    select 1 from public.collections c
    where c.id = collection_places.collection_id and c.is_public
  ));
