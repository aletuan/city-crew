-- What the `source` backfill decided about the rows in `source_seed.sql`.
--
-- Two of the four buckets are recorded fact and need only reading back.
-- The other two are inferred, and the inference is the part worth pinning:
-- a scan run is separated from a desk import by a burst window vetoed by a
-- photo count, and neither half of that is obvious enough to survive a
-- later edit unwatched.

do $$
declare bad text;
begin
  select string_agg(format('%s got %s, wanted %s', slug, coalesce(source, 'NULL'), want), '; ')
    into bad
    from (
      select slug, source,
             case
               when slug in ('cafe-apartment', 'pho-le') then 'seed'
               when slug like 'src-scan-%' then 'scan'
               when slug like 'src-desk-%' then 'desk'
               else 'phone'
             end as want
        from public.places
       where slug like 'src-%' or slug in ('cafe-apartment', 'pho-le')
    ) t
   where source is distinct from want;
  assert bad is null, format('the backfill mislabelled rows: %s', bad);
end $$;

-- The veto, named on its own because it is the part that fails quietly:
-- drop the photo condition and this row becomes 'scan', which reads as
-- "a machine chose it" about a place an editor picked by hand.
do $$
begin
  assert (select source from public.places where slug = 'src-desk-veto') = 'desk',
    'a hand-imported place inside the burst window was filed as a scan';
end $$;

-- Only the four words. Anything else is a caller inventing a pipeline.
do $$
begin
  begin
    update public.places set source = 'api' where slug = 'src-desk-a';
    assert false, 'source accepted a value outside the four';
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
   where table_schema = 'public' and table_name = 'places' and column_name = 'source';
  assert nullable = 'YES', 'source became NOT NULL — unattributed rows now have to lie';
end $$;

delete from public.places where slug like 'src-%' or slug in ('cafe-apartment', 'pho-le');

select 'all source checks passed' as result;
