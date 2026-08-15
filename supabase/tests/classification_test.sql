-- What `needs_classification` says, and what it refuses to be told.
--
-- The column exists so the desk can see the one state its filter row
-- cannot express: a place carrying no tags at all is absent from every
-- chip's count, so it is invisible in exactly the screen meant to find it.
-- These checks pin the truth table, and pin that it stays computed —
-- a flag somebody can set by hand is a flag that goes stale.

insert into public.places (slug, city_id, categories, vibe_tags) values
  ('t-both',    'hcmc', '{cafes}', '{chill}'),
  ('t-nocat',   'hcmc', '{}',      '{chill}'),
  ('t-novibe',  'hcmc', '{cafes}', '{}'),
  ('t-neither', 'hcmc', '{}',      '{}'),
  ('t-default', 'hcmc', default,   default);

-- ------------------------------------------------------------ the table

do $$
declare bad text;
begin
  select string_agg(format('%s expected %s', slug, want), ', ')
    into bad
    from (
      select slug, needs_classification as got,
             slug <> 't-both' as want   -- everything but the filed one
        from public.places where slug like 't-%'
    ) t
   where got <> want;
  assert bad is null, format('needs_classification disagrees: %s', bad);
end $$;

-- Half-filed counts. A place with categories and no vibes is as unfindable
-- in the vibe row as an untagged one is everywhere, so `or` is the rule and
-- `and` would be a quieter, wronger column.
do $$
begin
  assert (select needs_classification from public.places where slug = 't-novibe'),
    'a place with no vibes reads as filed — the rule narrowed to AND';
  assert (select needs_classification from public.places where slug = 't-nocat'),
    'a place with no categories reads as filed — the rule narrowed to AND';
end $$;

-- The default row is the one that matters most in practice: `importPlace`
-- writes neither array, so every place arrives here.
do $$
begin
  assert (select needs_classification from public.places where slug = 't-default'),
    'a freshly imported place does not ask to be filed';
end $$;

-- ------------------------------------------------------- still computed

do $$
begin
  begin
    update public.places set needs_classification = false where slug = 't-neither';
    assert false, 'needs_classification took a hand-written value';
  exception when others then
    null;  -- generated columns reject the write, which is the point
  end;
end $$;

-- And it follows the arrays both ways, rather than being stamped once.
update public.places set categories = '{cafes}', vibe_tags = '{chill}' where slug = 't-neither';
do $$
begin
  assert not (select needs_classification from public.places where slug = 't-neither'),
    'filing a place left it still asking to be filed';
end $$;

update public.places set vibe_tags = '{}' where slug = 't-neither';
do $$
begin
  assert (select needs_classification from public.places where slug = 't-neither'),
    'emptying the vibes did not put the place back on the list';
end $$;

-- --------------------------------------------------------------- index

-- Partial and city-scoped, because the desk asks one city at a time and
-- the rows it wants are the rare ones.
do $$
declare def text;
begin
  select indexdef into def from pg_indexes
   where schemaname = 'public' and indexname = 'places_needs_classification_idx';
  assert def is not null, 'the index is missing';
  assert def like '%WHERE needs_classification%',
    format('the index stopped being partial: %s', def);
  assert def like '%(city_id)%',
    format('the index stopped being city-scoped: %s', def);
end $$;

delete from public.places where slug like 't-%';

select 'all classification checks passed' as result;
