-- A guest may hear why a stop is on the list — within a day's allowance.
--
-- `plan-assist` wrote a plan's sentences only for a signed-in reader, and
-- needing an account was the whole of its cost cap (see the function's
-- header). The reader on the options screen is as often a guest, and a
-- card that says "View & edit" over two stops with nothing under them is
-- the same screen the account holder gets, minus the one thing on it that
-- reads as made for them.
--
-- So the function now answers guests too, and this is the state it needed
-- to do that without an open door: a counter per day and per caller, kept
-- long enough to be counted and no longer. Nothing here is a secret
-- — a call costs a fraction of a cent — but a counter that is not there
-- is a bill that is not bounded, and the header of the function used to
-- say exactly that: "if the bill ever shows it, the answer is a counter
-- table." It shows nothing yet; this is the table before the bill.
--
-- ── who the caller is ──
--
-- A guest has no id, so the key is a hash of their address: the first
-- `x-forwarded-for` hop, salted and SHA-256'd in the function. The hash
-- is what is stored, never the address, and the salt makes the stored
-- value useless outside the function. A call with no address at all
-- counts under one shared key, which caps it hardest.
--
-- ── the two allowances ──
--
-- Per caller per day, and for all guests together per day. The first is
-- what a person meets: twenty plans in a day is more than the planner
-- draws for anyone. The second is what a script meets: whatever it does
-- with addresses, the day's total has one ceiling, and the ceiling is a
-- number the function passes in, so lowering it is a redeploy and not a
-- migration. Both are checked after the increment, so a refused call
-- still counts — a caller at the limit cannot probe it for free.
--
-- ── why a function and not a policy ──
--
-- The function is called by the Edge Function alone, as the service role.
-- There is no client that should read or write this table, so it has RLS
-- on and no policy, and the counter is a definer function the service
-- role may execute and nobody else may. `function_grants_test` holds
-- that: it is not on the anon allowlist and must not be.

create table public.plan_assist_guest_calls (
  day date not null,
  ip_hash text not null,
  n integer not null default 0 check (n >= 0),
  primary key (day, ip_hash)
);

comment on table public.plan_assist_guest_calls is
  'Guest calls to plan-assist, per day and per salted address hash. Read and written by the function alone; see 20261001090000_guest_narration.';

alter table public.plan_assist_guest_calls enable row level security;
revoke all on public.plan_assist_guest_calls from public, anon, authenticated;

/**
 * Counts one more call for `p_ip_hash` today and says whether it may go
 * ahead: true while the caller is within `p_ip_cap` for the day and all
 * guests together are within `p_day_cap`.
 *
 * Rows older than a week are swept on the way through, so the table never
 * holds more than a week of a stranger's hashed addresses, and no job has
 * to remember to clean it.
 */
create or replace function public.guest_assist_allowed(
  p_ip_hash text,
  p_ip_cap integer,
  p_day_cap integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  mine integer;
  total integer;
begin
  delete from public.plan_assist_guest_calls where day < current_date - 7;

  insert into public.plan_assist_guest_calls (day, ip_hash, n)
  values (current_date, p_ip_hash, 1)
  on conflict (day, ip_hash) do update
    set n = public.plan_assist_guest_calls.n + 1
  returning n into mine;

  select coalesce(sum(n), 0)::integer into total
    from public.plan_assist_guest_calls
   where day = current_date;

  return mine <= p_ip_cap and total <= p_day_cap;
end;
$$;

revoke all on function public.guest_assist_allowed(text, integer, integer) from public, anon, authenticated;

-- The service role exists on a project and not under the test harness,
-- the same way `moderation_log` grants it.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.guest_assist_allowed(text, integer, integer) to service_role;
  end if;
end $$;
