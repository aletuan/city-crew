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

-- ── each row keeps the numbers it was judged by ──
do $$
begin
  assert (select (user_cap, day_cap) = (3, 100) from public.fetch_place_calls
           where day = current_date and user_id = '00000000-0000-0000-0000-00000000000a' and action = 'search'),
    'an account''s row does not keep the caps it was judged by';
  assert (select user_cap is null and day_cap = 100 from public.fetch_place_calls
           where day = current_date and user_id = '00000000-0000-0000-0000-0000000000ed' and action = 'search'),
    'an editor''s row has an allowance of its own';
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
  insert into public.fetch_place_calls (day, user_id, action, n, user_cap, day_cap) values
    (current_date - 8, x, 'search', 5, 3, 100), (current_date - 7, x, 'reverse', 5, 5, 100),
    (current_date - 1, x, 'search', 5, 3, 100);
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

-- ── what the desk is told ──
--
-- Account a went past its own allowance today (4 of 3), and x yesterday
-- (5 of 3); nobody else did — d was refused today, but by the day's cap,
-- and is not an account over its own. The editor, uncapped, never is.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'fp-looper@fp.test', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'fp-editor@fp.test', '{}')
on conflict do nothing;
insert into public.profiles (id, handle, full_name)
values ('00000000-0000-0000-0000-00000000000a', 'fp_looper', 'Lớp Học')
on conflict (id) do update set handle = excluded.handle, full_name = excluded.full_name;
insert into public.editors (email) values ('fp-editor@fp.test') on conflict do nothing;

do $$
declare u jsonb;
begin
  assert not has_function_privilege('anon', 'public.fetch_place_usage()', 'execute'),
    'fetch_place_usage is open to the signed-out';
  assert has_function_privilege('authenticated', 'public.fetch_place_usage()', 'execute'),
    'fetch_place_usage is closed to the desk';

  set local role rls_client;
  set local test.uid = '00000000-0000-0000-0000-00000000000a';
  set local test.jwt = '{"email": "fp-looper@fp.test"}';
  assert public.fetch_place_usage() is null, 'a reader who is not an editor was told the usage';

  set local test.uid = '00000000-0000-0000-0000-0000000000e1';
  set local test.jwt = '{"email": "fp-editor@fp.test"}';
  u := public.fetch_place_usage();
  assert (u->>'today')::date = current_date, 'the usage does not say which day is today';
  assert u->'days'->0 = jsonb_build_object('day', current_date, 'total', 15, 'cap', 1000),
    format('today''s total and cap are wrong: %s', u->'days'->0);
  assert u->'days'->1 = jsonb_build_object('day', current_date - 1, 'total', 5, 'cap', 100),
    format('yesterday is wrong, or out of order: %s', u->'days'->1);
  assert jsonb_array_length(u->'days') = 3, 'a day is missing from the week, or one too many';
  assert jsonb_array_length(u->'over') = 2,
    format('the accounts over their own allowance are not exactly a and x: %s', u->'over');
  assert u->'over'->0 @> jsonb_build_object('day', current_date, 'handle', 'fp_looper', 'full_name', 'Lớp Học',
                                            'action', 'search', 'n', 4, 'cap', 3),
    format('today''s account over its allowance is wrong: %s', u->'over'->0);
  assert u->'over'->1 @> jsonb_build_object('day', current_date - 1, 'action', 'search', 'n', 5, 'cap', 3)
     and u->'over'->1->'handle' = 'null'::jsonb,
    format('yesterday''s account, with no profile, is wrong: %s', u->'over'->1);
end $$;
reset role;

delete from public.fetch_place_calls;
delete from public.editors where email = 'fp-editor@fp.test';

select 'all fetch-place allowance checks passed' as result;
