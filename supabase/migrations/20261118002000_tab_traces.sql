-- Where the tab bar reports what a change of tab took.
--
-- The owner reported the bar as slow to answer (17 Nov 2026): the pill's
-- move to the pressed tab "a little laggy". The code gives a hypothesis —
-- the pill cannot leave until React has committed the render the press
-- began, the arriving screen included — and no number. This is the third
-- table of docs/tracing.md, for the same reason the other two exist: the
-- phone it runs on is not the machine it is written on.
--
-- ── what a row is ──
--
-- The switches since the bar was last still for three seconds, in order.
-- Each is one press on another tab, its figures in milliseconds since the
-- finger came down:
--
--   press    the finger came up and the press was delivered
--   commit   the bar committed with the new tab and the pill was told to
--            go — `commit - press` is the question
--   frame    the first animation frame the JS thread took after that
--   settle   the pill's choreography came to rest; null when the next
--            press cut it short
--
-- with where it went from and to, whether that was the tab's first
-- showing since the app started (`first` — the visit that mounts its
-- stack), and whether the reader had asked for less motion (`still`).
-- `app/src/lib/tabtrace.ts` has the long form.
--
-- ── what a row is not ──
--
-- Milliseconds, a platform, an OS version, a channel and the names of the
-- app's own five tabs. No user id, no position, no device identifier, and
-- — unlike `deck_traces` — not even a place: a row cannot be traced to a
-- person or to what they were looking at.
--
-- ── who may do what ──
--
-- As the other two: phones write and cannot read, only the desk reads,
-- and the checks bound what the open insert can store. `platform` is
-- bounded by length and not enumerated — `deck_traces` enumerated it and
-- threw every row away (20260924203000).
--
-- `channel` is nullable and has no default. `deck_traces` needed
-- `'(not sent)'` to tell a bundle older than the column from a build with
-- no stamp; here the column is as old as the table, so null has one
-- meaning: Expo Go, or a bare dev build.
--
-- An investigation tool, not a ledger. Nothing deletes from it; whoever
-- finishes measuring runs `delete from tab_traces;`.

create table if not exists public.tab_traces (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  platform    text not null check (length(platform) between 1 and 20),
  os_version  text check (os_version is null or length(os_version) <= 40),
  is_dev      boolean not null default false,
  channel     text check (channel is null or length(channel) <= 40),
  -- [{ "from": "Explore", "to": "Trips", "first": true, "still": false,
  --    "press": 84, "commit": 131, "frame": 150, "settle": 512 }, ...]
  -- The app sends at most sixty, about 110 bytes each.
  switches    jsonb not null check (
    jsonb_typeof(switches) = 'array'
    and jsonb_array_length(switches) between 1 and 60
    and pg_column_size(switches) <= 16384
  )
);

create index if not exists tab_traces_when on public.tab_traces (created_at desc);

alter table public.tab_traces enable row level security;

-- No `to` clause, like every policy in this schema — see `deck_traces`.
drop policy if exists "tab bars report themselves" on public.tab_traces;
create policy "tab bars report themselves" on public.tab_traces
  for insert with check (true);

drop policy if exists "editors read tab traces" on public.tab_traces;
create policy "editors read tab traces" on public.tab_traces
  for select using (public.is_editor());
