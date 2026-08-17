-- A day somebody decided on, and the stops it is made of.
--
-- The first table in this schema that stores something the app could not
-- work out again. Everything else here is catalog — places the desk wrote,
-- collections pointing at them — and the daily suggestion cap is famously
-- counted off the rows themselves rather than kept in a counter, because a
-- number you can derive is a number that cannot drift.
--
-- A trip cannot be derived. It is a decision made at a moment: these stops,
-- in this order, at these times. The catalog moves underneath it — a place
-- closes, the desk unpublishes one, opening hours change — and the plan the
-- reader agreed to has to survive all of that unchanged. Re-running the
-- planner over today's catalog would produce a different day and quietly
-- call it the same one.
--
-- The answers are stored beside the stops for the same reason in reverse:
-- they are what the plan was built *from*, so a later screen can show why
-- a trip looks the way it does, or offer to draft it again.

create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  city_id    text not null references public.cities(id),
  -- Empty rather than null: a trip always has a name to print, and the
  -- screen falls back to naming it from its stops. Null would make every
  -- reader of this column handle a case that has an obvious answer.
  title      text not null default '',

  -- What the wizard asked. `when_part` rather than `when`, which is
  -- reserved; `day` is a calendar day and not an instant, matching
  -- `lib/day` in the app and `TripDraft.date`.
  company    text,
  categories text[] not null default '{}',
  district   text,
  at_lat     double precision,
  at_lng     double precision,
  day        date not null,
  when_part  text not null check (when_part in ('day', 'evening')),

  -- Provenance, in the spirit of `places.channel`: which door this came
  -- in through. 'rules' is the planner alone; 'rules+llm' is a plan a
  -- model also wrote prose for. A reader is entitled to know which.
  generated_by text not null default 'rules'
    check (generated_by in ('rules', 'rules+llm')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_owner_day_idx on public.trips (owner_id, day desc);

-- The stops, in order.
--
-- Keyed on (trip_id, place_id) rather than on (trip_id, sort_order), and
-- that is a decision rather than a habit. Reordering with sort_order in the
-- key means every swap passes through a state where two rows collide, so a
-- simple loop of updates cannot do it — `collection_places` keys the same
-- way for the same reason, and its sort_order is documented as allowed to
-- have holes. The cost is that a trip cannot visit one place twice, which
-- is a rule worth having anyway: the planner already refuses to.
create table if not exists public.trip_stops (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  sort_order int not null default 0,

  -- Minutes past midnight on the catalog's clock — the same units
  -- `lib/planner` works in, and the reason this is an int rather than a
  -- `time`: a stop can legitimately land past midnight, and 1500 says
  -- half past one the next morning without a date attached to argue with.
  arrive_min int,
  dwell_min  int,

  -- Written by a model, in one language. Every other content column in
  -- this schema carries _en/_vi/_ja, but those are written once by the
  -- desk for everyone; this is written for one person's evening, so three
  -- translations would be triple the tokens for two thirds nobody reads.
  -- `why_lang` records which one, so a plan read after a language switch
  -- can say so rather than leaving the reader to guess.
  why      text,
  why_lang text check (why_lang is null or why_lang in ('en', 'vi', 'ja')),

  primary key (trip_id, place_id)
);

create index if not exists trip_stops_order_idx on public.trip_stops (trip_id, sort_order);

alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;

-- ── ownership ────────────────────────────────────────────────────────
--
-- Owner-only, all four verbs, following `collections`. No public read at
-- all — not even a published flag — because there is nothing to publish
-- into. Sharing a trip with other people needs a membership table, an
-- invitation and a decision about who may edit what; none of that exists,
-- and a policy written now against a design nobody has settled would be
-- the widest thing in this file.

drop policy if exists "owners read their trips" on public.trips;
create policy "owners read their trips" on public.trips
  for select using (owner_id = auth.uid());

-- The check on owner_id is what stops a client inserting a row owned by
-- somebody else — the same guard `collections` needed.
drop policy if exists "owners insert their trips" on public.trips;
create policy "owners insert their trips" on public.trips
  for insert with check (owner_id = auth.uid());

drop policy if exists "owners update their trips" on public.trips;
create policy "owners update their trips" on public.trips
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owners delete their trips" on public.trips;
create policy "owners delete their trips" on public.trips
  for delete using (owner_id = auth.uid());

-- Stops inherit their trip's owner. Written as an `exists` against
-- `trips` rather than a denormalised owner_id on the stop: two copies of
-- who owns something drift, and the one that drifts is the one nobody
-- reads.
drop policy if exists "owners read their trip stops" on public.trip_stops;
create policy "owners read their trip stops" on public.trip_stops
  for select using (
    exists (select 1 from public.trips t
             where t.id = trip_stops.trip_id and t.owner_id = auth.uid())
  );

drop policy if exists "owners insert their trip stops" on public.trip_stops;
create policy "owners insert their trip stops" on public.trip_stops
  for insert with check (
    exists (select 1 from public.trips t
             where t.id = trip_stops.trip_id and t.owner_id = auth.uid())
  );

drop policy if exists "owners update their trip stops" on public.trip_stops;
create policy "owners update their trip stops" on public.trip_stops
  for update using (
    exists (select 1 from public.trips t
             where t.id = trip_stops.trip_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trips t
             where t.id = trip_stops.trip_id and t.owner_id = auth.uid())
  );

drop policy if exists "owners delete their trip stops" on public.trip_stops;
create policy "owners delete their trip stops" on public.trip_stops
  for delete using (
    exists (select 1 from public.trips t
             where t.id = trip_stops.trip_id and t.owner_id = auth.uid())
  );

-- `updated_at` is maintained by the client on save rather than by a
-- trigger, matching how `places.reviewed_at` is stamped from the
-- dashboard. A trigger would be tidier and is worth having when something
-- other than the app writes here; nothing does yet.
