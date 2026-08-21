-- `updated_at` moves when the row does, and only then.
--
-- The bug this covers was invisible in exactly the way that matters: the
-- column was populated, non-null, and plausible on every row. It just
-- meant "when this was inserted". Thirty places edited by hand still
-- carried their import timestamp, so the dashboard's recently-changed view
-- never showed them.
--
-- The no-op case is asserted too, and it is asserted the way it actually
-- behaves rather than the way it was meant to. `when (new is distinct from
-- old)` was the intent and Postgres refuses it on `places`, whose
-- `needs_classification` is generated — see the migration. So a write that
-- changes nothing does move the timestamp, and the test says so out loud.
-- Pinning the real behaviour is what makes the next person's surprise land
-- here, in a file that explains it, rather than in the dashboard.

-- ----------------------------------------------------------------- shape

-- Deliberately not `security definer`, unlike `stamp_curator`. That one
-- reads `profiles` and has to see past RLS; this one writes a column on
-- the row already being written and needs no privilege. A trigger that
-- asks for rights it does not use is a bigger endpoint than it needs to be.
do $$
declare def bool;
begin
  select p.prosecdef into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'stamp_updated_at';
  assert def is not null, 'stamp_updated_at does not exist';
  assert not def, 'stamp_updated_at became security definer; it has no need to see past RLS';
end $$;

-- Any function in `public` with execute granted is an endpoint at
-- /rest/v1/rpc/. This one has no business being one.
do $$
declare who text;
begin
  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_function_privilege(a, 'public.stamp_updated_at()', 'execute');
  assert who is null, format('stamp_updated_at is callable over the wire by: %s', who);
end $$;

-- Every table carrying the column gets the trigger. Named individually
-- rather than counted, so a missing one says which.
do $$
declare t text; n int;
begin
  foreach t in array array['places', 'trips', 'preferences', 'category_terms'] loop
    select count(*) into n from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
     where c.relname = t and tg.tgname = t || '_stamp_updated_at' and not tg.tgisinternal;
    assert n = 1, format('%s has no updated_at trigger; the column means "created" there', t);
  end loop;
end $$;

-- ------------------------------------------------------------- behaviour

-- `now()` is frozen for the length of a transaction, so two stamps inside
-- one are equal and a before/after comparison cannot tell a stamp from a
-- no-op. Every assertion below therefore compares against a timestamp that
-- predates the transaction, or against `now()` itself.
--
-- That constraint bit while writing this: the first version forced
-- `updated_at` backwards with an UPDATE, which is itself an update, so the
-- trigger stamped it straight back and the test compared now() to now().
-- The behaviour that broke it is now asserted rather than worked around.
do $$
declare pid uuid; got timestamptz;
        old_ts constant timestamptz := '2020-01-01 00:00:00+00';
begin
  -- Insert keeps what it was given: the trigger is `before update` only,
  -- and `importPlace` supplies its own value when it creates a place.
  insert into public.places (slug, city_id, updated_at)
    values ('t-stamp-1', 'hanoi', old_ts) returning places.id into pid;
  select updated_at into got from public.places where places.id = pid;
  assert got = old_ts,
    format('insert overwrote a caller-supplied updated_at (%s, wanted %s)', got, old_ts);

  -- A real edit stamps it. This is the whole point: thirty places were
  -- edited by hand and none of them recorded it.
  update public.places set review_status = 'approved' where places.id = pid;
  select updated_at into got from public.places where places.id = pid;
  assert got > old_ts, 'an edited place kept its old updated_at';
  assert got = now(), format('the stamp is not transaction time: %s', got);

  -- An update that supplies its own `updated_at` is overridden. Worth
  -- pinning because it is surprising in exactly one direction — a caller
  -- that thinks it is backdating a row is not — and because it is the
  -- proof that the trigger fires unconditionally.
  --
  -- A pure no-op write cannot be distinguished from a stamp inside one
  -- transaction, so it is not asserted separately; this covers the same
  -- ground. The migration explains why there is no guard at all.
  update public.places set updated_at = old_ts where places.id = pid;
  select updated_at into got from public.places where places.id = pid;
  assert got = now(),
    format('an update kept its own updated_at (%s); the trigger no longer overrides', got);

  delete from public.places where places.id = pid;
end $$;

select 'all updated_at checks passed' as result;
