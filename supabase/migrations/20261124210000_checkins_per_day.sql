-- Fifty visits a day, across places; and the visit's instants are the
-- server's (owner, 24 Nov 2026).
--
-- ── the cap ──
--
-- The first cut had thirty a day across places
-- (`20261008130000_checkins.sql`); `20261009090000_checkins_per_place.sql`
-- took it out for three at one place, on the argument that thirty was a
-- guess at "a script" and a day out walking a lane of cafés is not one.
-- That left no bound at all on how many rows an account can make, and
-- with photos on a check-in (`docs/checkin-photos-plan.md`) a row is a
-- thing files hang on. So a bound again, set from what people did:
-- measured on the live project the same day, 142 visits over 48
-- account-days, the busiest day 29 (testing, most likely), 95% of days
-- at 12 or fewer. Fifty is that busiest day near twice over — the lane
-- of cafés still fits — and a script stops at fifty.
--
-- A rolling day, as the per-place rule counts it, so a reader in Hà Nội
-- and one in Melbourne meet the same rule.
--
-- ── the instants ──
--
-- Both rules count past rows by their time, and until now a client could
-- write that time. `at` was bounded to the last day by the insert policy,
-- which is not enough: a row written as "23 hours and 59 minutes ago"
-- leaves the window a minute later, so a loop backdating every insert
-- passes any cap counted by `at`. `created_at` was not bounded at all.
-- The app sends neither (`addCheckin`: the user, the place, the city),
-- so the table now takes only those three on an insert, and both
-- instants are the database's own `now()`. The `at` bounds in the policy
-- stay, as a second wall that now never has anything to stop.
--
-- The revoke is from the table, then a grant of columns: a column grant
-- does not narrow a table grant, and the live project's default
-- privileges hold a table-wide INSERT for `anon` and `authenticated`
-- (the same reason `20261124120000_checkin_notes.sql` revoked UPDATE).
--
-- The cap counts `created_at`, which no client can set after this.

revoke insert on table public.checkins from anon, authenticated;
grant insert (user_id, place_id, city_id) on table public.checkins to authenticated;

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
      and c.place_id = p_place
      and c.at > now() - interval '1 day'
  ) < 3
  and (
    select count(*) from public.checkins c
    where c.user_id = (select auth.uid())
      and c.created_at > now() - interval '1 day'
  ) < 50
  and not exists (
    select 1 from public.checkins c
    where c.user_id = (select auth.uid())
      and c.place_id = p_place
      and c.at > now() - interval '10 minutes'
  );
$$;

revoke all on function public.may_check_in(uuid) from public;
grant execute on function public.may_check_in(uuid) to authenticated;
