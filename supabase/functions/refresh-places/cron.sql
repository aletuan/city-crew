-- The nightly pass that asks Google again about the places it answered for
-- longest ago. Applied by hand, once, against the project; not a migration,
-- for the reason `shrink-photos/cron.sql` gives: it mints a secret at the
-- time, and the local test harness has neither pg_cron nor pg_net.
--
-- ── what it does ──
--
-- Every night at 02:43 in Hồ Chí Minh City (19:43 UTC, when nobody is
-- planning a day), pick up to 60 places with a `google_place_id` that Google
-- has not answered for in 25 days — never-refreshed rows first — and hand
-- them to `refresh-places` ten at a time. What a refresh may overwrite is
-- `_shared/refresh-place.ts`; why 25 days is C1 in
-- `docs/tech-eval-app-store.md`: the window commonly read into Google's
-- terms is 30, and a place that fails one night is simply first the next.
--
-- ── the numbers ──
--
-- 735 places on 26 September 2026. Sixty a night is 1,500 per 25 days, so
-- the first pass over the backlog takes 13 nights and after that the job
-- needs about 30 a night; the slack is for growth and for nights that fail.
-- When nothing is due, the pass makes no calls at all.
--
-- Each place is one Place Details call, billed at the rate of the most
-- expensive field in the mask — `editorialSummary`, kept by choice. Cost
-- scales with the catalog, not with readers: roughly 30 calls a day.
--
-- ── the token ──
--
-- The job speaks to the function with the `ops_tokens` row named
-- `refresh-places`, in an `x-ops-token` header. The gate refuses an expired
-- row, so the job goes quiet on the date below rather than failing loudly;
-- mint a new one the same way to keep it going.
--
--   select cron.unschedule('refresh-places');   -- to stop it

create extension if not exists pg_cron;

insert into public.ops_tokens (name, token, expires_at)
values ('refresh-places', encode(gen_random_bytes(32), 'hex'), now() + interval '1 year')
on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at;

select cron.schedule('refresh-places', '43 19 * * *', $cron$
do $job$
declare
  tok text;
  anon text := '<anon key>';
  c record;
begin
  select token into tok from public.ops_tokens where name = 'refresh-places' and expires_at > now();
  if tok is null then return; end if;
  for c in
    with due as (
      select id, google_refreshed_at
      from public.places
      where google_place_id is not null
        and (google_refreshed_at is null or google_refreshed_at < now() - interval '25 days')
      order by google_refreshed_at asc nulls first, id
      limit 60
    )
    select array_agg(id::text order by id) as ids
    from (select id, (row_number() over (order by google_refreshed_at asc nulls first, id) - 1) / 10 as g
          from due) t
    group by g
  loop
    perform net.http_post(
      url := 'https://amdvitzpogaejzzqroco.supabase.co/functions/v1/refresh-places',
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
