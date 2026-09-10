-- Every function in this schema pins its own search path, and the two
-- triggers that were the last to do so still do their jobs with it empty.

do $$
declare loose text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into loose
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert loose is null, format('functions with a search path left to the caller: %s', loose);
end $$;

-- The triggers, with the path they now run on.
insert into public.places (id, slug, is_published, review_status)
values ('d5000000-0000-0000-0000-0000000000f1', 'path-place', true, 'approved');
update public.places set updated_at = '2000-01-01', threads_handle = '  https://www.threads.net/@Some.Cafe/post/1?x=y '
where id = 'd5000000-0000-0000-0000-0000000000f1';
do $$
declare r record;
begin
  select updated_at, threads_handle into r from public.places where id = 'd5000000-0000-0000-0000-0000000000f1';
  assert r.updated_at > now() - interval '1 minute', format('updated_at was not stamped: %s', r.updated_at);
  assert r.threads_handle = 'some.cafe', format('threads handle came out as %s', r.threads_handle);
end $$;
delete from public.places where id = 'd5000000-0000-0000-0000-0000000000f1';

select 'all search path checks passed' as result;
