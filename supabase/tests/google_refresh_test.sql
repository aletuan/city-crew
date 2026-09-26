-- The Google refresh migration: five columns, a memory started from today's
-- values, and a second run that leaves the job's own writes alone.
--
-- The rows are set up *before* the migration is applied a second time, so
-- the backfill is exercised on data rather than on an empty table; the
-- first application (in run.sh) met no rows at all.

\set ON_ERROR_STOP on

insert into public.places (slug, google_place_id, website, phone, desc_en, reviewer_source)
values
  ('as-imported', 'g1', 'https://old.example.vn', '+84 1', 'Google words.', 'google'),
  ('desk-wrote',  'g2', 'https://desk.example.vn', null,   'Our words.',    'editorial'),
  ('bare',        'g3', null,                     null,   null,            null);

-- Undo what the first application may have filled, then apply it for real.
update public.places set google_website = null, google_phone = null, google_summary = null,
                         google_refreshed_at = null;
\ir ../migrations/20260926230000_google_refresh.sql

do $$
declare r record;
begin
  select * into r from public.places where slug = 'as-imported';
  if r.google_website is distinct from 'https://old.example.vn' then
    raise exception 'website memory not started from today''s value: %', r.google_website;
  end if;
  if r.google_phone is distinct from '+84 1' then
    raise exception 'phone memory not started from today''s value: %', r.google_phone;
  end if;
  if r.google_summary is distinct from 'Google words.' then
    raise exception 'summary not copied where the desk marked it Google''s: %', r.google_summary;
  end if;

  select * into r from public.places where slug = 'desk-wrote';
  if r.google_summary is not null then
    raise exception 'the desk''s own words were filed as Google''s summary';
  end if;

  select * into r from public.places where slug = 'bare';
  if r.google_website is not null or r.google_phone is not null or r.google_summary is not null then
    raise exception 'an empty row came out of the backfill with something in it';
  end if;
end $$;

-- A refresh has run: Google has no website for this place any more, and the
-- desk has since typed one. Re-applying the file must not take the desk's
-- value for Google's.
update public.places
   set google_refreshed_at = now(), google_website = null, website = 'https://desk-typed.example.vn'
 where slug = 'as-imported';
\ir ../migrations/20260926230000_google_refresh.sql

do $$
begin
  if (select google_website from public.places where slug = 'as-imported') is not null then
    raise exception 'a second run overwrote the memory of a row the job had already refreshed';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'places_google_refresh_due') then
    raise exception 'the index the job reads by is missing';
  end if;
end $$;

delete from public.places where slug in ('as-imported', 'desk-wrote', 'bare');

select 'all google refresh checks passed' as result;
