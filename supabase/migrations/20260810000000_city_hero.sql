-- Per-city hero becomes data the desk can edit.
--
-- The Explore screen's cover — headline, CTA label, and which place's
-- photo sits behind them — lived hardcoded in the app (CITY_HERO in
-- ExploreScreen.tsx), so changing "Mornings by the sea, nights on the
-- Hàn" meant an app release. These columns move that into cities, where
-- the existing "editors manage cities" policy already lets the dashboard
-- write.
--
-- All nullable on purpose: a null title falls back to the app's generic
-- "Ideas for a night in <city>" framing, a null CTA to "Start exploring",
-- and a null place slug to the automatic featured-place photo pick — so
-- a new city needs no hero row-keeping to look right.
--
-- hero_place_slug is a plain text pointer, not a foreign key: the app
-- already treats a slug that matches nothing as "use the automatic pick",
-- and a hard FK would make deleting a pinned place fail for no user-visible
-- benefit.
alter table public.cities
  add column if not exists hero_title_en text,
  add column if not exists hero_title_vi text,
  add column if not exists hero_title_ja text,
  add column if not exists hero_cta_en text,
  add column if not exists hero_cta_vi text,
  add column if not exists hero_cta_ja text,
  add column if not exists hero_place_slug text;

-- Seed with what the app shipped hardcoded, so nothing changes on screen
-- the moment the app starts reading from here. CTA stays null everywhere:
-- no city has ever overridden "Start exploring".
update public.cities set
  hero_title_en = 'Ideas for a night in Saigon',
  hero_title_vi = 'Gợi ý cho một đêm ở Sài Gòn',
  hero_title_ja = 'サイゴン、夜のアイデア',
  hero_place_slug = 'saigon-night-cruise'
where id = 'hcmc' and hero_title_en is null;

update public.cities set
  hero_title_en = 'Autumn ideas in Hanoi',
  hero_title_vi = 'Gợi ý mùa thu ở Hà Nội',
  hero_title_ja = 'ハノイ、秋のアイデア',
  hero_place_slug = 'imperial-citadel-of-thang-long'
where id = 'hanoi' and hero_title_en is null;

update public.cities set
  hero_title_en = 'Mornings by the sea, nights on the Hàn',
  hero_title_vi = 'Sáng ở biển, tối bên sông Hàn',
  hero_title_ja = '朝は海へ、夜はハン川へ'
where id = 'danang' and hero_title_en is null;
