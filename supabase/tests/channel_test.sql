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

-- Desk and scan carry the one account the allow-list resolves to. Nobody
-- recorded them at the time; this is the arithmetic of a gate that only
-- one account can pass, and it is only allowed to run while that stays
-- true — see the two-editor case below.
do $$
declare wrong text;
begin
  select string_agg(slug, ', ') into wrong
    from public.places
   where slug like 'src-%' and channel in ('desk', 'scan')
     and added_by is distinct from 'eee00000-0000-0000-0000-00000000000e';
  assert wrong is null, format('desk/scan rows without the editor on them: %s', wrong);
end $$;

-- Seed keeps its blank, and that one is not a guess either way: the
-- bootstrap ran as a script under the service role, so no account did it.
do $$
begin
  assert not exists (
    select 1 from public.places where channel = 'seed' and added_by is not null
  ), 'a seed row was given an account, and no account created one';
end $$;

select 'all channel checks passed' as result;
