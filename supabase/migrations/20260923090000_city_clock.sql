-- Each city carries its clock.
--
-- For as long as every city was in Vietnam, the app read a place's local
-- time as UTC plus seven — one constant, no daylight saving since 1975.
-- Melbourne arrived and the constant went on adding seven hours to a city
-- ten hours ahead, eleven from October: a reader outside a Melbourne café
-- at five to five, door open, hours 3 PM to 10 PM, was told "Closed ·
-- opens 15:00", because the app had read the clock at five to two.
--
-- So the zone is a column, as an IANA name the runtime's own timezone
-- database can answer for — `Australia/Melbourne`, `Asia/Ho_Chi_Minh` —
-- rather than an offset, which would have to change twice a year by
-- hand. The default is Vietnam, which is right for seven cities of
-- eight; the eighth is set below.
--
-- The check is the shape of an IANA name (`Area/Location`, with the
-- underscores and the occasional hyphen or plus those carry), not the
-- list of them: Postgres knows the list (`pg_timezone_names`), but a
-- check that queried it would refuse a valid new zone the day the
-- database's tzdata lagged the phone's. The app itself falls back to
-- Vietnam for a name the runtime refuses, so a typo here costs Melbourne
-- three hours rather than the feed.

alter table public.cities
  add column tz text not null default 'Asia/Ho_Chi_Minh';

alter table public.cities
  add constraint cities_tz_is_iana check (tz ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$');

comment on column public.cities.tz is
  'IANA zone the city''s opening hours are read on, e.g. Australia/Melbourne. See app/src/lib/clock.ts.';

update public.cities set tz = 'Australia/Melbourne' where id = 'melbourne';
