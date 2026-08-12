-- Two new Hanoi collections, and a rename that stops one of them lying.
--
-- 35 of Hanoi's 58 published places belonged to no collection at all — 60%,
-- by far the worst of the three cities. Nine of those were sky bars and twelve
-- were restaurants, which is two obvious lists nobody had written yet.
--
-- ── hanoi-sky-bars ──────────────────────────────────────────────────────────
-- Eight rooftops, ordered by review volume so the ones a visitor has actually
-- heard of lead. Two of them (cloud-sky-bar-hanoi, may-de-ville-lakeside-
-- rooftop-bar) move here out of hanoi-lakes-rooftops: leaving them behind
-- would split Hanoi's rooftop bars across two collections and, worse, keep the
-- single strongest one (Cloud Sky Bar, 4.9 over 3,380 reviews) out of the
-- collection named for it.
--
-- Three `nightlife` places are deliberately NOT here, despite matching the
-- category filter: The Hanoi Social Club and MIDDLE CAFE are ground-level
-- music bars and The Old Well is a tiki bar. The category says nightlife; the
-- collection promises a view. They stay orphaned rather than pad this list.
--
-- ── hanoi-eats ──────────────────────────────────────────────────────────────
-- Seven restaurants, Vietnamese first then international, so the list reads as
-- a progression rather than a ranking. Only places whose sole category is
-- `eats`: four more (Hanoi Coffee Culture, The Hanoi Cafe, Briques, MONO
-- Pasteur) carry both `cafes` and `eats`, and belong to the coffee trail
-- instead — a café appearing in both lists would make the two collections read
-- as the same list twice. Taco Non La is left out on quality (3.8).
--
-- ── the rename ──────────────────────────────────────────────────────────────
-- hanoi-lakes-rooftops has been "Lakes & rooftops" over four parks and two
-- bars, with no lake among the members. Moving the bars out leaves the four
-- parks — and all four DO sit on lakes (Thống Nhất on Bảy Mẫu, Yên Sở, Starlake,
-- Indira Gandhi), so the collection finally becomes what its name claimed.
-- Retitled to "Parks & lakes" and moved to sort_order 6, behind the two new
-- lists, since a park list is the weaker draw.
--
-- sort_order is not unique and nothing in the app breaks a tie — collections
-- come back in whatever order Postgres feels like within a duplicate. Hanoi's
-- existing lists occupy 1-3, so the new pair takes 4 and 5 and the parks move
-- to 6, leaving the city's six collections strictly ordered.
--
-- Idempotent: collections upsert on their unique slug, membership on
-- (collection_id, place_id), and the two moved bars are removed from their old
-- collection by slug rather than by position.

insert into public.collections
  (slug, city_id, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, is_public, sort_order)
values
  ('hanoi-sky-bars', 'hanoi',
   'Sky bars over the Old Quarter',
   'Sky bar trên nóc phố cổ',
   '旧市街を見下ろすスカイバー',
   'Eight rooftops, most of them a short walk from Hoàn Kiếm — the city gets quieter the higher you go.',
   'Tám sân thượng, phần lớn chỉ cách Hoàn Kiếm vài bước — càng lên cao thành phố càng lặng.',
   '八つの屋上、その多くはホアンキエムから徒歩圏 — 高く昇るほど街は静かになる。',
   '@hanoicrew', true, 4),

  ('hanoi-eats', 'hanoi',
   'Sit-down dinners',
   'Quán ăn ngồi lâu được',
   'ゆっくり座れる夕食',
   'Ốc, chè and a garden of Vietnamese classics, then curry, flammkuchen and a bistro for the nights you want something else.',
   'Ốc, chè và một khu vườn món Việt, rồi cà ri, flammkuchen và bistro cho những tối muốn đổi vị.',
   'オック、チェー、ベトナム料理の庭 — そしてカレー、フラムクーヘン、ビストロ。',
   '@hanoicrew', true, 5)

on conflict (slug) do update set
  city_id        = excluded.city_id,
  title_en       = excluded.title_en,
  title_vi       = excluded.title_vi,
  title_ja       = excluded.title_ja,
  desc_en        = excluded.desc_en,
  desc_vi        = excluded.desc_vi,
  desc_ja        = excluded.desc_ja,
  curator_handle = excluded.curator_handle,
  is_public      = excluded.is_public,
  sort_order     = excluded.sort_order;

-- The parks collection becomes what it always claimed to be.
update public.collections set
  title_en   = 'Parks & lakes',
  title_vi   = 'Công viên & hồ',
  title_ja   = '公園と湖',
  desc_en    = 'Four lakesides with room to walk, when the Old Quarter gets to be too much.',
  desc_vi    = 'Bốn bờ hồ rộng chỗ đi bộ, cho lúc phố cổ trở nên quá chật.',
  desc_ja    = '旧市街に疲れたら、歩ける広さのある四つの湖畔へ。',
  sort_order = 6
where slug = 'hanoi-lakes-rooftops';

-- Move the two rooftop bars out of the parks list.
delete from public.collection_places cp
using public.collections c, public.places p
where cp.collection_id = c.id
  and cp.place_id = p.id
  and c.slug = 'hanoi-lakes-rooftops'
  and p.slug in ('cloud-sky-bar-hanoi', 'may-de-ville-lakeside-rooftop-bar');

insert into public.collection_places (collection_id, place_id, sort_order)
select c.id, p.id, m.pos
from (values
  ('hanoi-sky-bars', 'cloud-sky-bar-hanoi',                             0),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'solar-sky-bar',                                   1),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'moonlight-sky-bar',                               2),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'ozone-sky-lounge-restaurant-hanoi',               3),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'may-de-ville-lakeside-rooftop-bar',               4),  -- Phố cổ
  ('hanoi-sky-bars', 'terraco-sky-bar',                                 5),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'majesty-sky-bar',                                 6),  -- Hoàn Kiếm
  ('hanoi-sky-bars', 'lagoon-rooftop-ha-noi',                           7),  -- Hoàn Kiếm

  ('hanoi-eats',     'bong-oc-ngon-ha-noi',                             0),  -- Cửa Nam
  ('hanoi-eats',     'ngon-garden',                                     1),  -- Cửa Nam
  ('hanoi-eats',     'che-bon-mua',                                     2),  -- Phố cổ
  ('hanoi-eats',     'vi-an-145-hoang-cau',                             3),  -- Đống Đa
  ('hanoi-eats',     'fukujin-japanese-curry-house-hanoi-centre',       4),  -- Ô Chợ Dừa
  ('hanoi-eats',     'flambe-first-flammkuchen-restaurant-in-vietnam',  5),  -- Hoàn Kiếm
  ('hanoi-eats',     'bistro-niq',                                      6)   -- Ngọc Hà
) as m(collection_slug, place_slug, pos)
join public.collections c on c.slug = m.collection_slug
join public.places      p on p.slug = m.place_slug and p.city_id = 'hanoi'
on conflict (collection_id, place_id) do update set sort_order = excluded.sort_order;

-- Cover for the two new collections, and a fresh one for the parks list, whose
-- pinned cover was Cloud Sky Bar — a place that no longer belongs to it. Same
-- first-published-member-by-sort_order rule as the backfill migration.
update public.collections c set cover_photo_id = (
  select ph.id
  from public.collection_places cp
  join public.places p
    on p.id = cp.place_id
   and p.is_published
   and p.review_status = 'approved'
  join public.place_photos ph
    on ph.place_id = p.id
   and not ph.is_hidden
  where cp.collection_id = c.id
  order by cp.sort_order, ph.is_cover desc, ph.sort_order
  limit 1
)
where c.slug in ('hanoi-sky-bars', 'hanoi-eats', 'hanoi-lakes-rooftops');
