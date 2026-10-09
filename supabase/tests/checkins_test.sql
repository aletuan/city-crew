-- Check-ins: owner reads, owner writes now, owner deletes; and the three
-- bounds on a write — three at one place in a day, ten minutes at one
-- place, and `at` being now give or take. (The day's thirty across
-- places, the first cut's bound, went in `*_checkins_per_place.sql`.)
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

-- ── three at one place in a day; the fourth is refused, another place is not ──
-- Seeded as the runner, spaced hours apart so the ten-minute rule is not
-- what refuses the next one; the one row from above makes three at the
-- second place. Thirty-odd across places in the same day must pass —
-- the cap across places is gone.
insert into public.checkins (user_id, place_id, at, created_at)
select 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2',
       now() - (i || ' hours')::interval, now() - (i || ' hours')::interval
  from generate_series(2, 3) i;
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  select count(*) into n from public.checkins where place_id = 'e1000000-0000-0000-0000-0000000000a2';
  begin
    insert into public.checkins (user_id, place_id)
    values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- The other place has had one visit today, deleted above: room for three.
  insert into public.checkins (user_id, place_id)
  values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a1');
  reset role;
  assert n = 3, format('three visits at the place before the rule, saw %s', n);
  assert refused = 1, 'the fourth visit at one place in a day should be refused';
end $$;

-- ── a day later, the place is open again ──
update public.checkins set at = at - interval '1 day', created_at = created_at - interval '1 day'
 where place_id = 'e1000000-0000-0000-0000-0000000000a2';
do $$
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  insert into public.checkins (user_id, place_id)
  values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2');
  reset role;
end $$;

-- ── and thirty-odd places in one day are fine ──
insert into public.places (id, slug, city_id, is_published, review_status)
select ('e1000000-0000-0000-0000-0000000000' || lpad(to_hex(i), 2, '0'))::uuid, 'ck-many-' || i, 'hanoi', true, 'approved'
  from generate_series(16, 47) i;
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  insert into public.checkins (user_id, place_id)
  select 'e1000000-0000-0000-0000-000000000001', ('e1000000-0000-0000-0000-0000000000' || lpad(to_hex(i), 2, '0'))::uuid
    from generate_series(16, 47) i;
  select count(*) into n from public.checkins where created_at > now() - interval '1 minute';
  reset role;
  assert n >= 32, format('thirty-two places in a minute should all be allowed, saw %s', n);
end $$;

select 'all check-in checks passed' as result;
