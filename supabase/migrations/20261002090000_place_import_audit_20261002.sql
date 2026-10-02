-- The fortnight of 19 Sep – 1 Oct, read back and corrected.
--
-- 178 places arrived in that window, 69 of them in Melbourne. The four
-- checks `fetch-place` makes mechanically (marks, scripts, a lower-case
-- opening, operational suffixes) all came back clean; this file is the
-- desk's half, from `docs/place-naming.md`.
--
-- Thirty-five names still carried Google's hyphen, which means nobody
-- had looked at the suffix. Of those: nine are real branches, and keep
-- their suffix behind the catalog's dash (Lertermer ×3, Market Lane ×3,
-- Basta Hiro ×2 — and Thái Fiên, whose Saigon sibling was already in the
-- catalog); eight carry a ward or street suffix with no second branch to
-- tell apart; ten carry a type word or a tagline; two carry a house
-- number or a branch code ("Cở Sở 3"); two are bilingual names stapled
-- into one column, which the two columns exist for. Five are left
-- exactly as they are, because the half after the hyphen may be half the
-- shop's name and only the owner can say: Phát Ký - Mỳ gia Sài Gòn, Gòn
-- - Bites & Veggies, Tròn - Tondo, Tiệm nướng N&B - Pezzi coffee & Grill,
-- Royal Botanic Gardens Victoria - Melbourne Gardens.
--
-- Eleven names were in capitals throughout. Four read as the way they
-- were typed into Google rather than as a wordmark and are set in title
-- case; GOGYO, CHUA, REGULARS, KOMBU and ROJI21 keep theirs, since each
-- is how the shop writes itself, and STOP FOR COFFEE and NANAYA IZAKAYA
-- are handled with their suffixes in section 2.
--
-- Eight addresses came back from Google without their marks — "Ha Noi",
-- "Hue", "Da Lat" — where every other row in the catalog has them. One
-- (Say Say) also carried the owner's directions to the door. Re-accented
-- and trimmed; nothing is re-geocoded, so a Google answer that looks odd
-- (a tomb filed under Kim Long) stays as odd as it was.
--
-- Every statement keys on `slug`, so the file is idempotent. `name_vi`
-- follows `name_en` except where a shop has a Vietnamese name of its own.

-- 1. Branches, behind the catalog's dash.

update public.places set name_en = 'Lertermer Coffee — Hàm Nghi',        name_vi = 'Lertermer Coffee — Hàm Nghi'        where slug = 'lertermer-coffee-ham-nghi';
update public.places set name_en = 'Lertermer Coffee — Hoàng Đạo Thuý',  name_vi = 'Lertermer Coffee — Hoàng Đạo Thuý'  where slug = 'lertermer-coffee-hoang-dao-thuy';
update public.places set name_en = 'Lertermer Coffee — Thành Công',      name_vi = 'Lertermer Coffee — Thành Công'      where slug = 'lertermer-coffee-thanh-cong';
update public.places set name_en = 'Market Lane Coffee — Mitchell House', name_vi = 'Market Lane Coffee — Mitchell House' where slug = 'market-lane-coffee-mitchell-house';
-- Two at the one market: the area first, the street to tell them apart.
update public.places set name_en = 'Market Lane Coffee — Queen Victoria Market, Queen St',    name_vi = 'Market Lane Coffee — Queen Victoria Market, Queen St'    where slug = 'market-lane-coffee-queen-st-queen-victoria-marke';
update public.places set name_en = 'Market Lane Coffee — Queen Victoria Market, Victoria St', name_vi = 'Market Lane Coffee — Queen Victoria Market, Victoria St' where slug = 'market-lane-coffee-victoria-st-queen-victoria-ma';
update public.places set name_en = 'Basta Hiro — Vincom Center Đồng Khởi', name_vi = 'Basta Hiro — Vincom Center Đồng Khởi' where slug = 'basta-hiro-vincom-center-dong-khoi';
-- The mall's own name is enough; "Hà Nội" repeats the city column.
update public.places set name_en = 'Basta Hiro — Vincom Center Metropolis', name_vi = 'Basta Hiro — Vincom Center Metropolis' where slug = 'basta-hiro-vincom-center-metropolis-ha-noi';
update public.places set name_en = 'Thái Fiên by 15.22 Café — Đà Lạt',   name_vi = 'Thái Fiên by 15.22 Café — Đà Lạt'   where slug = 'thai-fien-by-15-22-cafe-da-lat';

-- 2. A suffix with no second branch to tell apart.

update public.places set name_en = 'Parin Bakery',       name_vi = 'Parin Bakery'       where slug = 'parin-bakery-bui-thi-xuan';
update public.places set name_en = 'Ngõ Thái',           name_vi = 'Ngõ Thái'           where slug = 'ngo-thai-binh-thanh';
update public.places set name_en = 'Today, With You',    name_vi = 'Today, With You'    where slug = 'today-with-you-ben-thanh';
update public.places set name_en = 'Cà phê Dịu Dàng',    name_vi = 'Cà phê Dịu Dàng'    where slug = 'ca-phe-diu-dang-da-lat';
update public.places set name_en = 'Com Tam Moc',        name_vi = 'Com Tam Moc'        where slug = 'com-tam-moc-vincom-center';
update public.places set name_en = 'Vintage Sole',       name_vi = 'Vintage Sole'       where slug = 'vintage-sole-brunswick-st-fitzroy';
update public.places set name_en = 'Nanaya Izakaya',     name_vi = 'Nanaya Izakaya'     where slug = 'nanaya-izakaya-thao-dien';
update public.places set name_en = 'Stop For Coffee',    name_vi = 'Stop For Coffee'    where slug = 'stop-for-coffee-ga-kim-nguu';

-- 3. Type words and taglines; the app prints the category beside the name.

update public.places set name_en = 'ROJI21',             name_vi = 'ROJI21'             where slug = 'roji21-modern-asian-izakaya';
update public.places set name_en = 'Foco',               name_vi = 'Foco'               where slug = 'foco-kitchen-bar';
update public.places set name_en = 'Eureka 89',          name_vi = 'Eureka 89'          where slug = 'eureka-89-dining-events';
update public.places set name_en = 'The Time Hub',       name_vi = 'The Time Hub'       where slug = 'the-time-hub-study-hub-co-working-space';
update public.places set name_en = 'Between Us',         name_vi = 'Between Us'         where slug = 'between-us-hidden-crafted-matcha-drinks';
update public.places set name_en = 'Cozy by Xéooo',      name_vi = 'Cozy by Xéooo'      where slug = 'cozy-by-xeooo-pizza-drink-more';
update public.places set name_en = 'Mót Hội An',         name_vi = 'Mót Hội An'         where slug = 'mot-hoi-an-nuoc-thao-moc-sa-chanh';
update public.places set name_en = 'Outta da Blue',      name_vi = 'Outta da Blue'      where slug = 'outta-da-blue-da-nang-danang-specialty-coffee-sh';
update public.places set name_en = 'Hiên Ngọt',          name_vi = 'Hiên Ngọt'          where slug = 'hien-ngot-che-trieu-chau-chaozhou-dessert';
update public.places set name_en = 'Thuận Ký',           name_vi = 'Thuận Ký'           where slug = 'thuan-ky-com-phu-trung-q3';

-- 4. A house number, a branch code.

update public.places set name_en = 'Thi Tuấn Coffee',    name_vi = 'Thi Tuấn Coffee'    where slug = 'thi-tuan-coffee-3-yagout-da-lat';
update public.places set name_en = 'Chu An Coffee',      name_vi = 'Chu An Coffee'      where slug = 'chu-an-coffee-co-so-3';

-- 5. Two names in one column, where there are two columns.

update public.places set name_en = 'Uncle Noodles',      name_vi = 'Chú Mì'             where slug = 'uncle-noodles-chu-mi';
update public.places set name_en = 'Hẻm Kitchen',        name_vi = 'Bếp Hẻm'            where slug = 'hem-kitchen-bep-hem-thai-food';

-- 6. Capitals that were typing, not a wordmark.

update public.places set name_en = 'Apina Cafe',         name_vi = 'Apina Cafe'         where slug = 'apina-cafe';
update public.places set name_en = 'Bar Curio',          name_vi = 'Bar Curio'          where slug = 'bar-curio';
update public.places set name_en = 'Cà Fê Bernard',      name_vi = 'Cà Fê Bernard'      where slug = 'ca-fe-bernard';
update public.places set name_en = 'Hẻm Fast Food 2',    name_vi = 'Hẻm Fast Food 2'    where slug = 'hem-fast-food-2';

-- 7. Addresses that came back without their marks.

update public.places set address = 'West Lake, Tây Hồ, Hà Nội, Vietnam'                              where slug = 'west-lake';
update public.places set address = 'Hoàn Kiếm Lake, Hoàn Kiếm, Hà Nội, Vietnam'                       where slug = 'hoan-kiem-lake';
update public.places set address = '41 Ngách 152, Ngõ Xã Đàn 2, Đống Đa, Hà Nội 10000, Vietnam'       where slug = 'say-say-wine-cafe';
update public.places set address = 'Kim Long, Huế 532761, Vietnam'                                    where slug = 'thien-mu-pagoda';
update public.places set address = 'Thuận Hoà, Huế, Vietnam'                                          where slug = 'mausoleum-of-emperor-thieu-tri';
update public.places set address = 'Tổ dân phố Thượng Ba, Quảng Điền, Huế 530000, Vietnam'            where slug = 'mausoleum-of-emperor-tu-duc';
update public.places set address = 'Kim Long, Huế, Vietnam'                                           where slug = 'mausoleum-of-emperor-gia-long';
update public.places set address = 'Lâm Viên - Đà Lạt, Lâm Đồng, Vietnam'                             where slug = 'tiem-ca-phe-nguoi-thuong-oi';
