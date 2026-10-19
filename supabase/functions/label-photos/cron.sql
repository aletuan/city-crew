-- The hourly pass that labels the photographs the catalog gains between
-- runs (docs/photo-labels.md §11, owner 17 Oct 2026). Applied by hand,
-- once, against the project; not a migration, for the reason
-- `shrink-photos/cron.sql` gives: it needs a secret minted at the time,
-- and the local test harness has neither pg_cron nor pg_net.
--
-- ── what it does ──
--
-- Every hour, pick up to 240 stored photographs with no label at version
-- 4 or later and hand them to `label-photos` with Haiku 5.5, 24 to a
-- request; the function labels them at the current `VERSION`. When
-- nothing is missing the pass makes no calls at all.
--
-- The 4 does not follow `VERSION` up to 5 (18 Oct 2026). v5 added the
-- `garden` kind, and the owner had the photographs v4 was unsure of, or
-- called `other`, asked again — not the 5,800 it was sure of, whose kinds
-- v5 does not change. Raising this would ask every one of them again, at
-- 240 an hour. Nor up to 6 through 14: v6 narrowed `garden`, v7 added
-- `heritage`, v8 `collage`, v9 the gate onto a garden, v10 the covered
-- terrace and the room seen through glass, v11 the seats along the
-- street front, v12 the gate filling the frame and the seats before a
-- view, v13 the museum and the craft village as heritage, v14 the decor
-- inside a room and the monument seen through a window, and the
-- photographs each could change were asked again by hand once
-- (docs/photo-labels.md §13).
--
-- Why a pass and not a trigger on insert: a photograph is labelled from
-- its file in the bucket, which `storage_path` names only once the file
-- is there, and a call that fails (the API could not fetch the image,
-- the function answered 503 — both happened in the catalog run) is simply
-- picked up again the next hour. A trigger would fire once and forget.
--
-- 240 an hour is ten requests at once, under the sixty that ran without
-- a 503 in the catalog run. The catalog grew by eighteen photographs in
-- the hour it was labelled, so this is room, not a bottleneck. At the
-- run's ~0.036 cent a photograph, a full pass costs under ten cents.
--
-- ── the token ──
--
-- As `shrink-photos`: the `ops_tokens` row named `label-photos`, in an
-- `x-ops-token` header, minted here for a year. The catalog run's token
-- had the same name and was expired after it; this replaces it.
--
--   select cron.unschedule('label-photos');   -- to stop it

create extension if not exists pg_cron;

insert into public.ops_tokens (name, token, expires_at)
values ('label-photos', encode(gen_random_bytes(32), 'hex'), now() + interval '1 year')
on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at;

select cron.schedule('label-photos', '23 * * * *', $cron$
do $job$
declare
  tok text;
  anon text := '<anon key>';
  c record;
begin
  select token into tok from public.ops_tokens where name = 'label-photos' and expires_at > now();
  if tok is null then return; end if;
  for c in
    with need as (
      select ph.id
      from public.place_photos ph
      where ph.storage_path is not null and ph.photo_uri is not null
        and not exists (
          select 1 from public.photo_scores s
          where s.photo_id = ph.id and s.scorer = 'claude-labels' and s.scorer_version >= 4)
      order by ph.id
      limit 240
    )
    select array_agg(id::text order by id) as ids
    from (select id, (row_number() over (order by id) - 1) / 24 as g from need) t
    group by g
  loop
    perform net.http_post(
      url := 'https://amdvitzpogaejzzqroco.supabase.co/functions/v1/label-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', anon,
        'Authorization', 'Bearer ' || anon,
        'x-ops-token', tok),
      body := jsonb_build_object('photo_ids', to_jsonb(c.ids), 'model', 'claude-haiku-5-5'),
      timeout_milliseconds := 150000);
  end loop;
end $job$;
$cron$);
