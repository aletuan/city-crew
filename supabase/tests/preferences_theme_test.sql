-- The theme column: there, nullable, short, and under the same policies
-- as the budget beside it.

do $$
declare nullable text;
begin
  select is_nullable into nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'preferences' and column_name = 'theme';
  assert nullable is not null, 'preferences.theme does not exist';
  assert nullable = 'YES', 'preferences.theme must be nullable: null is "never chose"';
end $$;

-- A look's name is a word. The check is the one limit the column has, so
-- it is asserted by breaking it rather than by reading the catalog.
do $$
begin
  update public.preferences set theme = repeat('x', 33)
   where owner_id = '11111111-1111-1111-1111-111111111111';
  assert false, 'a 33-character theme was accepted';
exception when check_violation then
  null;
end $$;

do $$
declare got text;
begin
  update public.preferences set theme = 'cosmic'
   where owner_id = '11111111-1111-1111-1111-111111111111';
  select theme into got from public.preferences
   where owner_id = '11111111-1111-1111-1111-111111111111';
  assert got = 'cosmic', format('theme read back as %s', got);
end $$;

-- Still private: the column rides on a table whose every policy names the
-- caller (`preferences_test.sql`), and this re-asserts the half that
-- would make a theme — harmless in itself — the first public column of a
-- private row.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'preferences'
     and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
  assert n = 0, format('%s preferences policy is unconditional', n);
end $$;
