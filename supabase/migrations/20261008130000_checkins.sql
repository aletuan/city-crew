-- Check-ins: this account was at this place at this instant.
--
-- ── why a table of its own ──
--
-- `place_events` already logs places per account, and it is the wrong
-- home for this. That log is the taste profile's private signal: the
-- policy promises it is never shown to anyone, its insert policy obeys
-- the reader's `history_on`, and "Delete my history" wipes it whole. A
-- check-in is the opposite kind of row — something the reader did on
-- purpose and wants to see again, and may one day show a friend — so it
-- must be writable with history off, visible to its owner, deletable
-- one at a time, and must leave with the account (`on delete cascade`
-- from `auth.users`, as every personal table here does). Those are the
-- properties of user content, like a collection. See
-- `app/src/lib/checkin.ts` for the same argument from the app's side.
--
-- ── what a row is, in this first cut ──
--
-- Who, where, when. No note, no photograph, no rating: each of those is
-- content with its own moderation and its own screen, and arrives as a
-- column or a table of its own when it arrives. `at` is the visit;
-- `created_at` is the write. They are the same instant today and will
-- not be the day a visit can be backdated — which is why the policy
-- below bounds `at` rather than trusting it.
--
-- ── the policies ──
--
-- Owner reads, owner writes, owner deletes. The insert policy carries
-- three bounds, all counted off the rows themselves the way
-- `20260910090000_daily_caps.sql` counts everything:
--
--   - thirty a day: a long day out with room to spare; more is a script
--     (`DAILY_CAPS.checkins` in the app is a copy of this number);
--   - not twice at one place inside ten minutes: that is a double tap,
--     not a return, and the app's pill never offers one
--     (`REPEAT_AFTER_MIN`) — this is the backstop for a second phone;
--   - `at` within a day behind now and five minutes ahead of it: a
--     check-in is *now*, give or take a clock.
--
-- The two counts are read through a definer function rather than inline,
-- for the reason `own_collection_places_today` exists: a policy on
-- `checkins` that selects from `checkins` is evaluated under this table's
-- own read policy, and Postgres refuses the loop ("infinite recursion
-- detected in policy"). The function reads as its owner, answers one
-- boolean, and answers it only about the caller.
--
-- `(select auth.uid())`, not `auth.uid()`: see `_rls_ask_once.sql`.

create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  -- Denormalised for the reason `place_events.city_id` is: read per
  -- city, and a column that cannot change is not worth a join to learn.
  city_id    text,
  at         timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- The two reads the app makes: everything of mine newest first, and
-- the newest at one place (the pill, and the ten-minute rule).
create index if not exists checkins_user_at on public.checkins (user_id, at desc);
create index if not exists checkins_user_place_at on public.checkins (user_id, place_id, at desc);

alter table public.checkins enable row level security;
grant select, insert, delete on table public.checkins to authenticated;

drop policy if exists "owners read their check-ins" on public.checkins;
create policy "owners read their check-ins" on public.checkins
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.may_check_in(p_place uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*) from public.checkins c
    where c.user_id = (select auth.uid())
      and c.created_at > now() - interval '1 day'
  ) < 30
  and not exists (
    select 1 from public.checkins c
    where c.user_id = (select auth.uid())
      and c.place_id = p_place
      and c.at > now() - interval '10 minutes'
  );
$$;

revoke all on function public.may_check_in(uuid) from public;
grant execute on function public.may_check_in(uuid) to authenticated;

drop policy if exists "owners check in" on public.checkins;
create policy "owners check in" on public.checkins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and at <= now() + interval '5 minutes'
    and at >= now() - interval '1 day'
    and public.may_check_in(place_id)
  );

drop policy if exists "owners delete their check-ins" on public.checkins;
create policy "owners delete their check-ins" on public.checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));
