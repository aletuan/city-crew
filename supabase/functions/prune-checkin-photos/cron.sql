-- The daily pass that takes orphaned check-in photos out of Storage and
-- reports the bucket's size. Applied by hand, once, against the project;
-- not a migration, for the reason `shrink-photos/cron.sql` gives — it
-- mints a secret at the time, and the local harness has neither pg_cron
-- nor pg_net.
--
-- Reading the answer: `select status_code, content from net._http_response
-- order by created desc limit 5;` — `removed`, `kept`, and `usage`
-- (files, bytes, accounts). The plan asks that the bucket's growth be
-- watched; that line is where it is.
--
--   select cron.unschedule('prune-checkin-photos');   -- to stop it

create extension if not exists pg_cron;

insert into public.ops_tokens (name, token, expires_at)
values ('prune-checkin-photos', encode(gen_random_bytes(32), 'hex'), now() + interval '1 year')
on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at;

select cron.schedule('prune-checkin-photos', '23 3 * * *', $cron$
do $job$
declare
  tok text;
  anon text := '<anon key>';
begin
  select token into tok from public.ops_tokens where name = 'prune-checkin-photos' and expires_at > now();
  if tok is null then return; end if;
  perform net.http_post(
    url := 'https://amdvitzpogaejzzqroco.supabase.co/functions/v1/prune-checkin-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon,
      'Authorization', 'Bearer ' || anon,
      'x-ops-token', tok),
    body := jsonb_build_object('limit', 200),
    timeout_milliseconds := 60000);
end $job$;
$cron$);
