-- The week of 13–18 Sep, read back and corrected.
--
-- 105 places arrived that week, 95 of them from the phone. Two checks were
-- run over all of them: does `city_id` agree with the street address, and
-- does `name_en` read like a name rather than a Google Maps listing.
--
-- Eleven rows failed the first check, every one of them tagged `hcmc`. The
-- cause is the bug `20260918…`/`fix/city-follows-location` closed in the app:
-- the city followed the last one picked, not where the phone was, so a week
-- in Đà Lạt and a weekend in Đà Nẵng were both filed under Saigon. That fix
-- stops new rows from landing wrong; it cannot move the ones already there.
-- Ten of the eleven had a city to move to. The eleventh was a Starbucks in
-- Ortigas Center, Metro Manila — 1,614 km away, in no city this app has — so
-- it is deleted rather than reassigned. Checked before writing this: nothing
-- in `collection_places` or `trip_stops` pointed at it, so the cascade takes
-- only its six photos and two events with it.
--
-- Twenty-one rows failed the second check. `fetch-place` stores the Google
-- display name verbatim, and a display name is written for a map pin, not a
-- catalog: it carries opening hours ("- Open 24h"), branch codes ("CN Điện
-- Biên Phủ"), ® marks, taglines, and the Korean or Japanese half of a
-- bilingual shop sign. The rules those edits follow are written down in
-- `docs/place-naming.md`, next to this migration; the point of writing them
-- down is that the next import should not need a second pass like this one.
--
-- Two places are deliberately left alone. LEONA CAFE (Phước Hải) and 1991's
-- Coffee & Beer (Long Hải) sit 72–76 km from the centre, well past the city's
-- own `radius_km` of 25 — but since the 2025 merger Bà Rịa–Vũng Tàu is part
-- of Hồ Chí Minh City, so `hcmc` is the correct answer and the radius is the
-- thing that is too small. If the coast earns its own entry in `cities`
-- later, those rows move then.
--
-- Every statement keys on `slug`, so the file is idempotent and safe to
-- re-run. It has already been applied to production as
-- `20260919023743_place_import_audit_20260919`; this file is the repo's copy
-- of what ran. Two of the rows below were deleted from the Data Desk by hand
-- while it ran (`cafe-the-roof`, a third Đà Nẵng place, and `cloud9-the-cafe`)
-- — their statements matched nothing then and match nothing now.

-- 1. city_id, where the address disagreed with the tag.

update public.places set city_id = 'dalat'
 where slug in ('1-2-circle-coffee',
                'cai-coc-me',
                'fong',
                'gat-tan-doi',
                'kong-cafe-dalat',
                'new-light-coffee-da-lat',
                'the-roof-by-banla-dalat');

update public.places set city_id = 'danang'
 where slug in ('blackout-rooftop-bar',
                'cafe-the-roof',
                'maia-beach-bar');

-- 2. Outside every city this app has.

delete from public.places where slug = 'starbucks-pearl-plaza';

-- 3. Names. `name_vi` follows `name_en` at the end of the section, because
--    for all of these rows the two columns held the same Google string.

-- 3a. name_en keeps to Latin script; the shop's own script goes to its column.

update public.places set name_en = 'Kakinoki'                   where slug = 'kakinoki-2';
update public.places set name_en = 'Pacho Pocha Express'        where slug = 'pacho-pocha-express';
update public.places set name_en = 'Meili — Mì Bò Đài Loan'     where slug = 'meili-mi-bo-dai-loan-binh-thanh';
update public.places set name_en = 'To — Hidden Cocktails Bar',
                         name_ja = 'ト — 隠れ家バー'
 where slug = 'to-hidden-cocktails-bar';

-- 3b. Trademark marks, opening hours, branch codes.

update public.places set name_en = 'Chidori Crepe — Võ Trường Toản'          where slug = 'chidori-crepe-vo-truong-toan';
update public.places set name_en = 'XOCOATI — Artisan Cocoa Drinks'          where slug = 'xocoati-artisan-cocoa-drinks';
update public.places set name_en = 'Cà Zone — Nguyễn Gia Trí'                where slug = 'ca-zone-nguyen-gia-tri-open-24h';
update public.places set name_en = 'Tarobu Dessert — Điện Biên Phủ'          where slug = 'tarobu-dessert-che-da-bao-khoai-deo-cn-dien-bien';
update public.places set name_en = '1000M Tea & Coffee — Nguyễn Đình Chiểu'  where slug = '1000m-tea-coffee-130a-nguyen-dinh-chieu';

-- 3c. Taglines and the category word.

update public.places set name_en = 'Chilli Thai — Vincom Center Đồng Khởi' where slug = 'chilli-thai-vincom-center-dong-khoi-thai-restaur';
update public.places set name_en = 'Rêverie'                              where slug = 'reverie-make-dreams-taste-real';

-- 3d. Casing. An all-caps name that reads as brand styling is left alone —
--     LEONA CAFE, MRSIMPLE CAFÉ, TRỐN để dừng chân, ẤP cafe all stay.

update public.places set name_en = 'Donau The Cafe'          where slug = 'donau-the-cafe';
update public.places set name_en = 'Nhà Tạo Cafe'            where slug = 'nha-tao-cafe';
update public.places set name_en = 'Tán Hiên Đà Lạt'         where slug = 'tan-hien-da-lat';
update public.places set name_en = 'Ngâm Cafe'               where slug = 'ngam-cafe';
update public.places set name_en = 'Coco Paris'              where slug = 'coco-paris';
update public.places set name_en = 'Kong Cafe Đà Lạt'        where slug = 'kong-cafe-dalat';
update public.places set name_en = 'Jalsa Indian Restaurant' where slug = 'jalsa-indian-restaurant';
update public.places set name_en = 'Ranchu Cafe & Bakery'    where slug = 'ranchu-cafe-and-bakery';

-- 3e. Two different cafés 2 km apart, both called Nhâm Coffee, indis-
--     tinguishable in a list. The "Linh" cluster is left alone: Cafe Linh,
--     Café Linh, Cà phê Linh and Linh Coffee are four venues whose own signs
--     already differ.

update public.places set name_en = 'Nhâm Coffee — Thạnh Mỹ Tây' where slug = 'nham-coffee';
update public.places set name_en = 'Nhâm Coffee — Gia Định'     where slug = 'nham-coffee-hcmc';

update public.places set name_vi = name_en
 where slug in ('kakinoki-2',
                'pacho-pocha-express',
                'to-hidden-cocktails-bar',
                'meili-mi-bo-dai-loan-binh-thanh',
                'chidori-crepe-vo-truong-toan',
                'xocoati-artisan-cocoa-drinks',
                'ca-zone-nguyen-gia-tri-open-24h',
                'tarobu-dessert-che-da-bao-khoai-deo-cn-dien-bien',
                '1000m-tea-coffee-130a-nguyen-dinh-chieu',
                'chilli-thai-vincom-center-dong-khoi-thai-restaur',
                'reverie-make-dreams-taste-real',
                'donau-the-cafe',
                'nha-tao-cafe',
                'tan-hien-da-lat',
                'ngam-cafe',
                'coco-paris',
                'kong-cafe-dalat',
                'jalsa-indian-restaurant',
                'ranchu-cafe-and-bakery',
                'nham-coffee',
                'nham-coffee-hcmc');
