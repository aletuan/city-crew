-- Fifty visits a day across places, counted by an instant the client
-- cannot write (`20261124210000_checkins_per_day.sql`).
--
--   e2000000-…-0001  a busy visitor
--   e2000000-…-0002  somebody else
--   sixty places, e2000000-…-1000 … -1059

grant usage on schema public to rls_client;
insert into auth.users (id, email, raw_user_meta_data) values
  ('e2000000-0000-0000-0000-000000000001', 'busy@cc.test', '{"handle":"busy"}'),
  ('e2000000-0000-0000-0000-000000000002', 'calm@cc.test', '{"handle":"calm"}');
insert into public.places (id, slug, city_id, is_published, review_status)
select ('e2000000-0000-0000-0000-00000000' || (1000 + i))::uuid, 'cd-' || i, 'hanoi', true, 'approved'
  from generate_series(0, 59) as i;

-- Forty-nine visits today, at forty-nine places, written as the table's
-- owner; and ten from two days ago, which no longer count.
insert into public.checkins (user_id, place_id, city_id, at, created_at)
select 'e2000000-0000-0000-0000-000000000001', ('e2000000-0000-0000-0000-00000000' || (1000 + i))::uuid, 'hanoi',
       now() - interval '2 hours', now() - interval '2 hours'
  from generate_series(0, 48) as i;
insert into public.checkins (user_id, place_id, city_id, at, created_at)
select 'e2000000-0000-0000-0000-000000000001', ('e2000000-0000-0000-0000-00000000' || (1000 + i))::uuid, 'hanoi',
       now() - interval '2 days', now() - interval '2 days'
  from generate_series(50, 59) as i;

do $$
declare
  busy constant text := 'e2000000-0000-0000-0000-000000000001';
  calm constant text := 'e2000000-0000-0000-0000-000000000002';
  refused int := 0; n int;
begin
  -- The fiftieth goes in; the fifty-first, at a place not yet visited,
  -- does not.
  set local role rls_client;
  perform set_config('test.uid', busy, true);
  insert into public.checkins (user_id, place_id, city_id)
  values (busy::uuid, 'e2000000-0000-0000-0000-000000001049', 'hanoi');
  begin
    insert into public.checkins (user_id, place_id, city_id)
    values (busy::uuid, 'e2000000-0000-0000-0000-000000001050', 'hanoi');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 1, 'the fifty-first visit in a day should be refused';
  select count(*) into n from public.checkins where user_id = busy::uuid and created_at > now() - interval '1 day';
  assert n = 50, format('fifty today, saw %s', n);

  -- Somebody else's day is their own.
  set local role rls_client;
  perform set_config('test.uid', calm, true);
  insert into public.checkins (user_id, place_id, city_id)
  values (calm::uuid, 'e2000000-0000-0000-0000-000000001050', 'hanoi');
  reset role;

  -- The instants are not the client's: neither `at` nor `created_at` can
  -- be written, so neither can be backdated out of the window.
  refused := 0;
  set local role rls_client;
  perform set_config('test.uid', calm, true);
  begin
    insert into public.checkins (user_id, place_id, city_id, created_at)
    values (calm::uuid, 'e2000000-0000-0000-0000-000000001051', 'hanoi', now() - interval '3 days');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.checkins (user_id, place_id, city_id, at)
    values (calm::uuid, 'e2000000-0000-0000-0000-000000001052', 'hanoi', now() - interval '23 hours 59 minutes');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 2, format('%s of 2 attempts to write an instant were refused', refused);
end $$;
