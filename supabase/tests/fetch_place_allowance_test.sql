-- The fetch-place counter: closed to clients, and holding both allowances
-- at the numbers it is given.
--
-- Exercised rather than read off the catalog, as the guest counter's test
-- is: the function is called the way the Edge Function calls it, once per
-- search or name, until it says no — and the assertion is on which call is
-- refused, by which allowance, and on the sweep.

-- ── closed ──
do $$
declare on_ bool; who text;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.fetch_place_calls'::regclass;
  assert on_, 'fetch_place_calls has RLS off';
  assert (select count(*) from pg_policies where tablename = 'fetch_place_calls') = 0,
    'fetch_place_calls grew a policy; no client is meant to reach it';

  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_table_privilege(a, 'public.fetch_place_calls', 'select')
      or has_table_privilege(a, 'public.fetch_place_calls', 'insert');
  assert who is null, format('fetch_place_calls is reachable by: %s', who);

  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_function_privilege(a, 'public.fetch_place_allowed(uuid, text, integer, integer)', 'execute');
  assert who is null, format('fetch_place_allowed is callable by: %s', who);
end $$;

-- ── one account's allowance, per action ──
do $$
declare i int; a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  for i in 1..3 loop
    assert public.fetch_place_allowed(a, 'search', 3, 100) = 'ok', format('search %s of 3 was refused', i);
  end loop;
  assert public.fetch_place_allowed(a, 'search', 3, 100) = 'account',
    'the fourth search of a 3-a-day account was not refused on its own count';
  -- Refused, but counted: the limit cannot be probed for free.
  assert (select n from public.fetch_place_calls where day = current_date and user_id = a and action = 'search') = 4,
    'a refused search did not count';
  -- The other action has its own allowance.
  assert public.fetch_place_allowed(a, 'reverse', 3, 100) = 'ok',
    'naming a point was refused on the search count';
  -- Another account is unaffected by the first one's day.
  assert public.fetch_place_allowed(b, 'search', 3, 100) = 'ok',
    'a second account was refused on the first account''s count';
end $$;

-- ── an editor is counted, and never refused on its own count ──
do $$
declare i int; e uuid := '00000000-0000-0000-0000-0000000000ed';
begin
  for i in 1..5 loop
    assert public.fetch_place_allowed(e, 'search', null, 100) = 'ok', format('editor search %s was refused', i);
  end loop;
  assert (select n from public.fetch_place_calls where day = current_date and user_id = e and action = 'search') = 5,
    'an editor''s searches were not counted';
end $$;

-- ── the day's allowance, over every account ──
do $$
declare c uuid := '00000000-0000-0000-0000-00000000000c'; d uuid := '00000000-0000-0000-0000-00000000000d';
begin
  -- Eleven calls are on the table (4 + 1 + 1 + 5). A day cap of 12: one more goes, the next does
  -- not, whoever asks — an editor included — and the answer names the day, not the account.
  assert public.fetch_place_allowed(c, 'search', 3, 12) = 'ok', 'the twelfth call of the day was refused under a cap of 12';
  assert public.fetch_place_allowed(d, 'search', 3, 12) = 'app', 'the thirteenth call of the day was not refused as the day''s';
  assert public.fetch_place_allowed('00000000-0000-0000-0000-0000000000ed', 'reverse', null, 12) = 'app',
    'an editor got past the day''s allowance';
end $$;

-- ── only the two actions it counts ──
do $$
begin
  begin
    perform public.fetch_place_allowed('00000000-0000-0000-0000-00000000000a', 'suggest', 3, 100);
    assert false, 'an action the table does not count was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ── the sweep ──
do $$
declare x uuid := '00000000-0000-0000-0000-00000000000f';
begin
  insert into public.fetch_place_calls (day, user_id, action, n) values
    (current_date - 8, x, 'search', 5), (current_date - 7, x, 'reverse', 5), (current_date - 1, x, 'search', 5);
  perform public.fetch_place_allowed(x, 'reverse', 3, 1000);
  assert not exists (select 1 from public.fetch_place_calls where day = current_date - 8),
    'a row older than a week survived the sweep';
  assert exists (select 1 from public.fetch_place_calls where day = current_date - 7),
    'a row exactly a week old was swept; the window is seven days inclusive';
  assert exists (select 1 from public.fetch_place_calls where day = current_date - 1),
    'yesterday was swept';
  -- Yesterday's five do not count against today: the fourteen above, and this one.
  assert (select sum(n) from public.fetch_place_calls where day = current_date) = 15,
    'today''s total counted another day''s rows';
end $$;

delete from public.fetch_place_calls;

select 'all fetch-place allowance checks passed' as result;
