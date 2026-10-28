-- The review pace column: there, a real, empty until the job measures, and
-- untouched by a second run of its migration.

\set ON_ERROR_STOP on

insert into public.places (slug, google_place_id) values ('paced', 'gp1');

do $$
declare c record;
begin
  select data_type, is_nullable into c from information_schema.columns
   where table_schema = 'public' and table_name = 'places' and column_name = 'review_pace';
  if c is null then raise exception 'places.review_pace is missing'; end if;
  if c.data_type <> 'real' then raise exception 'review_pace is %, not real', c.data_type; end if;
  if c.is_nullable <> 'YES' then raise exception 'review_pace must be null until measured'; end if;
  if (select review_pace from public.places where slug = 'paced') is not null then
    raise exception 'a place has a pace before any refresh measured one';
  end if;
end $$;

-- The job writes one, and the file applied again leaves it.
update public.places set review_pace = 134.4 where slug = 'paced';
\ir ../migrations/20261028073138_review_pace.sql

do $$
begin
  if (select review_pace from public.places where slug = 'paced') is distinct from 134.4::real then
    raise exception 'a second run of the migration touched a measured pace';
  end if;
end $$;

delete from public.places where slug = 'paced';

select 'all review pace checks passed' as result;
