-- What a saved trip is allowed to be, and who is allowed to see it.
--
-- A trip is the first row in this schema that holds a decision rather than
-- a copy of the catalog, so the checks below are about two things: that the
-- shape can carry a plan back unchanged after the catalog has moved, and
-- that nobody but its owner can reach it.
--
-- The accounts come from the ones the runner already made.

-- ---------------------------------------------------------------- shape

-- A plan can legitimately run past midnight — a bar at half past one is
-- 1500 minutes — which is why the arrival is an int and not a `time`.
do $$
declare kind text;
begin
  select data_type into kind from information_schema.columns
   where table_schema = 'public' and table_name = 'trip_stops' and column_name = 'arrive_min';
  assert kind = 'integer', format('arrive_min became %s; a clock type cannot hold 01:30 tomorrow', kind);
end $$;

-- Keyed on the place, not on the position. With sort_order in the key,
-- every reorder passes through a state where two rows collide and a plain
-- loop of updates cannot do it.
do $$
declare cols text;
begin
  select string_agg(a.attname, ',' order by a.attname) into cols
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.trip_stops'::regclass and i.indisprimary;
  assert cols = 'place_id,trip_id',
    format('trip_stops key is (%s); reordering needs the position out of it', cols);
end $$;

-- The day is a calendar day, not an instant. Two timestamps for the same
-- Saturday are never equal, and the app's own `lib/day` exists to say so.
do $$
declare kind text;
begin
  select data_type into kind from information_schema.columns
   where table_schema = 'public' and table_name = 'trips' and column_name = 'day';
  assert kind = 'date', format('trips.day became %s', kind);
end $$;

-- ---------------------------------------------------------------- rows

insert into public.places (slug, city_id, is_published, review_status, categories)
values ('trip-bar', 'hanoi', true, 'approved', '{nightlife}'),
       ('trip-eats', 'hanoi', true, 'approved', '{eats}')
on conflict (slug) do nothing;

insert into public.trips (id, owner_id, city_id, title, company, categories, day, when_part)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'hanoi', 'Saturday out',
        'couple', '{eats,nightlife}', date '2026-08-22', 'evening');

insert into public.trip_stops (trip_id, place_id, sort_order, arrive_min, dwell_min)
select 'aaaaaaaa-0000-0000-0000-000000000001', id, 0, 18 * 60, 75
  from public.places where slug = 'trip-eats';
insert into public.trip_stops (trip_id, place_id, sort_order, arrive_min, dwell_min)
select 'aaaaaaaa-0000-0000-0000-000000000001', id, 1, 20 * 60, 90
  from public.places where slug = 'trip-bar';

-- The whole point of the table: the plan survives the catalog moving. Pull
-- a place out of the catalog and the stop is still there, still at 20:00.
update public.places set is_published = false where slug = 'trip-bar';
do $$
declare n int; at int;
begin
  select count(*), max(arrive_min) into n, at
    from public.trip_stops where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 2, format('unpublishing a place took a stop with it: %s left', n);
  assert at = 1200, format('the saved arrival moved to %s', at);
end $$;
update public.places set is_published = true where slug = 'trip-bar';

-- Reordering is a loop of updates. With the position in the key this
-- statement is a unique violation halfway through.
do $$
declare orders int[];
begin
  update public.trip_stops set sort_order = 1 - sort_order
   where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select array_agg(sort_order order by sort_order) into orders
    from public.trip_stops where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert orders = array[0, 1], format('reorder left %s', orders);
end $$;

-- A stop goes when its trip goes, and nothing is left pointing at a trip
-- that is not there.
do $$
declare n int;
begin
  delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n from public.trip_stops
   where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 0, format('%s orphaned stops survived their trip', n);
end $$;

-- --------------------------------------------------------------- checks

-- Two words the app writes and this column must keep accepting. A trip is
-- either the planner's alone or a plan a model also wrote prose for, and a
-- reader is entitled to know which.
do $$
begin
  insert into public.trips (id, owner_id, city_id, day, when_part, generated_by)
  values ('aaaaaaaa-0000-0000-0000-000000000002',
          '11111111-1111-1111-1111-111111111111', 'hanoi', date '2026-08-23', 'evening', 'rules+llm');
  delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000002';
end $$;

do $$
begin
  begin
    insert into public.trips (id, owner_id, city_id, day, when_part)
    values ('aaaaaaaa-0000-0000-0000-000000000003',
            '11111111-1111-1111-1111-111111111111', 'hanoi', date '2026-08-23', 'afternoon');
    assert false, 'when_part accepted a value the wizard cannot produce';
  exception when check_violation then null;
  end;
end $$;

-- One language per stop, and only one of the three the app speaks.
do $$
begin
  begin
    insert into public.trips (id, owner_id, city_id, day, when_part)
    values ('aaaaaaaa-0000-0000-0000-000000000004',
            '11111111-1111-1111-1111-111111111111', 'hanoi', date '2026-08-23', 'evening');
    insert into public.trip_stops (trip_id, place_id, why, why_lang)
    select 'aaaaaaaa-0000-0000-0000-000000000004', id, 'because', 'fr'
      from public.places where slug = 'trip-bar';
    assert false, 'why_lang accepted a language the app does not speak';
  exception when check_violation then null;
  end;
  delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000004';
end $$;

-- --------------------------------------------------------------- policy

-- Owner-scoped on all four verbs. The insert check is the one that stops a
-- client writing a row owned by somebody else.
do $$
declare qual text; chk text; verb "char";
begin
  for verb, qual, chk in
    select polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
      from pg_policy where polrelid = 'public.trips'::regclass
  loop
    assert coalesce(qual, chk) like '%auth.uid()%',
      format('a trips policy for %s does not scope to the caller', verb);
  end loop;

  select pg_get_expr(polwithcheck, polrelid) into chk
    from pg_policy where polname = 'owners insert their trips'
     and polrelid = 'public.trips'::regclass;
  assert chk is not null and chk like '%owner_id%',
    format('the insert check stopped pinning owner_id: %s', chk);
end $$;

-- A trip is private, full stop. Nothing here may read somebody else's —
-- there is no published flag and no membership table, so a policy that
-- did not name the caller would be handing out every reader's evenings.
do $$
declare n int;
begin
  select count(*) into n from pg_policy
   where polrelid in ('public.trips'::regclass, 'public.trip_stops'::regclass)
     and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid))
         not like '%auth.uid()%';
  assert n = 0, format('%s trip policies do not mention the caller', n);
end $$;

-- Stops reach their owner through the trip rather than carrying a second
-- copy of who owns them. Two copies drift, and the one that drifts is the
-- one nobody reads.
-- Asserted on `owner_id` rather than on the table name: `owner_id` exists
-- only on `trips`, so naming it is proof the policy went through the trip,
-- and it stays true however Postgres chooses to print the expression back.
do $$
declare qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
    from pg_policy where polname = 'owners read their trip stops'
     and polrelid = 'public.trip_stops'::regclass;
  assert qual like '%owner_id%',
    format('trip_stops stopped reading ownership from its trip: %s', qual);
end $$;

-- And the other half of that: no copy of the owner on the stop itself.
-- Two copies drift, and the one that drifts is the one nobody reads.
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'trip_stops' and column_name = 'owner_id';
  assert n = 0, 'trip_stops grew its own owner_id; ownership now has two homes';
end $$;

do $$
declare on_trips boolean; on_stops boolean;
begin
  select relrowsecurity into on_trips from pg_class where oid = 'public.trips'::regclass;
  select relrowsecurity into on_stops from pg_class where oid = 'public.trip_stops'::regclass;
  assert on_trips, 'row level security is off on trips';
  assert on_stops, 'row level security is off on trip_stops';
end $$;

select 'all trip checks passed' as result;
