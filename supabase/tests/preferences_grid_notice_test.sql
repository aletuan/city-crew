-- The grid notice's column: there, nullable, a time, and under the same
-- policies as the theme beside it.

do $$
declare nullable text; kind text;
begin
  select is_nullable, data_type into nullable, kind from information_schema.columns
   where table_schema = 'public' and table_name = 'preferences' and column_name = 'grid_notice_closed_at';
  assert nullable is not null, 'preferences.grid_notice_closed_at does not exist';
  assert nullable = 'YES', 'grid_notice_closed_at must be nullable: null is "never closed"';
  assert kind = 'timestamp with time zone', format('grid_notice_closed_at is %s, not a time', kind);
end $$;

-- An upsert, as the app writes it, and for the reason the theme's test
-- gives: whether this account has a row yet depends on the blocks before.
do $$
declare got timestamptz;
begin
  insert into public.preferences (owner_id, grid_notice_closed_at)
  values ('11111111-1111-1111-1111-111111111111', '2026-10-22 13:00+07')
  on conflict (owner_id) do update set grid_notice_closed_at = excluded.grid_notice_closed_at;
  select grid_notice_closed_at into got from public.preferences
   where owner_id = '11111111-1111-1111-1111-111111111111';
  assert got = '2026-10-22 06:00+00', format('grid_notice_closed_at read back as %s', got);
end $$;

-- Still private: nothing about whether somebody closed a notice is
-- anybody else's, and the row stays one no policy opens to all.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'preferences'
     and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
  assert n = 0, format('%s preferences policy is unconditional', n);
end $$;
