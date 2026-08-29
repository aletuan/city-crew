-- `20260829120000_history_on_by_default.sql`: recording starts on, and every
-- account has a row to say so.
--
-- Its own file rather than more of `preferences_test.sql`, because the two
-- test opposite states of the same column and the order between them is the
-- whole point: that file runs against the migration that created the column
-- off, this one against the migration that turned it on. It also runs *after*
-- that file's `delete from public.preferences`, so the table starts empty and
-- the backfill below is measurable.

-- ── the default itself ──
do $$
declare d text;
begin
  select column_default into d from information_schema.columns
   where table_schema = 'public' and table_name = 'preferences' and column_name = 'history_on';
  assert d like 'true%', format('history_on defaults to %s', coalesce(d, 'nothing'));
end $$;

-- ── the trigger, which is what makes the default reachable ──
--
-- A default is worth nothing to an account with no row to hold it: the insert
-- policy asks `exists`, so no row is indistinguishable from a refusal. Seven
-- of the first thirteen accounts had none — the client write is a
-- `.catch(() => {})` on purpose and "Bỏ qua" skips it entirely — which is why
-- the row is made in the database rather than asked for from the app.
do $$
begin
  assert exists (
    select 1 from pg_trigger
     where tgname = 'on_auth_user_created_preferences'
       and tgrelid = 'auth.users'::regclass
       and not tgisinternal
  ), 'no trigger creates a preferences row for a new account';
end $$;

-- ── the backfill, on the accounts that were already here ──
do $$
declare missing int; off int;
begin
  select count(*) into missing from auth.users u
   where not exists (select 1 from public.preferences p where p.owner_id = u.id);
  assert missing = 0, format('%s accounts still have no preferences row', missing);

  select count(*) into off from public.preferences where not history_on;
  assert off = 0, format('%s rows were left recording-off by the backfill', off);
end $$;

-- ── the trigger doing it, rather than merely existing ──
--
-- The assertion above would pass on a schema where the trigger is present and
-- broken, because the backfill already covered every row. A new account is the
-- only thing that tells them apart, and a new account is exactly the case the
-- seven rowless ones were.
do $$
declare on_now boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('99999999-9999-9999-9999-999999999999', 'later@x.com', '{}');

  select history_on into on_now from public.preferences
   where owner_id = '99999999-9999-9999-9999-999999999999';
  assert on_now is not null, 'a new account got no preferences row';
  assert on_now, 'a new account was created with recording off';
end $$;

-- ── and the guarantee the flip must not have loosened ──
--
-- Repeated from `preferences_test.sql` on purpose. That file asserts it about
-- a schema where the default was off, where the policy was never the only
-- thing standing between a person and a recorded event. Here it is: somebody
-- who turns the switch off is relying on this `with check` and nothing else,
-- and this is the file anyone will read the day the default is argued about
-- again.
do $$
declare chk text;
begin
  select pg_get_expr(polwithcheck, polrelid) into chk from pg_policy
   where polrelid = 'public.place_events'::regclass and polcmd = 'a';
  assert chk like '%history_on%',
    format('place_events insert no longer checks history_on: %s', chk);
end $$;

-- Left as it was found, like every other block here.
delete from public.preferences
 where owner_id = '99999999-9999-9999-9999-999999999999';
delete from auth.users where id = '99999999-9999-9999-9999-999999999999';
delete from public.preferences;

select 'all history checks passed' as result;
