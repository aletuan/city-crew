-- The guest counter: closed to clients, open to the function, and holding
-- both allowances at the numbers it is given.
--
-- Exercised rather than read off the catalog: the function is called the
-- way the Edge Function calls it, once per narration, until it says no —
-- and the assertion is on which call is refused, for each of the two
-- caps, and on the sweep that keeps the table a week deep.

-- ── closed ──
do $$
declare on_ bool; who text;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.plan_assist_guest_calls'::regclass;
  assert on_, 'plan_assist_guest_calls has RLS off';
  assert (select count(*) from pg_policies where tablename = 'plan_assist_guest_calls') = 0,
    'plan_assist_guest_calls grew a policy; no client is meant to reach it';

  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_table_privilege(a, 'public.plan_assist_guest_calls', 'select')
      or has_table_privilege(a, 'public.plan_assist_guest_calls', 'insert');
  assert who is null, format('plan_assist_guest_calls is reachable by: %s', who);

  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_function_privilege(a, 'public.guest_assist_allowed(text, integer, integer)', 'execute');
  assert who is null, format('guest_assist_allowed is callable by: %s', who);
end $$;

-- ── the per-caller allowance ──
do $$
declare i int; ok bool;
begin
  for i in 1..3 loop
    ok := public.guest_assist_allowed('hash-a', 3, 100);
    assert ok, format('call %s of 3 for one caller was refused', i);
  end loop;
  ok := public.guest_assist_allowed('hash-a', 3, 100);
  assert not ok, 'the fourth call of a 3-a-day caller went through';
  -- Refused, but counted: the row says four, so the limit cannot be probed for free.
  assert (select n from public.plan_assist_guest_calls where day = current_date and ip_hash = 'hash-a') = 4,
    'a refused call did not count';
  -- Another caller is unaffected by the first one's day.
  ok := public.guest_assist_allowed('hash-b', 3, 100);
  assert ok, 'a second caller was refused on the first caller''s count';
end $$;

-- ── the day's allowance, over every caller ──
do $$
declare ok bool;
begin
  -- Five calls are on the table (4 + 1). A day cap of 6: one more goes, the next does not,
  -- whichever address it comes from.
  ok := public.guest_assist_allowed('hash-c', 3, 6);
  assert ok, 'the sixth call of the day was refused under a cap of 6';
  ok := public.guest_assist_allowed('hash-d', 3, 6);
  assert not ok, 'the seventh call of the day went through under a cap of 6';
  ok := public.guest_assist_allowed('hash-e', 3, 6);
  assert not ok, 'a fresh address got past the day cap';
end $$;

-- ── the sweep ──
do $$
declare ok bool;
begin
  insert into public.plan_assist_guest_calls (day, ip_hash, n)
  values (current_date - 8, 'hash-old', 5), (current_date - 7, 'hash-week', 5), (current_date - 1, 'hash-yesterday', 5);
  ok := public.guest_assist_allowed('hash-f', 3, 1000);
  assert not exists (select 1 from public.plan_assist_guest_calls where ip_hash = 'hash-old'),
    'a row older than a week survived the sweep';
  assert exists (select 1 from public.plan_assist_guest_calls where ip_hash = 'hash-week'),
    'a row exactly a week old was swept; the window is seven days inclusive';
  assert exists (select 1 from public.plan_assist_guest_calls where ip_hash = 'hash-yesterday'),
    'yesterday was swept';
  -- Yesterday's five do not count against today.
  assert (select coalesce(sum(n), 0) from public.plan_assist_guest_calls where day = current_date) = 9,
    'today''s total counted another day''s rows';
end $$;

delete from public.plan_assist_guest_calls;

select 'all guest narration checks passed' as result;
