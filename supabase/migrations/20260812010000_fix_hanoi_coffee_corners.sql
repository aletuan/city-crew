-- hanoi-coffee-corners was a coffee list with no coffee in it.
--
-- The collection shipped with one member — The Hanoi Social Club, a
-- `nightlife` bar — while 22 published `cafes` places in Hanoi belonged to no
-- collection at all. Members were almost certainly lost the same way HCMC's
-- were (places deleted, collection_places cascading away), leaving whichever
-- row happened to survive; a one-member list still renders, so nothing ever
-- flagged it.
--
-- Seven cafés, one per operator, spread across six neighbourhoods so the list
-- reads as a trail across the city rather than a single block of Hoàn Kiếm.
-- MONO, 3C, Deep Sii and Everything Coffee each run multiple branches in the
-- catalog; only the strongest branch of each is here, because a collection
-- listing three MONO addresses is a directory, not a recommendation.
--
-- Idempotent: membership upserts on (collection_id, place_id), and the wrong
-- member is removed by slug rather than by position.

-- Drop the nightlife bar. Scoped to this one collection — the place itself
-- stays published and keeps its place in hanoi-lakes-rooftops, where a bar
-- belongs.
delete from public.collection_places cp
using public.collections c, public.places p
where cp.collection_id = c.id
  and cp.place_id = p.id
  and c.slug = 'hanoi-coffee-corners'
  and p.slug = 'the-hanoi-social-club';

insert into public.collection_places (collection_id, place_id, sort_order)
select c.id, p.id, m.pos
from (values
  ('hanoi-coffee-corners', 'every-half-coffee-roasters-pho-cha-ca',      0),  -- Hoàn Kiếm
  ('hanoi-coffee-corners', 'the-running-bean-nha-tho-coffee-and-brunch', 1),  -- Hoàn Kiếm
  ('hanoi-coffee-corners', 'ta-coffee',                                  2),  -- Hoàn Kiếm
  ('hanoi-coffee-corners', 'mono-coffee-lab-van-ho',                     3),  -- Hai Bà Trưng
  ('hanoi-coffee-corners', 'acid8-specialty-coffee',                     4),  -- Cửa Nam
  ('hanoi-coffee-corners', 'tranquil',                                   5),  -- Ba Đình
  ('hanoi-coffee-corners', '3c-roastery-92-phan-ke-binh',                6)   -- Ngọc Hà
) as m(collection_slug, place_slug, pos)
join public.collections c on c.slug = m.collection_slug
join public.places      p on p.slug = m.place_slug and p.city_id = 'hanoi'
on conflict (collection_id, place_id) do update set sort_order = excluded.sort_order;

-- Pin the cover now that a real lead member exists. Same rule as the Da Nang
-- collections: the app already falls back to this exact photo, so pinning it
-- only stops the cover from moving when an editor reorders the list.
update public.collections c set cover_photo_id = (
  select ph.id
  from public.collection_places cp
  join public.places p        on p.id = cp.place_id
  join public.place_photos ph on ph.place_id = p.id and not ph.is_hidden
  where cp.collection_id = c.id and cp.sort_order = 0
  order by ph.is_cover desc, ph.sort_order
  limit 1
)
where c.slug = 'hanoi-coffee-corners';
