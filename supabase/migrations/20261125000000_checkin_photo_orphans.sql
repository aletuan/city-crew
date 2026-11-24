-- What `prune-checkin-photos` takes, and what it reports (K2 of
-- `docs/checkin-photos-plan.md`).
--
-- A file in `checkin-photos` with no row naming it is an orphan. Three
-- ways one is made, none of them a client's doing — no client can write
-- the bucket:
--
--   · a visit removed: its rows go by cascade, and a cascade cannot
--     reach Storage;
--   · an account deleted the same way, when `delete-account`'s own
--     removal of the files did not finish;
--   · `checkin-photo` stored the file and then failed to take it back
--     after its row was refused.
--
-- Only a definer function can see `storage.objects` beside
-- `checkin_photos`, so the database picks and the Edge Function acts, as
-- `prune-photos` does for the catalog's bucket. An hour's grace: a file
-- between its upload and its row is not an orphan yet. The function
-- asks again for each path before removing it, so the hour is a
-- courtesy, not the safety.
--
-- And the bucket's size, for the same run to report: the plan asks that
-- its growth be watched, and the cheapest watcher is the job that
-- already looks.

create or replace function public.checkin_photo_orphans(p_limit integer default 100)
returns table (name text)
language sql
stable
security definer
set search_path = public
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'checkin-photos'
     and o.created_at < now() - interval '1 hour'
     and not exists (select 1 from public.checkin_photos p where p.path = o.name)
   order by o.created_at
   limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.checkin_photos_usage()
returns table (files bigint, bytes bigint, accounts bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), coalesce(sum((o.metadata->>'size')::bigint), 0), count(distinct split_part(o.name, '/', 1))
    from storage.objects o
   where o.bucket_id = 'checkin-photos';
$$;

revoke all on function public.checkin_photo_orphans(integer) from public, anon, authenticated;
revoke all on function public.checkin_photos_usage() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.checkin_photo_orphans(integer) to service_role;
    grant execute on function public.checkin_photos_usage() to service_role;
  end if;
end $$;
