-- What the two provenance migrations decide about the rows in
-- `channel_seed.sql`: which door each came in through, and who did it.
--
-- Two of the four channels are recorded fact and need only reading back.
-- The other two are inferred, and the inference is the part worth pinning:
-- a scan run is separated from a desk import by a burst window vetoed by a
-- photo count, and neither half of that is obvious enough to survive a
-- later edit unwatched.

do $$
declare bad text;
begin
  select string_agg(format('%s got %s, wanted %s', slug, coalesce(channel, 'NULL'), want), '; ')
    into bad
    from (
      select slug, channel,
             case
               when slug in ('cafe-apartment', 'pho-le') then 'seed'
               when slug like 'src-scan-%' then 'scan'
               when slug like 'src-desk-%' then 'desk'
               else 'mobile'
             end as want
        from public.places
       where slug like 'src-%' or slug in ('cafe-apartment', 'pho-le')
    ) t
   where channel is distinct from want;
  assert bad is null, format('the backfill mislabelled rows: %s', bad);
end $$;

-- The veto, named on its own because it is the part that fails quietly:
-- drop the photo condition and this row becomes 'scan', which reads as
-- "a machine chose it" about a place an editor picked by hand.
do $$
begin
  assert (select channel from public.places where slug = 'src-desk-veto') = 'desk',
    'a hand-imported place inside the burst window was filed as a scan';
end $$;

-- 'phone' is gone, not merely unused: a row still wearing it would sit
-- outside every filter the desk offers.
do $$
begin
  assert not exists (select 1 from public.places where channel = 'phone'),
    'a row is still on the old phone value';
end $$;

-- Only the four words. Anything else is a caller inventing a pipeline.
do $$
begin
  begin
    update public.places set channel = 'api' where slug = 'src-desk-a';
    assert false, 'channel accepted a value outside the four';
  exception when check_violation then
    null;
  end;
end $$;

-- Nullable, and deliberately: a row nobody could attribute must be able to
-- say so rather than claim the most common origin.
do $$
declare nullable text;
begin
  select is_nullable into nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'places' and column_name = 'channel';
  assert nullable = 'YES', 'channel became NOT NULL — unattributed rows now have to lie';
end $$;

-- ─────────────────────────────── who did it ──────────────────────────────

-- Copied from `submitted_by` where it was recorded, which is the mobile
-- rows and only those.
do $$
begin
  assert (select added_by from public.places where slug = 'src-phone-a')
         = 'aaaaaaaa-0000-0000-0000-000000000001',
    'a mobile row lost the account that submitted it';
end $$;

-- And left alone everywhere else. Desk and scan are gated on an allow-list
-- that keeps no history, and seed ran as a script under no account at all;
-- a handle on either would be a guess wearing a person's name.
do $$
declare named int;
begin
  select count(*) into named from public.places
   where added_by is not null and channel <> 'mobile';
  assert named = 0,
    format('%s non-mobile rows were given an account nobody recorded', named);
end $$;

-- Distinct from `submitted_by`, which keeps its narrower meaning: the cap,
-- the contributor read policy and the app's "only you can see this" all
-- key off it, and widening it would change all three by accident.
do $$
begin
  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places' and column_name = 'submitted_by'
  ), 'submitted_by was removed — the daily cap and the contributor policy read it';
end $$;

delete from public.places where slug like 'src-%' or slug in ('cafe-apartment', 'pho-le');

select 'all channel checks passed' as result;
