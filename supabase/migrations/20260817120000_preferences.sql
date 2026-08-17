-- What a person tells us they like, and whether they let us watch.
--
-- ── why this is not on `profiles` ──
--
-- `docs/ai-agent-planner.md` said to add `pref_*` columns to `profiles`,
-- and that design is wrong. `profiles` carries "profiles are public" —
-- `for select using (true)` — because a shared collection has to be able to
-- say who made it to a reader with no account. Putting a budget on that
-- table publishes everyone's budget to anyone holding the publishable key,
-- which is every copy of the app. RLS is row-level; there is no column-level
-- version of it to hide behind, and a view would leave the underlying
-- columns readable anyway.
--
-- So preferences are their own table with owner-only policies on all four
-- verbs. The split is not tidiness: `profiles` is the half of a person that
-- is meant to be seen, and this is the half that is not.
--
-- ── the opt-in is a database rule, not a promise ──
--
-- `place_events` records what somebody looked at. The design says it must
-- not be written before they have turned it on, and a client-side check is
-- a promise — one forgotten `if` and it is recording anyway, silently, for
-- everyone. So the insert policy itself requires `history_on`: the database
-- refuses to record history for a person who has not asked for it, and no
-- amount of client code can talk it round.

create table if not exists public.preferences (
  -- The user *is* the key. One row per person, no id of its own — there is
  -- nothing to reference it by and nothing that could hold two.
  owner_id     uuid primary key references auth.users(id) on delete cascade,

  -- Category keys from the same closed taxonomy the wizard and Explore use,
  -- so a preference cannot want something the catalog has no word for.
  categories   text[] not null default '{}',

  -- Roughly what an outing is worth to this person, per person, in đồng.
  -- Null means unstated, which is different from zero and is the default:
  -- a plan for somebody who has not said is not a plan with no budget.
  budget_vnd   int check (budget_vnd is null or budget_vnd > 0),

  -- The opt-in, and the thing `place_events` checks. False by default and
  -- deliberately not part of any other write path — turning it on is its
  -- own act.
  history_on   boolean not null default false,

  updated_at   timestamptz not null default now()
);

-- Deliberately absent: `walk_max_km` and `pace`, which the design doc also
-- lists. Nothing reads them yet, and a column nothing reads is state with
-- nothing to justify it — the rule this repo follows everywhere else, and
-- the reason `fetch-place` counts its daily cap off the rows instead of
-- keeping a counter. They can arrive with the pass that uses them.

alter table public.preferences enable row level security;

-- Owner-only on all four verbs. There is no public read of any kind here,
-- which is the whole difference between this table and `profiles`.
drop policy if exists "owners read their preferences" on public.preferences;
create policy "owners read their preferences" on public.preferences
  for select using (owner_id = auth.uid());

-- Insert exists, unlike on `profiles`: there is no trigger creating these,
-- and the row should not exist until somebody has an opinion.
drop policy if exists "owners insert their preferences" on public.preferences;
create policy "owners insert their preferences" on public.preferences
  for insert with check (owner_id = auth.uid());

drop policy if exists "owners update their preferences" on public.preferences;
create policy "owners update their preferences" on public.preferences
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Deleting the row is how somebody says "forget my preferences", and it
-- must not be the desk's job to do it for them.
drop policy if exists "owners delete their preferences" on public.preferences;
create policy "owners delete their preferences" on public.preferences
  for delete using (owner_id = auth.uid());


-- ── what was looked at, once permission exists ────────────────────────
--
-- The signal nothing else in the schema carries. `places.saved_count` is a
-- number the desk typed; `collection_places` records what somebody kept.
-- Neither can answer "what did they open and then not save", which is the
-- strongest thing there is for not offering it again.

create table if not exists public.place_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  -- A closed set, checked here rather than trusted from the client. 'open'
  -- is a detail screen; 'save'/'unsave' shadow the collection writes so the
  -- signal survives a place being un-saved; 'plan_keep'/'plan_drop' are the
  -- plan editor's own verbs.
  kind       text not null check (kind in ('open', 'save', 'unsave', 'plan_keep', 'plan_drop')),
  -- Denormalised on purpose: a taste profile is read per city, and joining
  -- through `places` for a column that cannot change would be a join per
  -- read to learn something the row already knew when it was written.
  city_id    text,
  created_at timestamptz not null default now()
);

-- The only way this table is ever read: one person's recent rows. Newest
-- first because a taste profile is about what somebody has been doing
-- lately, not about everything they have ever done.
create index if not exists place_events_user_idx
  on public.place_events (user_id, created_at desc);

alter table public.place_events enable row level security;

drop policy if exists "owners read their events" on public.place_events;
create policy "owners read their events" on public.place_events
  for select using (user_id = auth.uid());

-- The opt-in, enforced. `with check` runs on every insert, so a client that
-- forgot to look at `history_on` — or one written by somebody who did not
-- know it existed — is refused by Postgres rather than trusted.
--
-- `exists` rather than a join because the answer is a yes or a no: a person
-- with no preferences row has not opted in, and that is the default state
-- of every account.
drop policy if exists "owners insert their events" on public.place_events;
create policy "owners insert their events" on public.place_events
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.preferences p
      where p.owner_id = auth.uid() and p.history_on
    )
  );

-- No update policy, deliberately. An event is a thing that happened; there
-- is no edit to it, and a row that could be rewritten would be a record
-- nobody could rely on.

-- Delete is the "forget my history" button, and it has to be the person's
-- own to press. Not gated on `history_on`: switching recording off and then
-- being unable to erase what was already recorded is the trap this whole
-- table has to avoid.
drop policy if exists "owners delete their events" on public.place_events;
create policy "owners delete their events" on public.place_events
  for delete using (user_id = auth.uid());

-- Not solved here, and worth naming: nothing trims this table. A taste
-- profile only reads recent rows, so old ones are dead weight and a growing
-- liability. The answer is a scheduled delete — `pg_cron` is available on
-- this project but not installed — and until it exists the bound is the
-- reader's own delete button plus the account cascade.
