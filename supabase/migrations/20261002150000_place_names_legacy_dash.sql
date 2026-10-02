-- Every name imported before 19 Sep 2026 that still carried Google's
-- hyphen, read back against docs/place-naming.md. 233 rows.
--
-- The dash became a rule the importer keeps on 2 Oct
-- (20261002090000_place_import_audit_20261002.sql, and place-name.ts),
-- which left the back catalog as the one place the hyphen survived: 233
-- names, against 29 with the dash. The owner asked for all of them in one
-- pass, grouped by what the suffix is — the groups below, in the order a
-- reviewer needs them least to most. 131 are branches with a sibling in
-- the catalog and change only their separator; 2 are branches whose
-- suffix was a district code ("Quận 10"), which rule 4 replaces with the
-- ward; 47 carry a type word or a tagline ("Speakeasy Cocktail Bar",
-- "Home for Steaks & Wines"), which the category beside the name already
-- says; 46 are single branches with a ward or a building after the dash,
-- which has nothing to tell apart; 7 may carry half the name after the
-- dash ("BepBo - Quán Bò Xèo") and keep both halves behind the dash.
--
-- name_vi follows name_en where it was the same string; where the desk
-- had written a Vietnamese name of its own, the same cut is applied to
-- it. Keyed on slug; idempotent. Slugs do not change.


-- 1. Branches with a second branch in the catalog: the catalog's dash, suffix kept. (131)

update public.places set name_en = '3C Roastery — Nguyễn Văn Lộc', name_vi = '3C Roastery — Nguyễn Văn Lộc' where slug = '3c-roastery-nguyen-van-loc';
update public.places set name_en = '3C Roastery — Phan Kế Bính', name_vi = '3C Roastery — Phan Kế Bính' where slug = '3c-roastery-92-phan-ke-binh';
update public.places set name_en = '80plus Coffee Roastery — Nguyễn Đình Chiểu', name_vi = '80plus Coffee Roastery — Nguyễn Đình Chiểu' where slug = '80plus-coffee-roastery-nguyen-dinh-chieu';
update public.places set name_en = '80plus Coffee Roastery — Nguyễn Thái Học', name_vi = '80plus Coffee Roastery — Nguyễn Thái Học' where slug = '80plus-coffee-roastery-nguyen-thai-hoc';
update public.places set name_en = 'Artemis Pastry — Ngô Quyền', name_vi = 'Artemis Pastry — Ngô Quyền' where slug = 'artemis-pastry';
update public.places set name_en = 'Artemis Pastry — Ngụy Như Kon Tum', name_vi = 'Artemis Pastry — Ngụy Như Kon Tum' where slug = 'artemis-pastry-hanoi';
update public.places set name_en = 'Blackbird Coffee — Chân Cầm', name_vi = 'Blackbird Coffee — Chân Cầm' where slug = 'blackbird-coffee';
update public.places set name_en = 'Blackbird Coffee — Đặng Dung', name_vi = 'Blackbird Coffee — Đặng Dung' where slug = 'blackbird-coffee-hanoi';
update public.places set name_en = 'Bold Brew — Huỳnh Thúc Kháng', name_vi = 'Bold Brew — Huỳnh Thúc Kháng' where slug = 'bold-brew-cafe-work-date-huynh-thuc-khang';
update public.places set name_en = 'Bold Brew — Trần Phú', name_vi = 'Bold Brew — Trần Phú' where slug = 'bold-brew-cafe-work-date-42-tran-phu';
update public.places set name_en = 'Bosgaurus Coffee Roasters — Saigon Pearl', name_vi = 'Bosgaurus Coffee Roasters — Saigon Pearl' where slug = 'bosgaurus-coffee-roasters-saigon-pearl';
update public.places set name_en = 'Bosgaurus Coffee Roasters — The Nexus', name_vi = 'Bosgaurus Coffee Roasters — The Nexus' where slug = 'bosgaurus-coffee-roasters-the-nexus';
update public.places set name_en = 'Bosgaurus Coffee Roasters — The Opera House', name_vi = 'Bosgaurus Coffee Roasters — The Opera House' where slug = 'bosgaurus-coffee-roasters-the-opera-house';
update public.places set name_en = 'Cẩm Thị — Hồ Hảo Hớn', name_vi = 'Cẩm Thị — Hồ Hảo Hớn' where slug = 'cam-thi';
update public.places set name_en = 'Cẩm Thị — Thảo Điền', name_vi = 'Cẩm Thị — Thảo Điền' where slug = 'cam-thi-thao-dien';
update public.places set name_en = 'CGV — Bà Triệu', name_vi = 'CGV — Bà Triệu' where slug = 'cgv-ba-trieu';
update public.places set name_en = 'CGV — Metropolis', name_vi = 'CGV — Metropolis' where slug = 'cgv-metropolis';
update public.places set name_en = 'Comfy Coffee & Bakes — Thủ Đức', name_vi = 'Comfy Coffee & Bakes — Thủ Đức' where slug = 'comfy-coffee-bakes-thu-duc';
update public.places set name_en = 'Comfy Coffee & Bakes — Tú Xương', name_vi = 'Comfy Coffee & Bakes — Tú Xương' where slug = 'comfy-coffee-bakes-tu-xuong';
update public.places set name_en = 'CTQ Texas BBQ — Mỹ Đình', name_vi = 'CTQ Texas BBQ — Mỹ Đình' where slug = 'ctq-texas-bbq';
update public.places set name_en = 'CTQ Texas BBQ — Yên Hoà', name_vi = 'CTQ Texas BBQ — Yên Hoà' where slug = 'ctq-texas-bbq-thit-chin-cham-co-so-yen-hoa';
update public.places set name_en = 'Đệ Nhất Mì Kéo — Thủ Đức', name_vi = 'Đệ Nhất Mì Kéo — Thủ Đức' where slug = 'de-nhat-mi-keo-thu-duc-chi-nhanh-6';
update public.places set name_en = 'Deep Sii — Lê Thánh Tông', name_vi = 'Deep Sii — Lê Thánh Tông' where slug = 'deep-sii-le-thanh-tong';
update public.places set name_en = 'Deep Sii — Vạn Bảo', name_vi = 'Deep Sii — Vạn Bảo' where slug = 'deep-sii-van-bao';
update public.places set name_en = 'Every Half Coffee Roasters — Bưu Điện Hà Nội', name_vi = 'Every Half Coffee Roasters — Bưu Điện Hà Nội' where slug = 'every-half-coffee-roasters-buu-dien-ha-noi';
update public.places set name_en = 'Every Half Coffee Roasters — Centec', name_vi = 'Every Half Coffee Roasters — Centec' where slug = 'every-half-coffee-roasters-centec';
update public.places set name_en = 'Every Half Coffee Roasters — Châu Long', name_vi = 'Every Half Coffee Roasters — Châu Long' where slug = 'every-half-coffee-roasters-chau-long';
update public.places set name_en = 'Every Half Coffee Roasters — Đồng Khởi', name_vi = 'Every Half Coffee Roasters — Đồng Khởi' where slug = 'every-half-coffee-roasters-dong-khoi';
update public.places set name_en = 'Every Half Coffee Roasters — mPlaza', name_vi = 'Every Half Coffee Roasters — mPlaza' where slug = 'every-half-coffee-roasters-mplaza';
update public.places set name_en = 'Every Half Coffee Roasters — Ngọc Hà', name_vi = 'Every Half Coffee Roasters — Ngọc Hà' where slug = 'every-half-coffee-roasters-ngoc-ha';
update public.places set name_en = 'Every Half Coffee Roasters — Nguyễn Văn Thủ', name_vi = 'Every Half Coffee Roasters — Nguyễn Văn Thủ' where slug = 'every-half-coffee-roasters-nguyen-van-thu';
update public.places set name_en = 'Every Half Coffee Roasters — Phố Chả Cá', name_vi = 'Every Half Coffee Roasters — Phố Chả Cá' where slug = 'every-half-coffee-roasters-pho-cha-ca';
update public.places set name_en = 'Every Half Coffee Roasters — Silk Village Hội An', name_vi = 'Every Half Coffee Roasters — Silk Village Hội An' where slug = 'every-half-coffee-roasters-silk-village-hoi-an';
update public.places set name_en = 'Every Half Coffee Roasters — Thảo Điền', name_vi = 'Every Half Coffee Roasters — Thảo Điền' where slug = 'every-half-roastery-thao-dien';
update public.places set name_en = 'Every Half Coffee Roasters — Tôn Đức Thắng', name_vi = 'Every Half Coffee Roasters — Tôn Đức Thắng' where slug = 'every-half-coffee-roasters-ton-duc-thang';
update public.places set name_en = 'Every Half Coffee Roasters — Tú Xương', name_vi = 'Every Half Coffee Roasters — Tú Xương' where slug = 'every-half-coffee-roasters-tu-xuong';
update public.places set name_en = 'Every Half Coffee Roasters — Võ Thị Sáu', name_vi = 'Every Half Coffee Roasters — Võ Thị Sáu' where slug = 'every-half';
update public.places set name_en = 'Everything Coffee ''N Bagel — Đào Tấn', name_vi = 'Everything Coffee ''N Bagel — Đào Tấn' where slug = 'everything-coffee-n-bagel-dao-tan-hanoi';
update public.places set name_en = 'Everything Coffee ''N Bagel — Starlake Tây Hồ Tây', name_vi = 'Everything Coffee ''N Bagel — Starlake Tây Hồ Tây' where slug = 'everything-coffee-n-bagel-starlake';
update public.places set name_en = 'Hadu Sushi — Bùi Thị Xuân', name_vi = 'Hadu Sushi — Bùi Thị Xuân' where slug = 'hadu-sushi';
update public.places set name_en = 'Hadu Sushi — Trung Hòa', name_vi = 'Hadu Sushi — Trung Hòa' where slug = 'hadu-sushi-3';
update public.places set name_en = 'Hadu Sushi — Xã Đàn', name_vi = 'Hadu Sushi — Xã Đàn' where slug = 'hadu-sushi-hanoi';
update public.places set name_en = 'Hanoi Neighbors — Big Hug', name_vi = 'Hanoi Neighbors — Big Hug' where slug = 'hanoi-neighbors-big-hug';
update public.places set name_en = 'Hanoi Neighbors — Tuệ Tĩnh', name_vi = 'Hanoi Neighbors — Tuệ Tĩnh' where slug = 'hanoi-neighbors';
update public.places set name_en = 'Harper Seven — Huỳnh Thúc Kháng', name_vi = 'Harper Seven — Huỳnh Thúc Kháng' where slug = 'harper-seven-coffee-and-bakery-27-huynh-thuc-kha';
update public.places set name_en = 'Harper Seven — Tô Hiệu', name_vi = 'Harper Seven — Tô Hiệu' where slug = 'harper-seven-coffee-bakery';
update public.places set name_en = 'HI4 Coffee & Workspace — Mai Thúc Lân', name_vi = 'HI4 Coffee & Workspace — Mai Thúc Lân' where slug = 'hi4-coffee-workspace';
update public.places set name_en = 'HI4 Coffee & Workspace — Nguyễn Văn Trỗi', name_vi = 'HI4 Coffee & Workspace — Nguyễn Văn Trỗi' where slug = 'hi4-coffee-workspace-02-nguyen-van-troi';
update public.places set name_en = 'Jinro BBQ — Hoàn Kiếm', name_vi = 'Jinro BBQ — Hoàn Kiếm' where slug = 'jinro-bbq-hoan-kiem-ha-noi';
update public.places set name_en = 'Jinro BBQ — Nguyễn Chí Thanh', name_vi = 'Jinro BBQ — Nguyễn Chí Thanh' where slug = 'jinro-bbq-restaurant';
update public.places set name_en = 'Lighthouse — Đình Nghệ', name_vi = 'Lighthouse — Đình Nghệ' where slug = 'lighthouse';
update public.places set name_en = 'Lighthouse — Whale Park', name_vi = 'Lighthouse — Whale Park' where slug = 'lighthouse-whale-park';
update public.places set name_en = 'Magicha.zenbar — Hội An', name_vi = 'Magicha.zenbar — Hội An' where slug = 'magicha-zenbar-hoi-an-matcha-tea-room';
update public.places set name_en = 'Magicha.zenbar — Khuê Mỹ Đông', name_vi = 'Magicha.zenbar — Khuê Mỹ Đông' where slug = 'magicha-zenbar-khue-my-dong-matcha-tea-room';
update public.places set name_en = 'Magicha.zenbar — Lê Hồng Phong', name_vi = 'Magicha.zenbar — Lê Hồng Phong' where slug = 'magicha-zenbar-matcha';
update public.places set name_en = 'Maison Marou — Cầu Gỗ', name_vi = 'Maison Marou — Cầu Gỗ' where slug = 'maison-marou-cau-go';
update public.places set name_en = 'Maison Marou — Nguyễn Thái Học', name_vi = 'Maison Marou — Nguyễn Thái Học' where slug = 'maison-marou-cafe-ha-noi-centre';
update public.places set name_en = 'Maison Marou — Nhà Thờ', name_vi = 'Maison Marou — Nhà Thờ' where slug = 'maison-marou-cafe-nha-tho';
update public.places set name_en = 'Maison Marou — Thợ Nhuộm', name_vi = 'Maison Marou — Thợ Nhuộm' where slug = 'maison-marou-flagship-hanoi';
update public.places set name_en = 'Make Room — Calmette', name_vi = 'Make Room — Calmette' where slug = 'make-room';
update public.places set name_en = 'Make Room — Nguyễn Bỉnh Khiêm', name_vi = 'Make Room — Nguyễn Bỉnh Khiêm' where slug = 'make-room-cafe-nguyen-binh-khiem';
update public.places set name_en = 'Make Room — Tôn Thất Đạm', name_vi = 'Make Room — Tôn Thất Đạm' where slug = 'make-room-ton-that-dam';
update public.places set name_en = 'Miyama — The Garden', name_vi = 'Miyama — The Garden' where slug = 'miyama-the-garden';
update public.places set name_en = 'Miyama — The View', name_vi = 'Miyama — The View' where slug = 'miyama-the-view';
update public.places set name_en = 'MONO Coffee Lab — Hồ Xuân Hương', name_vi = 'MONO Coffee Lab — Hồ Xuân Hương' where slug = 'mono-coffee-lab-ho-xuan-huong';
update public.places set name_en = 'MONO Coffee Lab — Pasteur', name_vi = 'MONO Coffee Lab — Pasteur' where slug = 'mono-coffee-lab-pasteur';
update public.places set name_en = 'MONO Coffee Lab — Vân Hồ', name_vi = 'MONO Coffee Lab — Vân Hồ' where slug = 'mono-coffee-lab-van-ho';
update public.places set name_en = 'Mr.Saigon Kitchen & Drinks — Bình Thạnh', name_vi = 'Mr.Saigon Kitchen & Drinks — Bình Thạnh' where slug = 'mr-saigon-kitchen-drinks-binh-thanh';
update public.places set name_en = 'Mr.Saigon Kitchen & Drinks — Tân Bình', name_vi = 'Mr.Saigon Kitchen & Drinks — Tân Bình' where slug = 'mr-saigon-kitchen-drinks-mi-y-salad-sai-gon-tan-';
update public.places set name_en = 'Nama Sushi — Nguyễn Văn Lộc', name_vi = 'Nama Sushi — Nguyễn Văn Lộc' where slug = 'nama-sushi-nguyen-van-loc';
update public.places set name_en = 'Nama Sushi — Vũ Phạm Hàm', name_vi = 'Nama Sushi — Vũ Phạm Hàm' where slug = 'nama-sushi-hanoi';
update public.places set name_en = 'Nerd.society — Hồ Tùng Mậu', name_vi = 'Nerd.society — Hồ Tùng Mậu' where slug = 'nerd-society-ho-tung-mau-study-work-coffee';
update public.places set name_en = 'Nerd.society — Tây Sơn', name_vi = 'Nerd.society — Tây Sơn' where slug = 'nerd-society-tay-son-study-work-coffee';
update public.places set name_en = 'Nerdbox — Ao Sen', name_vi = 'Nerdbox — Ao Sen' where slug = 'nerdbox-workspace';
update public.places set name_en = 'Nerdbox — Chùa Hà', name_vi = 'Nerdbox — Chùa Hà' where slug = 'nerdbox-studing';
update public.places set name_en = 'NOIRE Cafe & Bistro — Empress Tower', name_vi = 'NOIRE Cafe & Bistro — Empress Tower' where slug = 'noire-cafe-bistro-empress-tower-hai-ba-trung';
update public.places set name_en = 'NOIRE Cafe & Bistro — The Galleria', name_vi = 'NOIRE Cafe & Bistro — The Galleria' where slug = 'noire-cafe-bistro-the-galleria-son-kim-capital';
update public.places set name_en = 'NOIRE Cafe & Bistro — The Mett', name_vi = 'NOIRE Cafe & Bistro — The Mett' where slug = 'noire-cafe-bistro-the-mett';
update public.places set name_en = 'OKKIO Caffe — Bảo Tàng Mỹ Thuật', name_vi = 'OKKIO Caffe — Bảo Tàng Mỹ Thuật' where slug = 'okkio-caffe-bao-tang-my-thuat';
update public.places set name_en = 'OKKIO Caffe — Lê Lợi', name_vi = 'OKKIO Caffe — Lê Lợi' where slug = 'okkio-hcmc';
update public.places set name_en = 'OKKIO Caffe — Phạm Ngọc Thạch', name_vi = 'OKKIO Caffe — Phạm Ngọc Thạch' where slug = 'okkio';
update public.places set name_en = 'OKKIO Caffe — Thảo Điền', name_vi = 'OKKIO Caffe — Thảo Điền' where slug = 'okkio-thao-dien';
update public.places set name_en = 'OKKIO Caffe — Tự Do', name_vi = 'OKKIO Caffe — Tự Do' where slug = 'okkio-caffe-tu-do';
update public.places set name_en = 'Pasta Club Not So Italian — Hai Bà Trưng', name_vi = 'Pasta Club Not So Italian — Hai Bà Trưng' where slug = 'pasta-club-not-so-italian';
update public.places set name_en = 'Pasta Club Not So Italian — Thảo Điền', name_vi = 'Pasta Club Not So Italian — Thảo Điền' where slug = 'pasta-club-not-so-italian-hcmc';
update public.places set name_en = 'Pazzi Pizza — Nguyễn Thành Ý', name_vi = 'Pazzi Pizza — Nguyễn Thành Ý' where slug = 'pazzi-pizza';
update public.places set name_en = 'Pizza 4P''s — Bảo Khánh', name_vi = 'Pizza 4P''s — Bảo Khánh' where slug = 'pizza-4p-s-bao-khanh';
update public.places set name_en = 'Pizza 4P''s — Bến Thành', name_vi = 'Pizza 4P''s — Bến Thành' where slug = 'pizza-4p-s-ben-thanh';
update public.places set name_en = 'Pizza 4P''s — Hai Bà Trưng', name_vi = 'Pizza 4P''s — Hai Bà Trưng' where slug = 'pizza-4p-s-hai-ba-trung';
update public.places set name_en = 'Pizza 4P''s — Hanoi Centre', name_vi = 'Pizza 4P''s — Hanoi Centre' where slug = 'pizza-4p-s-hanoi-centre';
update public.places set name_en = 'Pizza 4P''s — Hoàng Thành Tower', name_vi = 'Pizza 4P''s — Hoàng Thành Tower' where slug = 'pizza-4p-s-hoang-thanh-tower';
update public.places set name_en = 'Pizza 4P''s — Lê Thánh Tôn', name_vi = 'Pizza 4P''s — Lê Thánh Tôn' where slug = 'pizza-4p-s-le-thanh-ton';
update public.places set name_en = 'Pizza 4P''s — Saigon Pearl', name_vi = 'Pizza 4P''s — Saigon Pearl' where slug = 'pizza-4p-s-saigon-pearl';
update public.places set name_en = 'Pizza 4P''s — Tràng Tiền', name_vi = 'Pizza 4P''s — Tràng Tiền' where slug = 'pizza-4p-s-trang-tien';
update public.places set name_en = 'Pizza 4P''s — Võ Văn Kiệt', name_vi = 'Pizza 4P''s — Võ Văn Kiệt' where slug = 'pizza-4p-s-vo-van-kiet';
update public.places set name_en = 'Pizza Bella — Nguyễn Khắc Hiếu', name_vi = 'Pizza Bella — Nguyễn Khắc Hiếu' where slug = 'pizza-bella';
update public.places set name_en = 'Pizza Bella — Trần Quang Diệu', name_vi = 'Pizza Bella — Trần Quang Diệu' where slug = 'pizza-bella-hanoi';
update public.places set name_en = 'Puro House — Hồ Nghinh', name_vi = 'Puro House — Hồ Nghinh' where slug = 'puro-house-ho-nghinh';
update public.places set name_en = 'Puro House — Hội An', name_vi = 'Puro House — Hội An' where slug = 'puro-house-restaurant-hoi-an';
update public.places set name_en = 'Puro House — Lý Thường Kiệt', name_vi = 'Puro House — Lý Thường Kiệt' where slug = 'puro-house-restaurant-ly-thuong-kiet';
update public.places set name_en = 'Ramen Haruki — Hoàn Kiếm', name_vi = 'Ramen Haruki — Hoàn Kiếm' where slug = 'ramen-haruki-hoan-kiem';
update public.places set name_en = 'Ramen Haruki — Linh Lang', name_vi = 'Ramen Haruki — Linh Lang' where slug = 'ramen-haruki';
update public.places set name_en = 'Sushi Hokkaido Sachi — Hoàng Đạo Thúy', name_vi = 'Sushi Hokkaido Sachi — Hoàng Đạo Thúy' where slug = 'sushi-hokkaido-sachi-hoang-dao-thuy';
update public.places set name_en = 'Sushi Hokkaido Sachi — Lotte Mall West Lake Hanoi', name_vi = 'Sushi Hokkaido Sachi — Lotte Mall West Lake Hanoi' where slug = 'sushi-hokkaido-sachi-lotte-mall-west-lake-ha-noi';
update public.places set name_en = 'Sushi Hokkaido Sachi — Trần Hưng Đạo', name_vi = 'Sushi Hokkaido Sachi — Trần Hưng Đạo' where slug = 'sushi-hokkaido-sachi';
update public.places set name_en = 'Sushi Hokkaido Sachi — Vincom Metropolis', name_vi = 'Sushi Hokkaido Sachi — Vincom Metropolis' where slug = 'sushi-hokkaido-sachi-vincom-metropolis';
update public.places set name_en = 'Sushi Ichi — Nguyễn Hữu Huân', name_vi = 'Sushi Ichi — Nguyễn Hữu Huân' where slug = 'sushi-ichi-1';
update public.places set name_en = 'Sushi Ichi — Tống Duy Tân', name_vi = 'Sushi Ichi — Tống Duy Tân' where slug = 'sushi-ichi-2-sushi-grill';
update public.places set name_en = 'Sweet As Coffee Roasters — Hàng Chĩnh', name_vi = 'Sweet As Coffee Roasters — Hàng Chĩnh' where slug = 'sweet-as-coffee-roasters';
update public.places set name_en = 'Sweet As Coffee Roasters — Tô Ngọc Vân', name_vi = 'Sweet As Coffee Roasters — Tô Ngọc Vân' where slug = 'sweet-as-coffee-roasters-hanoi';
update public.places set name_en = 'T Roaster — Hồ Xuân Hương', name_vi = 'T Roaster — Hồ Xuân Hương' where slug = 't-roaster-hue';
update public.places set name_en = 'T Roaster — Kim Long', name_vi = 'T Roaster — Kim Long' where slug = 't-roaster';
update public.places set name_en = 'The Collective — Hà Hồi', name_vi = 'The Collective — Hà Hồi' where slug = 'the-collective-hanoi';
update public.places set name_en = 'The Collective — Trần Thánh Tông', name_vi = 'The Collective — Trần Thánh Tông' where slug = 'the-collective';
update public.places set name_en = 'The Running Bean — Hồ Tùng Mậu', name_vi = 'The Running Bean — Hồ Tùng Mậu' where slug = 'the-running-bean-coffee-and-brunch-hcmc';
update public.places set name_en = 'The Running Bean — Mạc Thị Bưởi', name_vi = 'The Running Bean — Mạc Thị Bưởi' where slug = 'the-running-bean-coffee-and-brunch';
update public.places set name_en = 'The Running Bean — Ngô Thì Nhậm', name_vi = 'The Running Bean — Ngô Thì Nhậm' where slug = 'the-running-bean-ngo-thi-nham-coffee-and-brunch';
update public.places set name_en = 'The Running Bean — Nguyễn Trung Trực', name_vi = 'The Running Bean — Nguyễn Trung Trực' where slug = 'the-running-bean-coffee-and-brunch-3';
update public.places set name_en = 'The Running Bean — Nhà Thờ', name_vi = 'The Running Bean — Nhà Thờ' where slug = 'the-running-bean-nha-tho-coffee-and-brunch';
update public.places set name_en = 'Toka Coffee — Phạm Đình Hổ', name_vi = 'Toka Coffee — Phạm Đình Hổ' where slug = 'toka-coffee-stand';
update public.places set name_en = 'Toka Coffee — Phù Đổng Thiên Vương', name_vi = 'Toka Coffee — Phù Đổng Thiên Vương' where slug = 'toka-coffee-shop';
update public.places set name_en = 'Toka Coffee — Thi Sách', name_vi = 'Toka Coffee — Thi Sách' where slug = 'toka-coffee';
update public.places set name_en = 'Tranquil Books & Coffee — Nguyễn Quang Bích', name_vi = 'Tranquil Books & Coffee — Nguyễn Quang Bích' where slug = 'tranquil-books-coffee-5-nguyen-quang-bich';
update public.places set name_en = 'Truffle & Co. — Mạc Thị Bưởi', name_vi = 'Truffle & Co. — Mạc Thị Bưởi' where slug = 'truffle-co-mac-thi-buoi-italian-restaurant-pizza';
update public.places set name_en = 'Truffle & Co. — Phú Mỹ Hưng', name_vi = 'Truffle & Co. — Phú Mỹ Hưng' where slug = 'truffle-co-phu-my-hung-italian-restaurant-pizza-';
update public.places set name_en = 'Wego Coffee — Đông Du', name_vi = 'Wego Coffee — Đông Du' where slug = 'wego-coffee-type-dong-du';
update public.places set name_en = 'Wego Coffee — Phú Mỹ Hưng', name_vi = 'Wego Coffee — Phú Mỹ Hưng' where slug = 'wego-coffee-roasters-phu-my-hung';
update public.places set name_en = 'Wego Coffee — Riverfront Financial Centre', name_vi = 'Wego Coffee — Riverfront Financial Centre' where slug = 'wego-coffee-riverfront-financial-centre';
update public.places set name_en = 'Wego Coffee — Thảo Điền', name_vi = 'Wego Coffee — Thảo Điền' where slug = 'wego-coffee-thao-dien';
update public.places set name_en = 'Yeshi Taiwanese Kitchen — Lê Ngô Cát', name_vi = 'Yeshi Taiwanese Kitchen — Lê Ngô Cát' where slug = 'yeshi-taiwanese-kitchen';
update public.places set name_en = 'Yeshi Taiwanese Kitchen — Thảo Điền', name_vi = 'Yeshi Taiwanese Kitchen — Thảo Điền' where slug = 'yeshi-taiwanese-kitchen-hcmc';

-- 2. Branches whose suffix was a district code: the ward instead. (2)

update public.places set name_en = 'Đệ Nhất Mì Kéo — Bình Trưng', name_vi = 'Đệ Nhất Mì Kéo — Bình Trưng' where slug = 'de-nhat-mi-keo-quan-2-chi-nhanh-8';
update public.places set name_en = 'Pazzi Pizza — Hòa Hưng', name_vi = 'Pazzi Pizza — Hòa Hưng' where slug = 'pazzi-pizza-q10';

-- 3. A type word or a tagline after the dash: the app prints the category beside the name. (47)

update public.places set name_en = '99/81 Coffee', name_vi = '99/81 Coffee' where slug = '9981-coffee-wine-tapas-cafe-nha-tho-lon-ha-noi';
update public.places set name_en = 'Arata', name_vi = 'Arata' where slug = 'arata-board-games';
update public.places set name_en = 'Au Patio', name_vi = 'Au Patio' where slug = 'au-patio-brunch-wine';
update public.places set name_en = 'Bao La', name_vi = 'Bao La' where slug = 'bao-la-hidden-bar';
update public.places set name_en = 'Boho Đà Lạt', name_vi = 'Boho Đà Lạt' where slug = 'boho-da-lat-brunch-dine';
update public.places set name_en = 'Búp Sky Cuisine', name_vi = 'Búp Sky Cuisine' where slug = 'bup-sky-cuisine-asian-fusion';
update public.places set name_en = 'CAB APT Calmette', name_vi = 'CAB APT Calmette' where slug = 'cab-apt-calmette-cafe-dessert';
update public.places set name_en = 'Cầm Ca', name_vi = 'Cầm Ca' where slug = 'cam-ca-coffee-tea';
update public.places set name_en = 'Chồ Dining', name_vi = 'Chồ Dining' where slug = 'cho-dining-the-river-s-heritage';
update public.places set name_en = 'Cultra Taproom', name_vi = 'Cultra Taproom' where slug = 'cultra-taproom-rooftop-bar';
update public.places set name_en = 'Da Nang Rooftop', name_vi = 'Da Nang Rooftop' where slug = 'da-nang-rooftop-craft-beer';
update public.places set name_en = 'Déglacer', name_vi = 'Déglacer' where slug = 'deglacer-modern-riverside-bistro';
update public.places set name_en = 'El Toro', name_vi = 'El Toro' where slug = 'el-toro-home-for-steaks-wines';
update public.places set name_en = 'Harbour', name_vi = 'Harbour' where slug = 'harbour-rooftop-eatery-bar';
update public.places set name_en = 'Heim', name_vi = 'Heim' where slug = 'heim-a-house-of-classics';
update public.places set name_en = 'Hèm Hội An', name_vi = 'Hèm Hội An' where slug = 'hem-hoi-an-cocktail-bar';
update public.places set name_en = 'House Of Merlin', name_vi = 'House Of Merlin' where slug = 'house-of-merlin-cocktail-bar-eatery';
update public.places set name_en = 'Jeremy''s Kitchen', name_vi = 'Jeremy''s Kitchen' where slug = 'jeremy-s-kitchen-bakery-cafe';
update public.places set name_en = 'KOKI', name_vi = 'KOKI' where slug = 'koki-the-house-of-senses';
update public.places set name_en = 'L’Entrecote', name_vi = 'L’Entrecote' where slug = 'l-entrecote-social-meating';
update public.places set name_en = 'Lavie Concept', name_vi = 'Lavie Concept' where slug = 'lavie-concept-more-than-coffee';
update public.places set name_en = 'Lulu', name_vi = 'Lulu' where slug = 'lulu-bar-eatery';
update public.places set name_en = 'Malibu Beach Club', name_vi = 'Malibu Beach Club' where slug = 'malibu-beach-club-seaside-chill-cocktails';
update public.places set name_en = 'Marché Đà Lạt', name_vi = 'Marché Đà Lạt' where slug = 'marche-da-lat-beer-garden';
update public.places set name_en = 'Mew Roastery', name_vi = 'Mew Roastery' where slug = 'mew-roastery-specialty-coffee';
update public.places set name_en = 'Mon Coeur', name_vi = 'Mon Coeur' where slug = 'mon-coeur-artisan-breads';
update public.places set name_en = 'Muối Tiêu', name_vi = 'Muối Tiêu' where slug = 'muoi-tieu-salt-n-pepper-kitchen';
update public.places set name_en = 'NOI', name_vi = 'NOI' where slug = 'noi-premium-wood-fire-dining-restaurant-bar';
update public.places set name_en = 'Olio & Terra', name_vi = 'Olio & Terra' where slug = 'olio-terra-pasta-lab';
update public.places set name_en = 'On The Rocks', name_vi = 'On The Rocks' where slug = 'on-the-rocks-cocktail-bar-modern-cocktail-bar';
update public.places set name_en = 'Phủ Phê', name_vi = 'Phủ Phê' where slug = 'phu-phe-banh-cafe';
update public.places set name_en = 'Pincho', name_vi = 'Pincho' where slug = 'pincho-tapas-kitchen-and-drinks';
update public.places set name_en = 'Rehab Station', name_vi = 'Rehab Station' where slug = 'rehab-station-social-dining';
update public.places set name_en = 'Rosie Posie 2', name_vi = 'Rosie Posie 2' where slug = 'rosie-posie-2-signature-cafe';
update public.places set name_en = 'RRR', name_vi = 'RRR' where slug = 'rrr-just-a-bar';
update public.places set name_en = 'Ru', name_vi = 'Ru' where slug = 'ru-brunch-dinner-wine';
update public.places set name_en = 'Snuffbox', name_vi = 'Snuffbox' where slug = 'snuffbox-speakeasy-cocktail-bar';
update public.places set name_en = 'Sunrise Lounge', name_vi = 'Sunrise Lounge' where slug = 'sunrise-lounge-rooftop-sky-bar';
update public.places set name_en = 'The Astro', name_vi = 'The Astro' where slug = 'the-astro-ha-noi-whisky-cocktail-bar';
update public.places set name_en = 'The Feeling', name_vi = 'The Feeling' where slug = 'the-feeling-cocktails-bar';
update public.places set name_en = 'The Joi Factory', name_vi = 'The Joi Factory' where slug = 'the-joi-factory-vegetarian-cafe-restaurant';
update public.places set name_en = 'Ti-răng', name_vi = 'Ti-răng' where slug = 'ti-rang-cafe-and-brunch';
update public.places set name_en = 'Tomatito Saigon', name_vi = 'Tomatito Saigon' where slug = 'tomatito-saigon-tapas-bar';
update public.places set name_en = 'Towa', name_vi = 'Towa' where slug = 'towa-japanese-cuisine';
update public.places set name_en = 'Two Trees', name_vi = 'Two Trees' where slug = 'two-trees-bakery-coffee';
update public.places set name_en = 'Yoshiya', name_vi = 'Yoshiya' where slug = 'yoshiya-omurice-ramen';
update public.places set name_en = 'Zi Coffee & Roastery', name_vi = 'Zi Coffee & Roastery' where slug = 'zi-coffee-roastery-specialty-coffee-brunch';

-- 4. One branch, a ward or a building after the dash: nothing to tell apart. (46)

update public.places set name_en = '.than', name_vi = '.than' where slug = 'than-tan-dinh';
update public.places set name_en = '16 Grams Café', name_vi = '16 Grams Café' where slug = '16-grams-cafe-tan-dinh';
update public.places set name_en = 'Aramour Coffee Roasters', name_vi = 'Aramour Coffee Roasters' where slug = 'aramour-coffee-roasters-thao-dien';
update public.places set name_en = 'Bánh Mì Chấm Hung Tubes', name_vi = 'Bánh Mì Chấm Hung Tubes' where slug = 'banh-mi-cham-hung-tubes-hai-ba-trung';
update public.places set name_en = 'Blank Lounge', name_vi = 'Blank Lounge' where slug = 'blank-lounge';
update public.places set name_en = 'Cafe Domo', name_vi = 'Cafe Domo' where slug = 'cafe-domo-nguyen-son';
update public.places set name_en = 'Cafe Slow', name_vi = 'Cafe Slow' where slug = 'cafe-slow-thao-dien';
update public.places set name_en = 'Caffeinerush', name_vi = 'Caffeinerush' where slug = 'caffeinerush-hoi-vu';
update public.places set name_en = 'CantYna', name_vi = 'CantYna' where slug = 'cantyna-thao-dien';
update public.places set name_en = 'Dangdo Cafe', name_vi = 'Dangdo Cafe' where slug = 'dangdo-cafe-thao-dien';
update public.places set name_en = 'Delab', name_vi = 'Delab' where slug = 'delab-thao-dien';
update public.places set name_en = 'Đèn Dầu', name_vi = 'Đèn Dầu' where slug = 'den-dau-thao-dien';
update public.places set name_en = 'Dontam', name_vi = 'Dontam' where slug = 'dontam-thao-dien';
update public.places set name_en = 'Faro Cafe', name_vi = 'Faro Cafe' where slug = 'faro-cafe-nguyen-trai-corner';
update public.places set name_en = 'Fuku Coffee & Matcha', name_vi = 'Fuku Coffee & Matcha' where slug = 'fuku-coffee-matcha-yen-the';
update public.places set name_en = 'Genki Sushi', name_vi = 'Genki Sushi' where slug = 'genki-sushi-saigon-centre';
update public.places set name_en = 'Gusto Pasta Bar', name_vi = 'Gusto Pasta Bar' where slug = 'gusto-pasta-bar-nguyen-gia-thieu';
update public.places set name_en = 'Gyu Shige', name_vi = 'Gyu Shige' where slug = 'gyu-shige-lancaster';
update public.places set name_en = 'La Haye', name_vi = 'La Haye' where slug = 'la-haye-metropole';
update public.places set name_en = 'La Libra Steak House', name_vi = 'La Libra Steak House' where slug = 'la-libra-steak-house-trang-tien';
update public.places set name_en = 'La Table Hanoia', name_vi = 'La Table Hanoia' where slug = 'la-table-hanoia-press-club';
update public.places set name_en = 'Laluna Cafe & Brunch', name_vi = 'Laluna Cafe & Brunch' where slug = 'laluna-cafe-brunch-midtown';
update public.places set name_en = 'Littlecam', name_vi = 'Littlecam' where slug = 'littlecam-saigon-2';
update public.places set name_en = 'M Sourdough Pizza', name_vi = 'M Sourdough Pizza' where slug = 'm-sourdough-pizza-thao-dien';
update public.places set name_en = 'Maazi', name_vi = 'Maazi' where slug = 'maazi-old-quarter';
update public.places set name_en = 'Monia Café', name_vi = 'Monia Café' where slug = 'monia-cafe-the-giao';
update public.places set name_en = 'NOIRE Dining & Cafe', name_vi = 'NOIRE Dining & Cafe' where slug = 'noire-dining-cafe-pham-ngoc-thach';
update public.places set name_en = 'NOIRE Japanese Fusion & Bar', name_vi = 'NOIRE Japanese Fusion & Bar' where slug = 'noire-japanese-fusion-bar-the-crest';
update public.places set name_en = 'Oggy Salmon 2', name_vi = 'Oggy Salmon 2' where slug = 'oggy-salmon-2-95-nguyen-tri-phuong';
update public.places set name_en = 'Phở Inn', name_vi = 'Phở Inn' where slug = 'pho-inn-6-le-thai-to';
update public.places set name_en = 'S''mores Saigon', name_vi = 'S''mores Saigon' where slug = 's-mores-saigon-nguyen-binh-khiem';
update public.places set name_en = 'Saveur Café', name_vi = 'Saveur Café' where slug = 'saveur-cafe-tan-dinh';
update public.places set name_en = 'Sense7 Coffee', name_vi = 'Sense7 Coffee' where slug = 'sense7-coffee-vph';
update public.places set name_en = 'SOKO Cake Bake & Brunch', name_vi = 'SOKO Cake Bake & Brunch' where slug = 'soko-cake-bake-brunch-pasteur';
update public.places set name_en = 'Tacos Fresh and More', name_vi = 'Tacos Fresh and More' where slug = 'tacos-fresh-and-more-old-quarter';
update public.places set name_en = 'Takashimaya', name_vi = 'Takashimaya' where slug = 'takashimaya';
update public.places set name_en = 'Thaiyen Cafe', name_vi = 'Thaiyen Cafe' where slug = 'thaiyen-cafe-cafe-yen-80-nguyen-du-p-sai-gon';
update public.places set name_en = 'The Long', name_vi = 'The Long' where slug = 'the-long-times-square';
update public.places set name_en = 'The Melbourne Cafe Restaurant', name_vi = 'The Melbourne Cafe Restaurant' where slug = 'the-melbourne-cafe-restaurant-an-phu-lumiere-riv';
update public.places set name_en = 'The Sipping Bar', name_vi = 'The Sipping Bar' where slug = 'the-sipping-bar-waterfront';
update public.places set name_en = 'Tranquil', name_vi = 'Tranquil' where slug = 'tranquil';
update public.places set name_en = 'Tranquil Artisan Coffee', name_vi = 'Tranquil Artisan Coffee' where slug = 'tranquil-artisan-coffee-08-nguyen-quang-bich';
update public.places set name_en = 'Trình Cà Phê', name_vi = 'Trình Cà Phê' where slug = 'trinh-ca-phe-111-nguyen-huu-tho';
update public.places set name_en = 'Trốn Cà Phê', name_vi = 'Trốn Cà Phê' where slug = 'tron-ca-phe-thao-dien';
update public.places set name_en = 'Vị An', name_vi = 'Vị An' where slug = 'vi-an-145-hoang-cau';
update public.places set name_en = 'Wok of Love', name_vi = 'Wok of Love' where slug = 'wok-of-love-quan-7';

-- 5. The half after the dash may be half the name; the owner kept these, dash only. (7)

update public.places set name_en = 'BepBo — Quán Bò Xèo', name_vi = 'BepBo — Quán Bò Xèo' where slug = 'bepbo-quan-bo-xeo';
update public.places set name_en = 'Bỗng — Ốc Ngon Hà Nội', name_vi = 'Bỗng — Ốc Ngon Hà Nội' where slug = 'bong-oc-ngon-ha-noi';
update public.places set name_en = 'Level 8 — House of Barbaard Bar', name_vi = 'Level 8 — House of Barbaard Bar' where slug = 'level-8-house-of-barbaard-bar';
update public.places set name_en = 'Mâm — Cơm Việt Lối Huế', name_vi = 'Mâm — Cơm Việt Lối Huế' where slug = 'mam-com-viet-loi-hue';
update public.places set name_en = 'Mỳ Bò — Doru Food & Drinks', name_vi = 'Mỳ Bò — Doru Food & Drinks' where slug = 'my-bo-doru-food-drinks';
update public.places set name_en = 'Nhật — Tiệm Cà Phê Mặt Trời', name_vi = 'Nhật — Tiệm Cà Phê Mặt Trời' where slug = 'nhat-tiem-ca-phe-mat-troi';
update public.places set name_en = 'Slow Breeze Coffee — Kobumcha', name_vi = 'Slow Breeze Coffee — Kobumcha' where slug = 'slow-breeze-coffee-kobumcha-da-nang';
