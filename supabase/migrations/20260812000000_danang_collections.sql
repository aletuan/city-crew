-- Da Nang gets its first three public collections.
--
-- The city has had 21 published places since the multi-city import, but no
-- collections at all — so its Collections tab rendered empty and the Explore
-- shelf skipped straight past. HCMC's six came from data/seeds/collections.json
-- and Hanoi's four were written straight to the database; this file is the
-- third path, and the one worth keeping: a migration the repo can replay.
--
-- Themes follow the same editorial rule the other cities use — group by what
-- the trip feels like, not by the `categories` array the filters already
-- expose. The three picked here are the ones Da Nang's catalog actually
-- supports at depth: five riverside rooftops, five museums-and-landmarks,
-- five bars that aren't rooftops. Cafés (1 place) and eats (1 place) are too
-- thin to carry a collection and are deliberately left out.
--
-- Idempotent throughout: collections upsert on their unique slug and
-- collection_places on its (collection_id, place_id) primary key, so a replay
-- refreshes copy and membership without duplicating rows.
--
-- Membership is resolved by slug scoped to city_id = 'danang'. Place slugs are
-- globally unique, but scoping keeps a future same-named place in another city
-- from silently joining a Da Nang list.

insert into public.collections
  (slug, city_id, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, is_public, sort_order)
values
  ('danang-rooftops', 'danang',
   'Rooftops over the Hàn',
   'Rooftop bên sông Hàn',
   'ハン川を望むルーフトップ',
   'Sunset to last call — the decks where Da Nang watches its river light up.',
   'Từ hoàng hôn đến tàn cuộc — những sân thượng ngắm sông Hàn lên đèn.',
   '夕暮れからラストオーダーまで — ハン川の灯りを見渡すテラス。',
   '@danangcrew', true, 1),

  ('danang-museums-heritage', 'danang',
   'Museums & heritage',
   'Bảo tàng & di sản',
   '博物館と遺産',
   'Three museums, a dragon that breathes fire, and the resort above the clouds.',
   'Ba bảo tàng, một con rồng phun lửa, và khu nghỉ dưỡng trên mây.',
   '三つの博物館、火を吹く龍、そして雲上のリゾート。',
   '@danangcrew', true, 2),

  ('danang-nights', 'danang',
   'Da Nang after dark',
   'Đêm Đà Nẵng',
   'ダナンの夜',
   'Beach club, speakeasy, live-music room — where the city goes once the bridge stops burning.',
   'Beach club, lounge kiểu cũ, quán nhạc sống — nơi thành phố kéo về sau khi cầu Rồng tắt lửa.',
   'ビーチクラブ、隠れ家ラウンジ、ライブハウス — 龍の火が消えた後の街へ。',
   '@danangcrew', true, 3)

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

-- Membership. The VALUES list is (collection slug, place slug, position); the
-- join drops any pair whose place is missing or belongs to another city rather
-- than failing the migration — a place pulled from the catalog later should
-- shrink the collection, not block a replay.
insert into public.collection_places (collection_id, place_id, sort_order)
select c.id, p.id, m.pos
from (values
  ('danang-rooftops',          'sky-21-bar-bistro',                         0),
  ('danang-rooftops',          'the-roof-da-nang',                          1),
  ('danang-rooftops',          'ciela-skybar-and-dining',                   2),
  ('danang-rooftops',          'da-nang-rooftop-craft-beer',                3),
  ('danang-rooftops',          'harbour-rooftop-eatery-bar',                4),

  -- The two far-out entries sit last on purpose: Museum of Local Products is
  -- in Hội An and Ba Na Hills up in Hòa Vang, both day-trip distance from the
  -- three city-centre stops above them.
  ('danang-museums-heritage',  'da-nang-museum',                            0),
  ('danang-museums-heritage',  'danang-fine-arts-museum',                   1),
  ('danang-museums-heritage',  'dragon-bridge',                             2),
  ('danang-museums-heritage',  'museum-of-local-products',                  3),
  ('danang-museums-heritage',  'ba-na-hills',                               4),

  ('danang-nights',            'ket-high',                                  0),
  ('danang-nights',            'the-1920-s-lounge',                         1),
  ('danang-nights',            'malibu-beach-club-seaside-chill-cocktails', 2),
  ('danang-nights',            'on-the-radio-bar',                          3),
  ('danang-nights',            'c-bar',                                     4)
) as m(collection_slug, place_slug, pos)
join public.collections c on c.slug = m.collection_slug
join public.places      p on p.slug = m.place_slug and p.city_id = 'danang'
on conflict (collection_id, place_id) do update set sort_order = excluded.sort_order;

-- Pin each cover to the lead member's cover photo. The app falls back to
-- exactly this photo when cover_photo_id is null, so setting it changes
-- nothing on screen today — but it stops the cover from silently jumping to a
-- different place the moment an editor reorders the list.
update public.collections c set cover_photo_id = (
  select ph.id
  from public.collection_places cp
  join public.places p        on p.id  = cp.place_id
  join public.place_photos ph on ph.place_id = p.id and not ph.is_hidden
  where cp.collection_id = c.id and cp.sort_order = 0
  order by ph.is_cover desc, ph.sort_order
  limit 1
)
where c.city_id = 'danang' and c.cover_photo_id is null;
