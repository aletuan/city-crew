-- A list's statistics, for its owner (owner, 13 Nov 2026): how many times
-- it was opened, how many likes and copies it has, and how many trips
-- were started from it — each all time and over the last seven days.
--
-- Two of the four are new facts the database did not hold: an open of a
-- list, and which list a trip was started from. Likes and copies are
-- already rows (`collection_likes`, `collections.copied_from`) and are
-- only counted here.
--
-- ── views: a number per list per day, and nothing about who ──
--
-- Every open of the collection page counts one (`record_collection_view`,
-- called by the app on each mount of `CollectionDetailScreen`): the
-- owner's own opens, a second open the same day, a guest's. The owner's
-- call, the same day. What is kept is one row per (list, day) and a
-- count — no account id, no device, no time of day — so the table cannot
-- say who opened a list, or whether two opens were one person's, even to
-- us. `legal.ts` says exactly that in the same change.
--
-- Accepted, with the owner: anyone can raise the number by opening the
-- list again, and nothing here tries to stop them. The count is the
-- curator's own figure, shown to the curator alone, and nothing ranks by
-- it; telling a person's second open from a stranger's first would need
-- the very identity the table is built not to hold. If views ever rank
-- anything, this is the line to revisit.
--
-- The day is Vietnam's (`Asia/Ho_Chi_Minh`, UTC+7, no daylight saving).
-- The app's readers are in Vietnam and every city it covers is there
-- (`cities.tz`, and `DEFAULT_TZ` in `lib/clock`), and a list is not tied
-- to one city, so there is no per-list zone to choose instead. On UTC's
-- calendar the first seven hours of every Vietnamese day — a late night
-- out, the morning coffee — would be filed under the day before.
--
-- Counted only for a list the caller can read: public, their own, or
-- shared with them — `collection_like_counts`' three, spelled the same
-- way, `shared_with_me` included. Anything else is a silent no-op: a
-- guest or a stranger calling with a private list's id gets the same
-- empty answer as for an id that does not exist, so the call cannot be
-- used to learn that a private list exists, and its owner's figure is
-- not one a stranger can move. An editor reading through the desk's key
-- is not counted for a private list either: the desk is not a reader.
--
-- Rejected: a row per open (list, instant). Totals by day are all the
-- page shows, and a row per open is a log of when somebody looked —
-- one join with an access log away from who. Rejected too: counting in
-- the app and sending a day's total — a phone that is offline at night
-- would lose the evening, and one that is killed would lose it all.
--
-- The row is one counter, so opens of one list on one day queue on its
-- lock. Not measured; at the app's size a list opened twice in the same
-- millisecond is not yet a thing that happens.
--
-- ── trips: which list a trip started from ──
--
-- A trip built from "Start from what you love" (`IdeasScreen`) carries
-- the slugs of the lists the reader ticked all the way to the save
-- (`PlanAsk.from`, then `PlanEditScreen`), and `saveTrip` now writes one
-- `trip_collections` row per list it resolved. Every such trip counts,
-- the owner's own included (owner, 13 Nov 2026). Counting starts with
-- this migration: a trip saved before it has no source and is counted
-- for no list, and nothing here guesses one for it from its stops.
--
-- A table, not a column on `trips`. A plan can start from two lists, and
-- each of them should hear of it; one `collection_id` would choose for
-- the reader which one did. An array column holds both but cannot carry
-- a foreign key, so a deleted list would leave an id behind that names
-- nothing, and every count would have to unnest. A row per (trip, list)
-- is how `trip_stops` and `collection_places` already say "these belong
-- to that".
--
-- Both keys cascade. A trip deleted takes its sources with it, so the
-- list's figure counts trips that still exist — a trip planned and then
-- thrown away is not one the list started. A list deleted takes its rows
-- too, and the trips stay exactly as they were: a trip is stored whole
-- in its stops (`20260817000000_trips`), and the source is a fact for
-- the list's page, which is gone with the list. `set null` would leave
-- a row that counts for nobody, and cannot sit in the primary key.
--
-- Who may write a source: the trip's owner, for a list they can read.
-- "Can read" is asked of `collections` itself, through its own read
-- policies, so the rule has one spelling here — the one the app's reads
-- already meet. The source list's owner reads nothing: they see a
-- number (`collection_stats`), never whose trip. The trip's owner can
-- read their own trip's rows back, as they read its stops; nobody else.
-- No update and no delete: a source is how the trip was made, and the
-- trip's own delete is the only way it ends.
--
-- ── the statistics ──
--
-- `collection_stats(cid)` answers its owner, one row of eight figures;
-- anybody else, and any id that is not theirs, gets no row at all. Not
-- a row of zeros: "nobody opened it" is a claim about a list, and the
-- function makes none about a list the caller does not own. The app
-- asks only for its own lists, as the Activity page does, so it never
-- meets the empty answer except for a list gone since.
--
-- Likes and copies are counted with the feeds' own exclusions, word for
-- word (`likes_on_mine`, `copies_of_mine`, last made in
-- `20261113150000_activity_rows_carry_face`): the owner's own like or
-- copy left out, anybody the owner has blocked left out. So the figure
-- on the statistics page is the number of rows the Activity page lists
-- for that kind, and the two pages cannot disagree.
-- `collection_stats_test` holds that against the feeds themselves.
--
-- Views and trips have no such exclusions, by the owner's call: a view
-- has no who to exclude, and a trip is counted the way a view is, the
-- owner's own included. A blocked reader's trip counts too — the figure
-- never names them, and leaving it out would need the one thing the
-- count is built not to say.
--
-- "The last seven days": for likes, copies and trips, since
-- `now() - interval '7 days'`, to the instant, off their own
-- `created_at` (a trip's is the trip's: the source row is written in
-- the same save and has no time of its own to drift). For views, which
-- have only a day, the seven calendar days in Vietnam ending today —
-- today and the six before it. The two agree to within the hours of
-- today already past.
--
-- `auth.uid()` bare inside the definer functions, as the feeds have it:
-- they are functions, not policies, and the ask-once rewrite has nothing
-- to say to them. The policies on `trip_collections` are written
-- `(select auth.uid())`, as `rls_ask_once_test` asks of every policy.
--
-- ── grants ──
--
-- Stated in full, as `20261113150000` states its own, so the file says
-- what each thing allows without sending the reader to the defaults:
--
--   collection_views            nobody; only the two functions below
--   trip_collections            select and insert, signed in, under RLS
--   record_collection_view      anon and authenticated: a guest's open counts
--   collection_stats            authenticated alone: only an owner has an answer

-- ── views ──

create table if not exists public.collection_views (
  collection_id uuid not null references public.collections(id) on delete cascade,
  day           date not null,
  views         integer not null check (views > 0),
  primary key (collection_id, day)
);

comment on table public.collection_views is
  'Opens of a collection page, one row per list per Vietnamese calendar day. A count and nothing else: no account, no device, no time.';

alter table public.collection_views enable row level security;
-- No policies at all: no client reads or writes this table. The two
-- definer functions below are the only way in.
revoke all on table public.collection_views from public, anon, authenticated;

create or replace function public.record_collection_view(cid uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.collection_views as v (collection_id, day, views)
  select c.id, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 1
  from public.collections c
  where c.id = cid
    and (c.is_public or c.owner_id = auth.uid() or public.shared_with_me(c.id))
  on conflict (collection_id, day) do update set views = v.views + 1;
$$;

revoke all on function public.record_collection_view(uuid) from public;
grant execute on function public.record_collection_view(uuid) to anon, authenticated;

-- ── trips ──

create table if not exists public.trip_collections (
  trip_id       uuid not null references public.trips(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (trip_id, collection_id)
);

comment on table public.trip_collections is
  'The lists a trip was started from. Counted for each list''s owner as a number, never as whose trip.';

-- The count reads by list; the key already serves the trip's side.
create index if not exists trip_collections_collection on public.trip_collections (collection_id);

alter table public.trip_collections enable row level security;

drop policy if exists "owners read their trips' sources" on public.trip_collections;
create policy "owners read their trips' sources" on public.trip_collections
  for select to authenticated using (
    exists (select 1 from public.trips t
             where t.id = trip_collections.trip_id and t.owner_id = (select auth.uid()))
  );

drop policy if exists "owners name the lists their trips started from" on public.trip_collections;
create policy "owners name the lists their trips started from" on public.trip_collections
  for insert to authenticated with check (
    exists (select 1 from public.trips t
             where t.id = trip_collections.trip_id and t.owner_id = (select auth.uid()))
    -- A list the caller can read, by `collections`' own read policies.
    and exists (select 1 from public.collections c where c.id = trip_collections.collection_id)
  );

revoke all on table public.trip_collections from public, anon, authenticated;
grant select, insert on table public.trip_collections to authenticated;

-- ── the statistics ──

create or replace function public.collection_stats(cid uuid)
returns table (
  views_total integer, views_7d integer,
  likes_total integer, likes_7d integer,
  copies_total integer, copies_7d integer,
  trips_total integer, trips_7d integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.total::integer, v.recent::integer,
    l.total::integer, l.recent::integer,
    k.total::integer, k.recent::integer,
    t.total::integer, t.recent::integer
  from public.collections c
  cross join lateral (
    select coalesce(sum(cv.views), 0) as total,
           coalesce(sum(cv.views) filter (
             where cv.day > (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7
           ), 0) as recent
    from public.collection_views cv
    where cv.collection_id = c.id
  ) v
  cross join lateral (
    select count(*) as total,
           count(*) filter (where cl.created_at >= now() - interval '7 days') as recent
    from public.collection_likes cl
    where cl.collection_id = c.id
      and cl.user_id <> auth.uid()
      and not exists (
        select 1 from public.blocks b
        where b.blocker = auth.uid() and b.blocked = cl.user_id
      )
  ) l
  cross join lateral (
    select count(*) as total,
           count(*) filter (where cc.created_at >= now() - interval '7 days') as recent
    from public.collections cc
    where cc.copied_from = c.id
      and cc.owner_id is distinct from auth.uid()
      and not exists (
        select 1 from public.blocks b
        where b.blocker = auth.uid() and b.blocked = cc.owner_id
      )
  ) k
  cross join lateral (
    select count(*) as total,
           count(*) filter (where tr.created_at >= now() - interval '7 days') as recent
    from public.trip_collections tc
    join public.trips tr on tr.id = tc.trip_id
    where tc.collection_id = c.id
  ) t
  where c.id = cid
    and c.owner_id = auth.uid();
$$;

revoke all on function public.collection_stats(uuid) from public, anon;
grant execute on function public.collection_stats(uuid) to authenticated;
