-- Check-ins: owner reads, owner writes now, owner deletes; and the three
-- bounds on a write — the day's thirty, ten minutes at one place, and
-- `at` being now give or take.
--
--   e1000000-…-0001  the visitor
--   e1000000-…-0002  somebody else
--   e1000000-…-00a1 / -00a2  two places
grant usage on schema public to rls_client;
insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000001', 'vis@cc.test', '{"handle":"visitor","full_name":"Vi Sitor"}'),
  ('e1000000-0000-0000-0000-000000000002', 'oth@cc.test', '{"handle":"other","full_name":"Ot Her"}');
insert into public.places (id, slug, city_id, is_published, review_status) values
  ('e1000000-0000-0000-0000-0000000000a1', 'ck-cong', 'hanoi', true, 'approved'),
  ('e1000000-0000-0000-0000-0000000000a2', 'ck-pizza', 'saigon', true, 'approved');

-- ── a visit, now, as yourself ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  insert into public.checkins (user_id, place_id, city_id)
  values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a1', 'hanoi');
  select count(*) into n from public.checkins;
  reset role;
  assert n = 1, format('the visitor should read their one visit, saw %s', n);
end $$;

-- ── the same place again inside ten minutes is refused; another place is not ──
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  begin
    insert into public.checkins (user_id, place_id, city_id)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a1', 'hanoi');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  insert into public.checkins (user_id, place_id, city_id)
  values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2', 'saigon');
  select count(*) into n from public.checkins;
  reset role;
  assert refused = 1, 'a second visit at the same place inside ten minutes should be refused';
  assert n = 2, format('two places, two visits, saw %s', n);
end $$;

-- ── `at` is now, give or take: the future and the distant past are refused ──
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  begin
    insert into public.checkins (user_id, place_id, at)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2', now() + interval '1 hour');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.checkins (user_id, place_id, at)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2', now() - interval '2 days');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 2, format('%s of 2 out-of-window visits were refused', refused);
end $$;

-- ── not as somebody else, and not as nobody ──
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000002';
  begin
    insert into public.checkins (user_id, place_id)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  select count(*) into n from public.checkins;
  reset role;
  assert refused = 1, 'writing a visit for another account should be refused';
  assert n = 0, format('somebody else reads none of the visitor''s rows, saw %s', n);

  set local role rls_client;
  set local test.uid = '';
  begin
    insert into public.checkins (user_id, place_id)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 2, 'nobody in particular cannot check in';
end $$;

-- ── only the owner deletes, one row at a time ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000002';
  delete from public.checkins where place_id = 'e1000000-0000-0000-0000-0000000000a1';
  reset role;
  select count(*) into n from public.checkins;
  assert n = 2, format('a delete by somebody else should touch nothing, left %s', n);

  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  delete from public.checkins where place_id = 'e1000000-0000-0000-0000-0000000000a1';
  select count(*) into n from public.checkins;
  reset role;
  assert n = 1, format('the owner''s delete should take the one row at that place, left %s', n);
end $$;

-- ── thirty in a day, and the thirty-first is refused ──
-- Seeded as the runner, spaced an hour apart so the ten-minute rule is
-- not what refuses the next one; the one row from above makes 30.
insert into public.checkins (user_id, place_id, at, created_at)
select 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2',
       now() - (i || ' hours')::interval, now() - (i || ' minutes')::interval
  from generate_series(1, 29) i;
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  select count(*) into n from public.checkins;
  begin
    insert into public.checkins (user_id, place_id)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a1');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert n = 30, format('thirty visits in the day before the cap, saw %s', n);
  assert refused = 1, 'the thirty-first visit in a day should be refused';
end $$;

select 'all check-in checks passed' as result;
