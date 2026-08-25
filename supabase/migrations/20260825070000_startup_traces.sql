-- Where a launch reports how long it took.
--
-- `lib/trace` in the app writes each launch's waterfall to the console,
-- which answers the question only for somebody sitting at a terminal —
-- and this app is worked on from a phone. So a launch also files one row
-- here, seconds after its content is on screen, and the investigation
-- reads the table instead of a log nobody can see.
--
-- ── what a row is, and is not ──
--
-- Milliseconds and nothing else: the named checkpoints with their elapsed
-- times, the platform, the OS version, and whether it was a dev session.
-- Deliberately no user id, no position, no device identifier — a row
-- cannot be traced to a person, which is what makes it fine to write on
-- every launch without asking anyone anything.
--
-- ── who may do what ──
--
-- Phones write and cannot read: insert is open to the app roles, select
-- only to the desk. An open insert from a shipped key can be spammed in
-- principle; the checks below cap what a row can be (a real platform, a
-- bounded marks array, sane totals), and the worst a flood achieves is
-- rows in a table the app never reads.
--
-- The table is an investigation tool, not a ledger. When the launch work
-- closes, `STARTUP_TRACE_UPLOAD` in the app turns the writes off, and
-- `delete from startup_traces where created_at < now() - interval '30 days'`
-- is the whole of its retention story, run whenever the desk cares to.

create table if not exists public.startup_traces (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  platform    text not null check (platform in ('ios', 'android')),
  os_version  text check (os_version is null or length(os_version) <= 40),
  is_dev      boolean not null default false,
  -- Elapsed at the last mark. Bounded above because a phone that slept
  -- mid-launch can report hours, and one such row would make every
  -- average lie; ten minutes already means "broken", not "slow".
  total_ms    integer not null check (total_ms >= 0 and total_ms <= 600000),
  -- [{ "name": "catalog:places", "ms": 1798 }, ...] in mark order. Size-
  -- capped so the open insert cannot be used to store arbitrary payloads.
  marks       jsonb not null check (jsonb_typeof(marks) = 'array' and pg_column_size(marks) <= 8192)
);

-- Reads are "recent launches, newest first", nothing else yet.
create index if not exists startup_traces_when on public.startup_traces (created_at desc);

alter table public.startup_traces enable row level security;

-- No `to` clause, like every policy in this schema — the named Supabase
-- roles do not exist on the throwaway Postgres the test harness uses, and
-- an open check says the same thing to every role there is.
drop policy if exists "launches report themselves" on public.startup_traces;
create policy "launches report themselves" on public.startup_traces
  for insert with check (true);

drop policy if exists "editors read traces" on public.startup_traces;
create policy "editors read traces" on public.startup_traces
  for select using (public.is_editor());
