-- Enough of the collections tables to run the ownership and publishing
-- migrations against a bare Postgres.
--
-- Only the columns those migrations touch or reason about. The real table
-- carries titles and descriptions in three languages and a cover
-- reference; none of that is what publishing can get wrong.
--
-- `20260807000000_mobile_editor_auth.sql` is not applied here — it needs
-- places, cities and photos — so the editorial read policies are absent.
-- That is the one thing this file cannot check: that a published list
-- becomes readable. It is also the part the publish migration does not
-- change, which is why it settles for saying so.

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
  place_slug    text not null,
  sort_order    int not null default 0,
  primary key (collection_id, place_slug)
);

alter table public.collections enable row level security;
alter table public.collection_places enable row level security;
