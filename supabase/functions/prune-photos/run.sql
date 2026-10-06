-- One pass over the files in `place-photos` that no row points at.
-- Run by hand, in the SQL editor, when the count below says there is
-- something to take out; not a migration, for the reason the other
-- `cron.sql` files give — it mints a secret at the time, and the local
-- test harness has neither pg_net nor a storage schema.
--
-- ── what counts as an orphan ──
--
-- An object in the bucket that no `place_photos.storage_path` names, no
-- `place_photos.photo_uri` ends in, and no `cities.hero_photo_path`
-- names — and that is at least an hour old, so an upload still between
-- its storage write and its row insert is not taken from under it. The
-- function re-checks every path before removing it (see `index.ts`), so
-- the hour is a courtesy, not the safety.
--
-- ── how to run it ──
--
--   1. The count. If it is zero, stop here.
--   2. Mint the token (an hour is plenty) and send the dry run.
--   3. Read `net._http_response` for the answer: `would_remove` is the
--      list, `kept` is what the function refused and why.
--   4. Send the real run. Read the responses again; `removed` per call.
--   5. Take the token back: delete the row, or expire and rotate it if
--      the client you are in balks at a DELETE (the MCP editor did, on
--      the first run — an UPDATE went through, and an expired row is as
--      dead to the gate as a missing one).
--
-- 6 Oct 2026: 56 orphans, 18.9 MB. Two files under `cities/` were in the
-- naive count and are not orphans — the city heroes.

-- 1. The count.
select count(*), pg_size_pretty(sum((so.metadata->>'size')::bigint)) as size
from storage.objects so
where so.bucket_id = 'place-photos'
  and so.name not like 'cities/%'
  and so.created_at < now() - interval '1 hour'
  and not exists (select 1 from public.place_photos pp where pp.storage_path = so.name)
  and not exists (select 1 from public.place_photos pp where pp.photo_uri like '%/place-photos/' || so.name)
  and not exists (select 1 from public.cities c where c.hero_photo_path = so.name);

-- 2. The token, and the run. Set `dry` to true the first time.
insert into public.ops_tokens (name, token, expires_at)
values ('prune-photos', encode(gen_random_bytes(32), 'hex'), now() + interval '1 hour')
on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at;

do $run$
declare
  dry boolean := true;                 -- flip to false for the real pass
  anon text := '<anon key>';
  tok text;
  c record;
begin
  select token into tok from public.ops_tokens where name = 'prune-photos' and expires_at > now();
  if tok is null then raise exception 'no live prune-photos token'; end if;
  for c in
    with orphan as (
      select so.name
      from storage.objects so
      where so.bucket_id = 'place-photos'
        and so.name not like 'cities/%'
        and so.created_at < now() - interval '1 hour'
        and not exists (select 1 from public.place_photos pp where pp.storage_path = so.name)
        and not exists (select 1 from public.place_photos pp where pp.photo_uri like '%/place-photos/' || so.name)
        and not exists (select 1 from public.cities ci where ci.hero_photo_path = so.name)
      order by so.name
    )
    select array_agg(name order by name) as paths
    from (select name, (row_number() over (order by name) - 1) / 40 as g from orphan) t
    group by g
  loop
    perform net.http_post(
      url := 'https://amdvitzpogaejzzqroco.supabase.co/functions/v1/prune-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', anon,
        'Authorization', 'Bearer ' || anon,
        'x-ops-token', tok),
      body := jsonb_build_object('paths', to_jsonb(c.paths), 'dry', dry),
      timeout_milliseconds := 60000);
  end loop;
end $run$;

-- 3./4. The answers, newest first.
select id, status_code, created, content::text
from net._http_response order by created desc limit 5;

-- 5. Done.
delete from public.ops_tokens where name = 'prune-photos';
-- or, where a DELETE will not run:
-- update public.ops_tokens set expires_at = now() - interval '1 minute',
--   token = encode(gen_random_bytes(32), 'hex') where name = 'prune-photos';
