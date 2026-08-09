-- Multi-valued functional categories on places.
--
-- `category` ('food' | 'out') forced every place into one of two buckets, so
-- the Explore filter had to ship a chip literally named "Outdoors & culture"
-- — two intents wearing one label. And a place that is genuinely both (the
-- Temple of Literature is a park *and* heritage) had to pick a side.
--
-- `categories` is the functional axis done properly: what a place *is* and
-- what you do there, many per place. `vibe_tags` is left alone here; it is
-- reserved for how a place *feels*, which is editorial work of its own.
--
-- Backfill derives from the vibes already on each row — the only functional
-- signal the catalog stored. It cannot recover distinctions the data never
-- held (museums vs landmarks both land on 'heritage'); scans from here on
-- write the finer value directly, and editors refine the rest by hand.

alter table public.places
  add column if not exists categories text[] not null default '{}';

-- vibe → category. 'chill' is a feeling, not a category, so it maps to
-- nothing and drops out here.
update public.places p
set categories = coalesce((
  select array_agg(distinct m.c order by m.c)
  from unnest(coalesce(p.vibe_tags, '{}')) v
  cross join lateral (
    select case v
      when 'cafes'     then 'cafes'
      when 'food_tour' then 'eats'
      when 'views'     then 'views'
      when 'culture'   then 'heritage'
      when 'outdoors'  then 'nature'
      when 'shopping'  then 'markets'
      when 'nightlife' then 'nightlife'
    end as c
  ) m
  where m.c is not null
), '{}')
where p.categories = '{}';

-- Nothing may end up uncategorised: an empty array would make a place
-- unreachable from every chip. 'sights' is the honest coarse parent of
-- 'out' — it says "somewhere to go" without inventing a specific claim.
update public.places
set categories = case when category = 'food' then array['eats'] else array['sights'] end
where categories = '{}';

-- The vocabulary is closed on purpose: a typo in the dashboard or a new key
-- from a future scan would otherwise create a chip nobody designed.
alter table public.places drop constraint if exists places_categories_known;
alter table public.places add constraint places_categories_known check (
  categories <@ array['cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife', 'sights']
  and cardinality(categories) > 0
);

create index if not exists places_categories_idx on public.places using gin (categories);
