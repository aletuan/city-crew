-- Enough of the catalog tables to run the ownership, publishing and
-- submission migrations against a bare Postgres.
--
-- Only the columns those migrations touch or reason about. The real
-- tables carry titles and descriptions in three languages, photo
-- dimensions, attribution and a dozen fields of place detail; none of
-- that is what publishing or submitting can get wrong.
--
-- The shapes here mirror production, checked against
-- information_schema rather than remembered: `collection_places` keys on
-- `place_id`, not on a slug.
--
-- `20260807000000_mobile_editor_auth.sql` is not applied — it needs
-- cities, editors and the rest — so the editorial read policies are
-- absent. That is the one thing these files cannot check: that a live
-- place is readable by the public. It is also the part the migrations
-- under test do not change.

create table if not exists public.places (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  city_id        text,
  google_place_id text unique,
  is_published   boolean not null default false,
  review_status  text not null default 'pending',
  -- Both `not null default '{}'` exactly as production has them, checked
  -- against information_schema. The classification migration computes a
  -- generated column from these two, and it is that "empty is the only
  -- missing there is" that makes `cardinality` the whole test — a stub
  -- that allowed nulls would test a column production cannot have.
  categories     text[] not null default '{}',
  vibe_tags      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  -- `not null default now()` exactly as production has it. The stamping
  -- migration reasons about this column, and a stub that let it be null
  -- would let a trigger look correct while writing into a shape the real
  -- table does not have.
  updated_at     timestamptz not null default now()
);

-- Search synonyms, stubbed to the two columns the stamping migration
-- touches. The real migration cannot run here — its editor policy calls
-- `is_editor()`, which lives in `mobile_editor_auth` and needs cities and
-- an editors table this harness does not build.
create table if not exists public.category_terms (
  key        text primary key,
  terms      text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.place_photos (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  photo_uri  text,
  sort_order int not null default 0,
  is_cover   boolean not null default false,
  is_hidden  boolean not null default false,
  source     text not null default 'google'
);

create table if not exists public.collections (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  city_id        text,
  curator_handle text,
  is_public      boolean not null default false,
  sort_order     int
);

create table if not exists public.collection_places (
  collection_id uuid not null references public.collections(id) on delete cascade,
  place_id      uuid not null references public.places(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (collection_id, place_id)
);

-- Only the primary key, and only because `trips` points at it. The real
-- table carries centres, radii and hero copy in three languages; none of
-- that is what a trip's ownership rules can get wrong. Seeded with the
-- three the app ships, so a test can insert a trip without inventing a
-- city first.
create table if not exists public.cities (
  id text primary key
);
insert into public.cities (id) values ('hcmc'), ('hanoi'), ('danang')
  on conflict (id) do nothing;

alter table public.places enable row level security;
alter table public.place_photos enable row level security;
alter table public.collections enable row level security;
alter table public.collection_places enable row level security;
