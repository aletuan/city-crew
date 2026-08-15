-- The line under the headline becomes the desk's too.
--
-- `20260810000000_city_hero.sql` moved the headline, the CTA and the
-- cover photo out of the app and into `cities`. It left the subtitle
-- behind, and the subtitle is the only one of the four that still said
-- the same sentence in every city: "Browse public collections and places
-- — no account needed."
--
-- That sentence is not wrong, and it is not about the city. Under
-- "Gợi ý mùa thu ở Hà Nội" it answers a question about accounts that the
-- headline did not ask, and it reads the same in Saigon in August as it
-- does in Da Nang in November. A headline that names a season deserves a
-- second line that knows where it is.
--
-- Nullable like the rest, and for the same reason: cleared, the app falls
-- back to that generic sentence, so a city added tomorrow needs no hero
-- keeping to look right. The fallback is worth keeping precisely because
-- it is the guest-facing one — a person who has not signed in is the
-- reader with the most to learn from it.
alter table public.cities
  add column if not exists hero_sub_en text,
  add column if not exists hero_sub_vi text,
  add column if not exists hero_sub_ja text;

-- ─────────────────────────────────────────────────────── the three we have
--
-- Each one is written against its own headline rather than in general,
-- which is the whole point of the column existing:
--
--   Hanoi   "Autumn ideas in Hanoi"                  → where autumn is spent
--   Saigon  "Ideas for a night in Saigon"            → what the night holds
--   Da Nang "Mornings by the sea, nights on the Hàn" → both ends of that day
--
-- Guarded on null so a desk edit is never overwritten by a re-run.

update public.cities set
  hero_sub_en = 'The Old Quarter, West Lake, and cafés worth a whole afternoon.',
  hero_sub_vi = 'Phố cổ, hồ Tây, và những quán cà phê đáng ngồi cả buổi chiều.',
  hero_sub_ja = '旧市街、西湖、午後をまるごと過ごせるカフェ。'
where id = 'hanoi' and hero_sub_en is null;

update public.cities set
  hero_sub_en = 'Late-night eats, rooftops, and alleys that stay lit.',
  hero_sub_vi = 'Quán ăn khuya, rooftop, và những con hẻm sáng đèn.',
  hero_sub_ja = '深夜の食堂、ルーフトップ、灯りの絶えない路地。'
where id = 'hcmc' and hero_sub_en is null;

update public.cities set
  hero_sub_en = 'My Khe at sunrise, the Dragon Bridge after dark.',
  hero_sub_vi = 'Mỹ Khê lúc bình minh, cầu Rồng khi lên đèn.',
  hero_sub_ja = '夜明けのミーケー、灯りをともすドラゴン橋。'
where id = 'danang' and hero_sub_en is null;
