-- app_flags: everyone reads, nobody writes through the API.
--
-- The table is a set of switches the app reads at launch. The property
-- worth pinning is the asymmetry: a phone with the anon key must be able
-- to read every row, and must not be able to change one — the writes
-- happen in the SQL editor, not from a client. And the first switch has
-- to ship in its safe position.
do $$
declare on_ bool; who text; seeded bool;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.app_flags'::regclass;
  assert on_, 'app_flags has RLS off';

  assert (select count(*) from pg_policies where tablename = 'app_flags' and cmd = 'SELECT') = 1,
    'app_flags needs exactly one read policy';
  assert (select count(*) from pg_policies where tablename = 'app_flags' and cmd <> 'SELECT') = 0,
    'app_flags grew a write policy; the writes are meant to happen in the SQL editor';

  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where not has_table_privilege(a, 'public.app_flags', 'select');
  assert who is null, format('app_flags is not readable by: %s', who);

  select enabled into seeded from public.app_flags where key = 'photo_attribution';
  assert seeded is true, 'photo_attribution must ship on: the credit is what Google asks for';
end $$;
