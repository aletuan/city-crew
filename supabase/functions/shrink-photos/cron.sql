-- The hourly pass that keeps every photo in Storage at the size the app
-- draws. Applied by hand, once, against the project; not a migration,
-- because it needs a secret minted at the time and the local test
-- harness has neither pg_cron nor pg_net nor a storage schema.
--
-- ── what it does ──
--
-- Every hour, pick up to 90 rows of `place_photos` whose file in the
-- `place-photos` bucket is still big — over 240 KB, or not a JPEG — and
-- does not yet carry the `shrunk` mark, and hand them to `shrink-photos`
-- three at a time (its CPU budget per request). New imports arrive at
-- Google's 1200px JPEG, which is above that size more often than not,
-- so this is what brings them down to the catalog's weight within the
-- hour. When nothing is big, the pass makes no calls at all.
--
-- ── the token ──
--
-- The job speaks to the function with the `ops_tokens` row named
-- `shrink-photos`, in an `x-ops-token` header. The gate refuses an
-- expired row, so the job goes quiet on the date below rather than
-- failing loudly; mint a new one the same way to keep it going.
--
--   select cron.unschedule('shrink-photos');   -- to stop it

create extension if not exists pg_cron;

insert into public.ops_tokens (name, token, expires_at)
values ('shrink-photos', encode(gen_random_bytes(32), 'hex'), now() + interval '1 year')
on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at;

select cron.schedule('shrink-photos', '7 * * * *', $cron$
do $job$
declare
  tok text;
  anon text := '<anon key>';
  c record;
begin
  select token into tok from public.ops_tokens where name = 'shrink-photos' and expires_at > now();
  if tok is null then return; end if;
  for c in
    with need as (
      select ph.id
      from public.place_photos ph
      join storage.objects o on o.bucket_id = 'place-photos' and o.name = ph.storage_path
      where (o.user_metadata->>'shrunk') is null
        and ((o.metadata->>'size')::bigint > 245760 or ph.storage_path !~* '\.jpg$')
      order by ph.id
      limit 90
    )
    select array_agg(id::text order by id) as ids
    from (select id, (row_number() over (order by id) - 1) / 3 as g from need) t
    group by g
  loop
    perform net.http_post(
      url := 'https://amdvitzpogaejzzqroco.supabase.co/functions/v1/shrink-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', anon,
        'Authorization', 'Bearer ' || anon,
        'x-ops-token', tok),
      body := jsonb_build_object('ids', to_jsonb(c.ids)),
      timeout_milliseconds := 90000);
  end loop;
end $job$;
$cron$);
