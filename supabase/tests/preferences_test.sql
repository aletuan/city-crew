-- Who can read what a person likes, and who is allowed to record them.
--
-- Two tables, two different worries. `preferences` holds a budget, which is
-- the first thing in this schema that is nobody else's business — the whole
-- reason it is not a column on the world-readable `profiles`. `place_events`
-- holds what somebody looked at, and its rule is that it must not exist at
-- all until they have asked for it.
--
-- The accounts come from the ones the runner already made.

-- ------------------------------------------------------------- privacy

-- The failure this table exists to avoid, stated as a check: if any policy
-- on `preferences` ever reads `using (true)`, a budget is public. `profiles`
-- has exactly such a policy, on purpose, which is why these are two tables.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'preferences'
     and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
  assert n = 0, format('%s preferences policy is unconditional; a budget would be public', n);
end $$;

-- And the positive half: every policy names the caller.
do $$
declare bad text;
begin
  select string_agg(policyname, ', ') into bad from pg_policies
   where schemaname = 'public' and tablename = 'preferences'
     and coalesce(qual, '') || coalesce(with_check, '') not like '%auth.uid()%';
  assert bad is null, format('preferences policies without auth.uid(): %s', bad);
end $$;

do $$
declare on_ boolean;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.preferences'::regclass;
  assert on_, 'RLS is off on preferences';
  select relrowsecurity into on_ from pg_class where oid = 'public.place_events'::regclass;
  assert on_, 'RLS is off on place_events';
end $$;

-- ------------------------------------------------------------- the opt-in

-- The rule that must not be a client-side promise: the insert policy itself
-- has to consult `history_on`, or one forgotten `if` records everybody.
do $$
declare chk text;
begin
  select with_check into chk from pg_policies
   where schemaname = 'public' and tablename = 'place_events' and cmd = 'INSERT';
  assert chk is not null, 'place_events has no insert policy at all';
  assert chk like '%history_on%',
    format('place_events insert does not check history_on: %s', chk);
  assert chk like '%preferences%',
    format('place_events insert does not consult preferences: %s', chk);
end $$;

-- An event cannot be rewritten. A record that could be edited is a record
-- nothing can be concluded from.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'place_events' and cmd = 'UPDATE';
  assert n = 0, 'place_events has an update policy; an event is not editable';
end $$;

-- Deleting is not gated on the opt-in. Turning recording off and then being
-- unable to erase what was already recorded is the trap this table has to
-- avoid, so the delete policy must not mention `history_on`.
do $$
declare q text;
begin
  select qual into q from pg_policies
   where schemaname = 'public' and tablename = 'place_events' and cmd = 'DELETE';
  assert q is not null, 'place_events cannot be deleted from';
  assert q not like '%history_on%',
    format('delete is gated on the opt-in: %s', q);
  assert q like '%auth.uid()%', format('delete is not owner-scoped: %s', q);
end $$;

-- ------------------------------------------------------------- shape

-- One row per person, keyed by the person. Anything else could hold two
-- opinions for one account and nothing would say which was current.
do $$
declare cols text;
begin
  select string_agg(a.attname, ',' order by a.attname) into cols
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.preferences'::regclass and i.indisprimary;
  assert cols = 'owner_id', format('preferences key is (%s), not the person', cols);
end $$;

-- Recording is off until asked for. A default of true would make the opt-in
-- a lie told once at signup.
do $$
declare d text;
begin
  select column_default into d from information_schema.columns
   where table_schema = 'public' and table_name = 'preferences' and column_name = 'history_on';
  assert d like 'false%', format('history_on defaults to %s', coalesce(d, 'nothing'));
end $$;

-- Unstated and zero are different facts about a budget.
do $$
declare nullable text;
begin
  select is_nullable into nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'preferences' and column_name = 'budget_vnd';
  assert nullable = 'YES', 'budget_vnd is not nullable; "unstated" has nowhere to go';
end $$;

insert into public.preferences (owner_id, categories, budget_vnd)
values ('11111111-1111-1111-1111-111111111111', array['cafes','eats'], 400000);

-- A budget of zero is not a cheap evening, it is a mistake.
do $$
begin
  begin
    insert into public.preferences (owner_id, budget_vnd)
    values ('22222222-2222-2222-2222-222222222222', 0);
    raise exception 'a budget of zero was accepted';
  exception when check_violation then null;
  end;
end $$;

-- The event kinds are a closed set, checked by the database rather than
-- trusted from whatever wrote the row.
do $$
begin
  begin
    insert into public.place_events (user_id, place_id, kind)
    select '11111111-1111-1111-1111-111111111111', id, 'browsed' from public.places limit 1;
    raise exception 'an invented event kind was accepted';
  exception when check_violation then null;
  end;
end $$;

-- An account going away takes its preferences and its history with it.
-- Checked on the constraint rather than by deleting a user, because the
-- runner's accounts are shared with every other block in the suite.
do $$
declare rule text;
begin
  select confdeltype into rule from pg_constraint
   where conrelid = 'public.place_events'::regclass and contype = 'f'
     and confrelid = 'auth.users'::regclass;
  assert rule = 'c', format('place_events does not cascade from the account (%s)', rule);
  select confdeltype into rule from pg_constraint
   where conrelid = 'public.preferences'::regclass and contype = 'f'
     and confrelid = 'auth.users'::regclass;
  assert rule = 'c', format('preferences does not cascade from the account (%s)', rule);
end $$;

-- The one read this table has: one person's recent rows. Without the index
-- a taste profile is a sequential scan over everybody's history.
do $$
declare n int;
begin
  select count(*) into n from pg_indexes
   where schemaname = 'public' and tablename = 'place_events'
     and indexdef like '%user_id%' and indexdef like '%created_at%';
  assert n >= 1, 'no index supports reading one person''s recent events';
end $$;

delete from public.place_events;
delete from public.preferences;

select 'all preference checks passed' as result;
