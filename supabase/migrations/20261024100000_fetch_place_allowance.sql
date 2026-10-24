-- A day's allowance for asking Google, per account and for everyone.
--
-- `fetch-place` does three things that each cost a Google call. `suggest`
-- has been capped at fifty a day since it shipped, and needed no counter
-- to do it: every suggestion leaves a row in `places` with its submitter
-- and its time, so the cap is a count of rows that are already there.
-- `search` and `reverse` leave nothing behind. The function could not
-- tell three searches from three thousand, its header said so — "uncapped
-- per account … if the bill ever shows it, the answer is a counter table"
-- — and the security review of 24 Oct 2026 put it first: one free account
-- and a loop is a Google bill with no ceiling. This is that counter table,
-- before the bill.
--
-- ── the two allowances ──
--
-- Per account, per action, per day: what a person meets. The numbers are
-- passed in by the function (60 searches, 30 names for a point), so a
-- change is a redeploy and not a migration. Editors are counted but have
-- no per-account allowance — importing in bulk is their job, as `suggest`
-- already says — and pass `p_user_cap` as null.
--
-- For every account together, per day: what a script meets that signs up
-- a hundred accounts. One ceiling over both actions, because the bill is
-- one bill. It is set far above use — 41 calls to `fetch-place` in the
-- whole of the day before this, desk imports included — because when it
-- is reached the real readers are refused too.
--
-- Both are checked after the increment, so a refused call still counts:
-- the limit cannot be probed for free. The answer says which allowance
-- refused, because the two are different sentences on the phone — "you
-- have searched enough today" is untrue of a reader who searched twice.
--
-- ── why a function and not a policy ──
--
-- The same as `plan_assist_guest_calls` (20261001090000_guest_narration):
-- the Edge Function is the only caller, as the service role. No client
-- reads or writes this table, so RLS is on with no policy, and the counter
-- is a definer function the service role may execute and nobody else may.

create table public.fetch_place_calls (
  day date not null,
  user_id uuid not null,
  action text not null check (action in ('search', 'reverse')),
  n integer not null default 0 check (n >= 0),
  primary key (day, user_id, action)
);

comment on table public.fetch_place_calls is
  'Calls to fetch-place''s search and reverse, per day, account and action. Read and written by the function alone; see 20261024100000_fetch_place_allowance.';

alter table public.fetch_place_calls enable row level security;
revoke all on public.fetch_place_calls from public, anon, authenticated;

/**
 * Counts one more `p_action` call for `p_user` today, and says whether it
 * may go ahead: 'ok', or the allowance that refused it — 'account' when
 * this account is past `p_user_cap` for this action today, 'app' when all
 * accounts together are past `p_day_cap`. A null `p_user_cap` is an editor:
 * counted, never refused on its own count.
 *
 * Rows older than a week are swept on the way through, as the guest
 * counter does, so no job has to remember to clean the table.
 */
create or replace function public.fetch_place_allowed(
  p_user uuid,
  p_action text,
  p_user_cap integer,
  p_day_cap integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mine integer;
  total integer;
begin
  delete from public.fetch_place_calls where day < current_date - 7;

  insert into public.fetch_place_calls (day, user_id, action, n)
  values (current_date, p_user, p_action, 1)
  on conflict (day, user_id, action) do update
    set n = public.fetch_place_calls.n + 1
  returning n into mine;

  select coalesce(sum(n), 0)::integer into total
    from public.fetch_place_calls
   where day = current_date;

  if total > p_day_cap then return 'app'; end if;
  if p_user_cap is not null and mine > p_user_cap then return 'account'; end if;
  return 'ok';
end;
$$;

revoke all on function public.fetch_place_allowed(uuid, text, integer, integer) from public, anon, authenticated;

-- The service role exists on a project and not under the test harness,
-- the same way the guest counter grants it.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fetch_place_allowed(uuid, text, integer, integer) to service_role;
  end if;
end $$;
