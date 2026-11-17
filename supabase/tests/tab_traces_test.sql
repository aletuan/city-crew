-- The tab bar's trace table: any phone may file a row, signed in or not;
-- only the desk reads them back; and a row is bounded — a handful of
-- switches, not a channel for arbitrary data.

grant usage on schema public to rls_client;
grant select, insert on public.tab_traces to rls_client;

do $$
declare
  refused int := 0; mine int; desk int;
  one jsonb := '[{"from":"Explore","to":"Trips","first":true,"still":false,"press":84,"commit":131,"frame":150,"settle":512}]';
begin
  set local role rls_client;
  set local test.uid = '';
  -- Expo Go: no channel stamp, and the row says so with a null.
  insert into public.tab_traces (platform, os_version, is_dev, channel, switches)
  values ('ios', '26.3', false, null, one);
  -- A platform this file did not anticipate is stored, not refused: the
  -- enumeration `deck_traces` shipped with threw every row away.
  insert into public.tab_traces (platform, switches) values ('web', one);
  begin
    insert into public.tab_traces (platform, switches) values ('', one);
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.tab_traces (platform, switches) values ('ios', '{"not":"an array"}');
  exception when check_violation then refused := refused + 1;
  end;
  -- Nothing pressed is nothing to file.
  begin
    insert into public.tab_traces (platform, switches) values ('ios', '[]');
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.tab_traces (platform, switches)
    values ('ios', (select jsonb_agg(i) from generate_series(1, 61) i));
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.tab_traces (platform, switches)
    values ('ios', (select jsonb_agg(repeat(md5(i::text), 20)) from generate_series(1, 60) i));
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.tab_traces (platform, channel, switches) values ('ios', repeat('x', 41), one);
  exception when check_violation then refused := refused + 1;
  end;
  select count(*) into mine from public.tab_traces;
  reset role;

  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  select count(*) into desk from public.tab_traces;
  reset role;

  assert refused = 6, format('%s of 6 malformed tab traces were refused', refused);
  assert mine = 0, 'a phone can read tab traces back';
  assert desk = 2, format('the desk read %s tab traces, not the 2 filed', desk);
end $$;

delete from public.tab_traces;
