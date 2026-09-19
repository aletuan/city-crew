-- Two repairs, both from the 19/9 scan of all 643 places.
--
-- Applied to production as `place_city_and_branch_names_20260919`; this is
-- the repo's copy of it. Every statement keys on `slug`, so re-running
-- changes nothing.
--
-- 1. Nine places filed under the city the contributor happened to be
--    looking at. They were imported between 11:02 and 11:49 on 19/9,
--    before #561 taught `import-place.ts` to read Google's coordinates
--    instead of the caller's `city`. The function carrying that fix only
--    went live at 20:40 the same day — the merge was not the deploy —
--    so this is the last batch the old behaviour can have produced.
--
-- 2. Five names, against docs/place-naming.md. Two pairs break rule 4
--    (same name, same city, different shops) and one keeps a type
--    descriptor after a separator, which rule 5 asks to drop.

-- ── 1. the city the coordinates say ──

update public.places set city_id = 'dalat'
where slug in (
  'dalat-flower-plateau-ecotourism-area',
  'chip-s-corner',
  'tiem-ca-phe-nguoi-thuong-oi',
  'memory-station',
  'mien-du-muc',
  'suoi-binh-yen',
  'thi-tran-iyashi'
) and city_id <> 'dalat';

-- Hội An, 24 km from the centre of Đà Nẵng and inside MAX_CITY_KM.
update public.places set city_id = 'danang'
where slug in (
  'mot-hoi-an-nuoc-thao-moc-sa-chanh',
  'chu-an-coffee-co-so-3'
) and city_id <> 'danang';

-- ── 2. branch suffixes, rule 4 ──
--
-- Both `indigo coffee` shops sit in Hải Châu, so the ward cannot tell
-- them apart and the street does instead. Lower case is kept on purpose:
-- it is how the shop writes its own sign.

update public.places
set name_en = 'indigo coffee — Bạch Đằng', name_vi = 'indigo coffee — Bạch Đằng'
where slug = 'indigo-coffee-3';                    -- 30 Bạch Đằng

update public.places
set name_en = 'indigo coffee — Trần Phú', name_vi = 'indigo coffee — Trần Phú'
where slug = 'indigo-coffee-danang';               -- 177 Trần Phú

-- The Ecopark branch is in Hưng Yên, 13 km out; the district would read
-- as the wrong province, so the development names it.
update public.places
set name_en = 'InBook International Bookstore — Ecopark',
    name_vi = 'InBook International Bookstore — Ecopark'
where slug = 'inbook-ecopark-english-bookstore';

update public.places
set name_en = 'InBook International Bookstore — Ba Đình',
    name_vi = 'InBook International Bookstore — Ba Đình'
where slug = 'inbook-english-and-french-international-bookstor';

-- ── 3. the one real type descriptor, rule 5 ──
-- "Modern Japanese Restaurant" after a dash is Google's blurb, not the
-- sign; the app already shows the category beside the name.

update public.places set name_en = 'Roru', name_vi = 'Roru'
where slug = 'roru-modern-japanese-restaurant';
