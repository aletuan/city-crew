-- ops_tokens is the service role's alone.
--
-- The table's only job is to hold a secret the database hands to an Edge
-- Function. A read path for anon or authenticated would hand it to the
-- open internet, so the property under test is the absence of one.
do $$
declare on_ bool; who text;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.ops_tokens'::regclass;
  assert on_, 'ops_tokens has RLS off';
  assert (select count(*) from pg_policies where tablename = 'ops_tokens') = 0,
    'ops_tokens grew a policy; it is meant to have none';
  select string_agg(a, ',') into who from unnest(array['anon', 'authenticated']) a
   where has_table_privilege(a, 'public.ops_tokens', 'select');
  assert who is null, format('ops_tokens is readable by: %s', who);
end $$;
