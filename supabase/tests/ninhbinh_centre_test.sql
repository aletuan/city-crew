-- Ninh Bình's centre: moved from the city to Tam Cốc – Tràng An, once, and
-- only from the point it was moved away from.
--
-- The row was added on the live project by hand, not by a migration, so
-- the test brings its own: one at the old point, one the desk had already
-- moved, and Vũng Tàu, which the file must not touch.

\set ON_ERROR_STOP on

-- `_collections.sql` stubs `cities` down to its key; the centre is the one
-- thing this file is about, so the test gives the stub the two columns.
alter table public.cities
  add column if not exists center_lat double precision,
  add column if not exists center_lng double precision;

insert into public.cities (id, center_lat, center_lng) values
  ('ninhbinh', 20.2506, 105.9745),
  ('vungtau',  10.346,  107.0843)
on conflict (id) do update set center_lat = excluded.center_lat, center_lng = excluded.center_lng;

\ir ../migrations/20261028135445_ninhbinh_centre_tam_coc.sql

do $$
declare c record;
begin
  select center_lat, center_lng into c from public.cities where id = 'ninhbinh';
  if c.center_lat <> 20.2277 or c.center_lng <> 105.9296 then
    raise exception 'Ninh Bình did not move to Tam Cốc – Tràng An: %, %', c.center_lat, c.center_lng;
  end if;
  select center_lat, center_lng into c from public.cities where id = 'vungtau';
  if c.center_lat <> 10.346 or c.center_lng <> 107.0843 then
    raise exception 'Vũng Tàu moved, and it was to stay: %, %', c.center_lat, c.center_lng;
  end if;
end $$;

-- The desk moves it somewhere else by hand; the file, run again, leaves that.
update public.cities set center_lat = 20.24, center_lng = 105.93 where id = 'ninhbinh';
\ir ../migrations/20261028135445_ninhbinh_centre_tam_coc.sql

do $$
begin
  if (select center_lat from public.cities where id = 'ninhbinh') <> 20.24 then
    raise exception 'a second run overwrote a centre the desk had chosen';
  end if;
end $$;

delete from public.cities where id in ('ninhbinh', 'vungtau');

select 'all ninh binh centre checks passed' as result;
