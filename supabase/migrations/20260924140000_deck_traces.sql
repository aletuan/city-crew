-- Where the sketching deck reports what its animation actually did.
--
-- The deck shows each plan's places in turn, dissolving one set of photos
-- into the next. It has been reported as jerky four times and fixed four
-- times, every fix reasoned from a description of what it looked like,
-- because the phone it runs on is not the machine it is written on and
-- nothing here can see that console. This table is the other half of that
-- conversation: the deck files what it did, in milliseconds, and the
-- investigation reads the table.
--
-- ── what a row is ──
--
-- One visit to the sketching screen. `events` is that visit's timeline in
-- order, each entry saying when, in which option, in which box of the row,
-- what happened, and to which place:
--
--   ask      the box was handed its new photo; the dissolve begins as soon
--            as that photo is decoded
--   load     the photo is decoded and drawable — `load - ask` is the whole
--            question, because a gap there is the old picture staying up
--            while the new one catches up
--   fail     the photo could not be fetched at all
--   name     the word under it changed, at the bottom of its own dip
--   option   the deck moved to the next plan
--
-- A place *leaves* a box at the `ask` of the place that follows it there,
-- which is why there is no event for going: one timeline reads both ways.
-- Nor is there one for the box finishing, which is `name` plus a constant
-- the app already knows.
--
-- ── what a row is not ──
--
-- Milliseconds, a platform, an OS version and place slugs — the same
-- shape, and the same restraint, as `startup_traces`. No user id, no
-- position, no device identifier, so a row cannot be traced to a person.
-- Slugs name places in a public catalog, not anything about who was
-- looking at them.
--
-- ── who may do what ──
--
-- Phones write and cannot read; only the desk reads. An open insert from a
-- shipped key can be spammed in principle, and the checks below cap what a
-- row can be: sane totals, a bounded events array.
--
-- Like `startup_traces` this is an investigation tool and not a ledger.
-- When the deck stops being worked on, `DECK_TRACE_UPLOAD` in the app
-- turns the writes off, and
-- `delete from deck_traces where created_at < now() - interval '30 days'`
-- is the whole of its retention story.

create table if not exists public.deck_traces (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Loosened by 20260924203000: this enumeration refused every row the
  -- app sent, and a trace table that will not store the value that
  -- explains a failure is the wrong shape of strict.
  platform    text not null check (platform in ('ios', 'android')),
  os_version  text check (os_version is null or length(os_version) <= 40),
  is_dev      boolean not null default false,
  -- What the deck was asked to show: how many plans it walked and how many
  -- boxes wide the row was. A timeline reads very differently at one plan
  -- and at three.
  options     integer not null check (options >= 0 and options <= 20),
  span        integer not null check (span >= 0 and span <= 10),
  -- Whether the reader had asked the system for less motion, because that
  -- turns the dissolve off entirely and a row recorded under it is not
  -- evidence about the animation.
  still       boolean not null default false,
  -- Elapsed at the last event. Bounded above for the reason
  -- `startup_traces.total_ms` is: a phone that slept mid-wait can report
  -- hours, and one such row would make every average lie.
  total_ms    integer not null check (total_ms >= 0 and total_ms <= 600000),
  -- [{ "ms": 412, "option": 0, "slot": 1, "what": "ask", "place": "cong-cafe" }, ...]
  -- in time order. Size-capped so the open insert cannot be used to store
  -- arbitrary payloads.
  events      jsonb not null check (jsonb_typeof(events) = 'array' and pg_column_size(events) <= 16384)
);

-- Reads are "recent visits, newest first", nothing else yet.
create index if not exists deck_traces_when on public.deck_traces (created_at desc);

alter table public.deck_traces enable row level security;

-- No `to` clause, like every policy in this schema — the named Supabase
-- roles do not exist on the throwaway Postgres the test harness uses, and
-- an open check says the same thing to every role there is.
drop policy if exists "decks report themselves" on public.deck_traces;
create policy "decks report themselves" on public.deck_traces
  for insert with check (true);

drop policy if exists "editors read deck traces" on public.deck_traces;
create policy "editors read deck traces" on public.deck_traces
  for select using (public.is_editor());
