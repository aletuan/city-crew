-- Multi-city support: cities table + city_id on places/collections.
-- Existing catalog is Ho Chi Minh City; everything backfills to 'hcmc'.
-- city_id keeps a DEFAULT so legacy writers (snapshot/upsert.sql) stay valid.

create table if not exists public.cities (
  id         text primary key,          -- 'hcmc' | 'hanoi' | 'danang'
  name_en    text not null,
  name_vi    text not null,
  short_en   text not null,             -- "Saigon" — titles like "Discover Saigon"
  short_vi   text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km  numeric not null default 25,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

insert into public.cities (id, name_en, name_vi, short_en, short_vi, center_lat, center_lng, radius_km, sort_order) values
  ('hcmc',   'Ho Chi Minh City', 'TP. Hồ Chí Minh', 'Saigon',  'Sài Gòn', 10.7769, 106.7009, 25, 1),
  ('hanoi',  'Hanoi',            'Hà Nội',          'Hanoi',   'Hà Nội',  21.0285, 105.8542, 20, 2),
  ('danang', 'Da Nang',          'Đà Nẵng',         'Da Nang', 'Đà Nẵng', 16.0544, 108.2022, 25, 3)
on conflict (id) do nothing;

alter table public.cities enable row level security;

drop policy if exists "public read active cities" on public.cities;
create policy "public read active cities" on public.cities
  for select using (is_active = true);

drop policy if exists "editors manage cities" on public.cities;
create policy "editors manage cities" on public.cities
  for all using (public.is_editor()) with check (public.is_editor());

alter table public.places      add column if not exists city_id text references public.cities(id);
alter table public.collections add column if not exists city_id text references public.cities(id);

update public.places      set city_id = 'hcmc' where city_id is null;
update public.collections set city_id = 'hcmc' where city_id is null;

alter table public.places
  alter column city_id set not null,
  alter column city_id set default 'hcmc';
alter table public.collections
  alter column city_id set not null,
  alter column city_id set default 'hcmc';

create index if not exists places_city_category_idx on public.places (city_id, category);
create index if not exists collections_city_idx     on public.collections (city_id);

-- Concurrent city scans must not import the same Google place twice.
create unique index if not exists places_google_place_id_key
  on public.places (google_place_id) where google_place_id is not null;
