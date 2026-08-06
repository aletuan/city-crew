delete from place_photos where place_id = (select id from places where slug = 'book-street');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS8Yv1zcvdTERUI2V47UxkPw/photos/AWCwydikfdvQ_c38FMTeCJwCIiKjcnoZYwyIi-HWe_h56I8IiYra9cChapcQmES8FIec04ZfOc05a-qJrjoSl03xtUwLT5vkw8_gpKU2mWUAiV3CXuBhCdLWrefgLzixW1psSJdf1tc4samSnGYnVI9tbqhR-XfVuI26ckeziAw6z3djDIP2eIS6iRhs31nO9BErhe8a8lDw4YW1muRwNi0OXdRDGBRxpLoySzmWlEza-m1wGHgOZP5FbveK9F2ExohUXz0XAwUl-kPv4QDzLsJhyRefVZiYSYj8aiw0tR6TAYCv4R5I162ZSnB5LUjPxTRrvQTjTjunylZJdvbiRbONt64wPX8TEEs_mAB5tZ3j-lFmEaFOW-hpHKqeg07g5OJKGwlES4HVS6quKqJwicj6FgWNCUh6MZ4iNsEgFt-PZ46YkkyeprA9PNG8Z55tDTJQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBTTAeL3InHQGDA4vcCuE7z572hR3siY3y6HKbtwEY3vB-477Yh-Q89qM0uXXBdBdKwkCUNkH-_9ZLkkDFOhykhCtaTyOm_gqOB6OIDXPjxOOQzSbWP80nAY6uWEcTCbMauaw8pz57-5EAP--Vd1Y8B1w=s4800-w800', 4608, 3456, 'Nguyễn Xuân Vĩnh Hưng', 'https://maps.google.com/maps/contrib/100783457268148256357', 0, true
from places where slug = 'book-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS8Yv1zcvdTERUI2V47UxkPw/photos/AWCwydhspiOCJYzBraJoMEIi-kNpZztj-QsNXdqEVCple7zNlvgUrgjfxqO6BxCw5l78_kBrO1gOXHMdseQn6MHsf6PxOTxvGxuVLSVMEvPMb8lyEBoI0z9rukj3xbAMfU_NCx46XV06mL74AU3j5I5U4BBmE4EO2x3IwhsChPRv0BOCJ-XferqKp_IMLreCGx3CV8rZKQ1Oa6WzSwlDqKWk6PcyI48R2IF3-kPK2JEvlxdKyQ8dVRV1hEnDONC4LgyAOSHuG8acDUmP_lDOdt52Ymkf_casQdCVHoaEshctWMuvoQlzE_X8uKhAEDGvBsEQax69hq8zC_s5Tho_SdfaL8WUoBryy4_XcGldn7t8udltLhE1Q-J_svTmQ893hDNvm3Vw6b7-1Um8HE6svTcYwQ0Qu9rQwI4wYcxm-5cwNpk', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCVnqRmIslD-Z94hIAS_2I0tHzZ4jRF10ADeE1I1dJk1gZzGdvB5GrdT62jIlJKtUCXqf76l6dZ8m9I340g9gawkjmvDtHohNrCLVQZkTzss_OI7lp_KvFC6UD9Un8rAt_ib9Fs6_sB5ATW=s4800-w800', 3024, 3024, 'Ánh Diệp Lê', 'https://maps.google.com/maps/contrib/100727059689942813727', 1, false
from places where slug = 'book-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS8Yv1zcvdTERUI2V47UxkPw/photos/AWCwydipocrx9qCZsAC0pFWSmXbq60rB8O0gsI7lR2kN30JOen_CPB5gYLSDCOLj2qU4b4BLVBO2y9jAa7frZgfw8Err31Oyp83pz5h0Z82KJyYKTh80DOA0Yv7e2u3bbfpOBRR1r7rArYLr4hMHDugqyIqsP2kX5pXTcn2wx7zrm1JSGc6acRzsiGXD1MxQ722fuHY9dCCWFMq9zMC_oba2ZjkcKdNV7-b2_go5u8fuYXssdojegRk6rIWSKUC1KCclhTYoyS9j3gXItZslHEaEUdOvKmjal-BtPVPW-NGomcgiArCfyTkHJo8PM9VL_2joAP7CB9kqUjqJchqsPRaRfGsAjll32swy0Q5eJ_fNthPXcQ_elWEaJUgcVne8l4fc1zg4_hqSM7RAUOvnt_aIwAfSXGaeD9Baqak9EdKGqVPqg44', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDWGR_6DNhIoZxHRzXEipfkQjbQNp0LzLHuRxuVxKm0-v8YVvcptrcECSfdwVTAvUoIEVFOnqkFpXDRStTaGJ1j4ShjKX81j7RcU54OE8SsAfyc5TARTpPiskf02ZK-Uk5vIJwjbLo2hUDoIQ=s4800-w800', 3599, 4800, 'apjapi_ korea', 'https://maps.google.com/maps/contrib/103528797516602257479', 2, false
from places where slug = 'book-street';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('starlight-bridge', 'ChIJS1XKdwAvdTERjdkqkA16o-0', 'Starlight Bridge', 'Cầu Ánh Sao', 'out', false, array['outdoors','views']::text[],
  'District 7', 'Quận 7', '6 Đ. Tôn Dật Tiên, Khu đô thị Phú Mỹ Hưng, Tân Mỹ, Hồ Chí Minh, Vietnam', 10.724701399999999, 106.71863959999999, 4.6, 36,
  null, '0₫', 0, 45, 90,
  'LED-lit pedestrian bridge in Phú Mỹ Hưng — night walk plus cheap snacks at the lakeside.', 'Cầu đi bộ thắp đèn LED ở Phú Mỹ Hưng — dạo đêm và ăn vặt ven hồ giá rẻ.', '🌉', '["Monday: Open 24 hours","Tuesday: Open 24 hours","Wednesday: Open 24 hours","Thursday: Open 24 hours","Friday: Open 24 hours","Saturday: Open 24 hours","Sunday: Open 24 hours"]'::jsonb, null, null, 1, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'starlight-bridge');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS1XKdwAvdTERjdkqkA16o-0/photos/AWCwydgiGi_kh2Hehhw0Q_lsWSOk3vumKae2fFlEVkArhQPec7xEj-_koGnsz9L65LUV1SB87Vj4KM88pME2jCk71x4G3s2mfHfjTr4qfGolVo6l28GR9jHk3jwPU36ZVXijMp8J9I7qSrpZDJB6k8E-kV3hYvyZSdtP-5MREtKnhwrSuyl1_c9LRYvU_MASmPsDspydYP_wrEszptJYGQi0ZPXIMTFATFA1pQkatwtC_1wVSuAovUD1aCT-Vlwkq-eAa2WbEO8Myb8ftFbayRLV99ZFVRCzp7zaf2zG3gLZ8VceO28Qehp_B_1gzwR8WL_zddg8dO7y7fF2Gi60GWJSRy9oDiujCTY1UByx92eIk-j2dZJz0FvMAuScVmDf9JYpuC4OHwopYyKbbC9kBURC-0epaj29gTQay-o3saccGOSdwdC2ngZbvYiA8hoeF4ET', 'https://lh3.googleusercontent.com/place-photos/AG9NLjD12Ec8W6YFsDF2k8MS4Rpx7TxKlr26IziaE4Vd0iLABWvhoXzdcddbKjjEtKvwJl-WsEOsEcG299wzElnyyP8N7iPGjDBBIyfQ-X2NjofqBO8JPD5KNMxlphQMdYRTVo_-KYDTSi6V64_kauvYxN9HsQ=s4800-w800', 4032, 3024, 'zoharix', 'https://maps.google.com/maps/contrib/116587133673750272997', 0, true
from places where slug = 'starlight-bridge';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS1XKdwAvdTERjdkqkA16o-0/photos/AWCwydjHu-nzV_GsRyA8z_qe0rbQoam1tGJ0ldgsrqVGldA59A0h7zeZ9RQwOM7ii0HhKLBr7O4KKBcR5P_g8lvGc7LUf8qk2n23I1XSu6J6zWw0EwSKJFRIfnF1J_22-_JnGNS5FlwWyHugOUocWT_GwU4lkSIET2jMrNGs6nzV3NcvORaUBg2wGPX0cAq6VciMIrx2mf8PcCmPOnphUbzt5-F6FKPaTv4qG148y_aV0zWL5phIR4wzUoliFbcJsNut6qIh_lUDidwIOLQCVJYZPuBX3gmwUFE6CDgidc09Q6qqMwhpeWcy_NuggwU3mhLbslUDHaa6xKaW_7OGJt-KWvYqiTTPt6zZcd1YFmeNzNMeBjTWQ9IFpKa0xLzOZuOQC96mMG4cvXE7hZ9kQ2zv5CXKz5F_7AV_zSfjUGvbdYWDiOq2zHLsfiOp40oIsCY4', 'https://lh3.googleusercontent.com/place-photos/AG9NLjB2q-p-Ch8yLQeCzJhEybdCTgo1DBF0Wb6-2DkI13ANXV4DlJhXllVfZnb1YZecdQ1Zvc5kfamP7GwiToR-bqFBgAFF3lru6gIVDzmPkdiL52xl9-rYfNjTgOkqwtEMPVnHr6E_qAyjgFT45qS6FN9uVw=s4800-w800', 4032, 3024, 'zoharix', 'https://maps.google.com/maps/contrib/116587133673750272997', 1, false
from places where slug = 'starlight-bridge';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJS1XKdwAvdTERjdkqkA16o-0/photos/AWCwydi0ajFFr8QW57QxHYDFAMIV83qXrz7avWY5VgzNHnjOKbWtZn5agwtTY1mIGoEypf0AoD8fTS20rtv_ymRixJw8Ph4HFWKDjKxAIFJrhfFG3EDXuAtmBFE1ofMUMpLzXQA7BkxgOOEmWerN16GLrAeCdEstypl1rOmYgV55NQYh5UYiMBv7Xd6LGl2jjDhHh0-UKSByUEp3jTGujA6mtpTpwPGWgbgIq0f2tL7niqflWqtpX8C2HglidisVjLaO2nqrILZnC-7M0cFqrdZjCCR9VwPAS_8e1AjPuQCq1pQfQAGQOK4inbIPr7YrKHX8NGssi9i9hsS03E2ob1RWr-KC4-kmSfA0qY2URTGS2WN2LBhbEypTeL8SEEwftUhKPsOEvjJpxNxadPXSOVzggVzqzSwbB3uJx9VKv1TyZ15uTvRYEWox9A7WEV1ChXTH', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBh6ip2DhSeJ2Tb1c1LQzTSM_7xZgdMBQpvc7KZNs9wOcxnGwL7BQ58_N6wejk6xBj1wYFRMWNhHsn_AtfmL2DyhAzD3G1yUzn5Dgcm0UlT1GDIp-H-yRehc-pulhEHziA6ecqtr4hQowD5a_qVmIFODA=s4800-w800', 4032, 3024, 'Trọng Hiếu Hồ', 'https://maps.google.com/maps/contrib/106545726650173419436', 2, false
from places where slug = 'starlight-bridge';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('nguyen-hue-walking-street', 'ChIJd6g1QgAvdTERe3onVtPoGVU', 'Nguyễn Huệ Walking Street', 'Phố đi bộ Nguyễn Huệ', 'out', true, array['outdoors','chill']::text[],
  'District 1', 'Quận 1', 'QPF3+JF9, Sai Gon, Ho Chi Minh, Vietnam', 10.7740408, 106.7037237, 4.5, 150,
  null, '0₫', 0, 45, 90,
  'The city''s living room — fountains, skateboarders and street shows from City Hall down to the river; best after dark.', 'Phòng khách của thành phố — đài phun nước, trượt ván và biểu diễn đường phố từ Uỷ ban xuống bờ sông; đẹp nhất khi lên đèn.', '🚶', null, null, null, 5, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'nguyen-hue-walking-street');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJd6g1QgAvdTERe3onVtPoGVU/photos/AWCwydhvxzcNt7Kvl9Bds00uwmfjm9W9RFw5qW31I9fJTKLy0ot4RSMCc8Fspt_a5gm2TuToELN1tOAS5sUdORQ82VUlEdZk3jhq4FPLvtQ_dZqWZ8g9V-aoUfLQzumDbCT41wyyrYmawq7xe9kHFnWaU9P_2XHtSW_slhNPkYDPS177zc2Z6gKchrD5hvJ77mCgXhGWDjcxzEJdirjIGwiMGTCG8vXB23pLEvvpAMrlRaV7qVmbc4IvX4JY8Vhi_CN4S3YS17S7oUaLInYnoWZ0v-nsyoyMVyLUeNldZ3cUPcf7NmaM-RsYiS7yu9d1aR3E3Y0y5XZAwa42FaqcuZO_qwPpoeo6N-apuiwPheRCqWZKTJxtSHkQIxOCrCyLDe0duSQGmFZLja40HOcjO4DKqU1UnSlGm_H3uVzaFz8VJSA4QtnQbImMxSex9FeTxsxt', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBsCJlUuaIBmw33QSyk5b0wGjjBvInYXFqbSeZRrb3Bhf9xdeMXV6-X1GnJ307Q7yzskxM4S7vPWaebC0w0F8sB4VJusDR0c3qcMVVkeqibkwWDm9S0Rl6c-O9p6gGScOPKqRRmdEJgtIjPRs_DzjkU5Q=s4800-w800', 3024, 4032, 'Jen N', 'https://maps.google.com/maps/contrib/102468413286995813430', 0, true
from places where slug = 'nguyen-hue-walking-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJd6g1QgAvdTERe3onVtPoGVU/photos/AWCwydjb57YoKAtDJBZ-FaYD6wIXudApoumaE91jgTGJBT-ciNKK2hrvRdHRxeYUt9Gb10qM2lCgQb-YFuveiiL18kdcIRtDt6jDcIxYwrb1uxtCWc9KnrWY4zsrZ1cI1wsuxPUR3hFbW-qUJPrFhOj9EKMxYOWfGThJDiWm0GOD2v4j6Ik_DB4xJ_o5c8K7p1fsw_2SM1vjIcWWlNH1pHEXDf-s30uoo4YDX51F8k0ehpwwg5U6epSqLmzPEwLNwQbdZIc0epK4PAOpw5KC7Do7A21k8yiSljFlXCMwK9f9lWGKSVayNlLxRVKxw4SIX1xeoOZGWMC9XKZ_RNsbsNBg5QttwgzqTDzwDanvcIsiTwdezbvzA1SvPQ6PWcUOpP7n1jYaWKan-mLCC7lEvbqpwjC2zgyya4aiha1FHDME1en1r8wR6_jxy4XP1pAmnVMR', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBaxQ-xZjIhb_6ypeCsmMMaivNCfITWdNSlpedVFPqA90ZfcCYBu-hYiXCT9wScP6DcPUE2ZyY3HgNp1mIqY3-Bmv_X40Cr9MARGU8M4gcRXdECCnJMNZpZRA-FsG-tnYYXYh5DW3-qk0T3_YoRb9v6nQ=s4800-w800', 4032, 3024, 'yuichi sasaki', 'https://maps.google.com/maps/contrib/103660962830515051392', 1, false
from places where slug = 'nguyen-hue-walking-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJd6g1QgAvdTERe3onVtPoGVU/photos/AWCwydh2SVXhBOtuIOmgdVULXQ3_wPWb0DuteFsqqFlJee2X_1rgbJsIFFFHT9iQ0FDrC_RrE4GxHGqmd2ugoir26M3c0ju07AADSwttsfz8lDpwkDNNrrGntJJdD7feIBpUEpMqeCM1nUuNqQA6CPPPnl5_t6wUfqs6z-gbvokx5sGp2KWJlIq2sXPUvt25YuyTxbGAsITxXh1Tl1LVlwK70ILu-PlkcVg7DA_efcA4Aome5qIjAZSlULD76-pRd04Zek6Dd6-dub79zwJnsB6Fp1vRgrql39w4SjlUPfaPyIniR6Gy2TtqlZbI2XbEvzV8YTzYM0morPfamvRBZNEpfvzDryHn1XfSg6pragaZ1dOfasyRume5U_BJRUUG6Onb1_DUHdJikTzhZSTyG7Zj-8b7wCY1yzcB8rfeX3tjMv_yMz-zNFTIUtAxwcdW4w', 'https://lh3.googleusercontent.com/place-photos/AG9NLjALtSoMcr_K2D-85Idb84k0ZfuypbpfH_KhZVMSWSWnCQJ7WluBCUmpgBfaBT9w2k6ZH1EbKY0bEJpXg6HUl4E_hoxykxxqBhK71XX8EsLixFoZDR0R8gdqPIo8qktxDENLH-OcKttM1m0D4CJMYImN=s4800-w800', 4800, 3600, 'Hajime Kaneko', 'https://maps.google.com/maps/contrib/107874854712181144506', 2, false
from places where slug = 'nguyen-hue-walking-street';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('saigon-zoo', 'ChIJx7wwM0svdTERjuH2a9dkuU0', 'Saigon Zoo & Botanical Gardens', 'Thảo Cầm Viên', 'out', false, array['outdoors']::text[],
  'District 1', 'Quận 1', '2 Nguyễn Bỉnh Khiêm, Sài Gòn, Hồ Chí Minh 700000, Vietnam', 10.787334399999999, 106.70505659999999, 4.3, 36410,
  null, '60k₫', 60000, 120, 180,
  'One of the world''s oldest zoos (1865) with giant century-old trees — go early morning before the heat.', 'Một trong những vườn thú lâu đời nhất thế giới (1865) với những cổ thụ trăm tuổi — đi sáng sớm cho mát.', '🦒', '["Monday: 7:00 AM – 6:30 PM","Tuesday: 7:00 AM – 6:30 PM","Wednesday: 7:00 AM – 6:30 PM","Thursday: 7:00 AM – 6:30 PM","Friday: 7:00 AM – 6:30 PM","Saturday: 7:00 AM – 6:30 PM","Sunday: 7:00 AM – 6:30 PM"]'::jsonb, 'https://saigonzoo.vn/', '+84 28 3829 1425', 2, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'saigon-zoo');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJx7wwM0svdTERjuH2a9dkuU0/photos/AWCwydgHM-fm0RHYAfngIFmxvnAeZZCKpuCF8mBKGXzP65WCMBkaJ_5V4nDe5ZmWpOiUrw4Agumgowql3_xwdwkxGYWiYKThIbllIuuEVrOJroomPTIGgCaGki4t93SQ9d1uXW_44dHPy0VYutTfbScHGRo3Ux3T-jaFQ1vdWtdhLaaVPui3v9yxGFDift2PSVDdGHZAqN8dF35SofJk3FT9PX74MRdg4sD5iwUIUYkfqsV3DFcLCL9zw0u1QbnZL1VlkiljHdxAZxyvTzFo2aTpQrlZ2DdYp_UR3fwDbWe4UEztMdZTU8O719YOlvBnD9bOx-c0hNce84TM3zWpH5P7zI8TPKwynavJWliR-56nr8SJXjhjNacc8MS7dkCSii_o5fWAekMwQhMS_RUnLoXiWdSIsmOx7ts7c2_6Vr3jEaA', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAQcC-PyeQ9RGRAM4-977nISijcb-d-0j_Duf-_I8xp1LRvTx1hcee88U-sbqLp9qdNjxlm8L-zRVB2nmqRVZ2bQTcc-qo_yrhab9MrbFmmjKHclrkIsJJpQpudupSxk2f3qtSUzkB4IT4X=s4800-w800', 3600, 4800, 'Gia Trường Lê', 'https://maps.google.com/maps/contrib/107439197803252668802', 0, true
from places where slug = 'saigon-zoo';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJx7wwM0svdTERjuH2a9dkuU0/photos/AWCwydiPxMsKOXoJ3y6mpxz1fmHRpHrc9RjTzvMqYEzeXalqvobTpn6r54R2O88-9QJ5mcy0qCR2ASlL9rM-ANqoNlsD-8c3W6q8UrxGfJeMu3asFfWJsMR6wuEQ1_oJLl0cddXs_0U9IiotXNQktM7jK5WuRoTvECRLxSS8kG-qX2z_RA4t4cnwDY1c_1REyKKqtpMnS2CztyPYfTsFWIrYPezTUCkbkXI0hvz3FA1l1D9I5Q9hWNX336-y7ckyimlevdCsjlwyvrO2Z76nhd3jRu7hfBzN1T46SOLZT9Kl_YtNaw-CmQ4SH4otpQqrMwpF2gR6yonpdT1gAvUiZfFMjcBPgeSkQA3tOfZObHTyMxSmOnbMxJZCsVa19hJh6dJgCJnx0hJCc52oA6CBnbqpcN80nUCreMjcdOaYpp7yCbPs1rw', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCCQkWJdUvvyQAo-fY6OvnNuwVy2mS65CQGRhFPXn-otbmakvgOQtT6YGK2KMKSmPU-AXA-xkFmmXaUAIzZfIEVLBd7k7ylr1Jm8qkgGexHaudHk6ujCVY1Z25LmDA89hijH60YKSeXYKYtXg=s4800-w800', 1280, 853, 'Na Lyn', 'https://maps.google.com/maps/contrib/100591357600839182004', 1, false
from places where slug = 'saigon-zoo';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJx7wwM0svdTERjuH2a9dkuU0/photos/AWCwydh72kN4cG4rDL21sj2hF9YE4cIpiUK-7lxnFzB6kwlpmJVTRIVxirEps_-jPTwNhyAEMhJnYNKgDTscu31YofwWYgm2fnsptw7LRoeeZ787cR70iMaMT3se6iznQE5hG85z-vrzY_woP9B1s5goE1QT5b-ONWb2oM99Z0GgkcWLkfhE3mgMHfr8PuQSgr71VQyzCOdWqfyGdUie9Mdprswz1lPg7jjN5yO2IGpbk9GehuYLeGYgGMbPgCnLo2iRK_vFWNvFntO8C_duBn0wbYyrlErALGVj20xf_xawjcElbRouBEk9BNGgvrqdmMO9ZF8DlF0KkUPKJNbQ1hoZV_z03wfkEIqNx6IpFRRMwKrI9yMq9vtZ22Jh5Id3mCsCaY-ipBEAI-M-Izd_lXy-Vmf_2NJfWAOJVQbj-xK-WPInRoYK_tqaxN13h7P83cx_', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCgWu_gWVC_FdFBmSTOpZS6MZYkqWw1OxvutJoLeEWzarV7Eb6HuHosMvHCF7vIFylwua0bqUM7MS5zDBUpE9xH3MgbpkeubzB5wM9wbb-iT-wUnY5A7uPEiFmjsIy_pl1SnCPWr4FSumRuYVlqRtt0rA=s4800-w800', 3024, 4032, 'Hiếu Trung (HTH)', 'https://maps.google.com/maps/contrib/111109479427541054837', 2, false
from places where slug = 'saigon-zoo';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('vinhomes-central-park', 'ChIJyS548sYndTERx_fKlYIochM', 'Vinhomes Central Park', 'Công viên Vinhomes Central Park', 'out', false, array['outdoors','chill']::text[],
  'Bình Thạnh', 'Bình Thạnh', 'Trần Trọng Kim, Vinhomes Tân Cảng, Thạnh Mỹ Tây, Hồ Chí Minh, Vietnam', 10.7934308, 106.7243981, 4.6, 8955,
  null, '0₫', 0, 60, 120,
  'Riverside lawns under Landmark 81 — rent a mat, watch the skyline light up, and let the kids run wild.', 'Bãi cỏ ven sông dưới chân Landmark 81 — thuê bạt, ngắm skyline lên đèn và để lũ trẻ chạy nhảy thoả thích.', '🧺', '["Monday: 6:00 AM – 9:30 PM","Tuesday: 6:00 AM – 9:30 PM","Wednesday: 6:00 AM – 9:30 PM","Thursday: 6:00 AM – 9:30 PM","Friday: 6:00 AM – 9:30 PM","Saturday: 6:00 AM – 9:30 PM","Sunday: 6:00 AM – 9:30 PM"]'::jsonb, 'http://vinhomes.vn/', '+84 903 158 325', 2, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'vinhomes-central-park');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJyS548sYndTERx_fKlYIochM/photos/AWCwydjhFce7t6JwMFrhjxs9_iJwNNURXZga3cLxTEPHDH-sZFy9N8G40RdvSn1EdcimIfKd8CHrcQilncNigFhkMpflpFV6HLpkUzS7uS4ndGtjmXWxOqcJS9SsMDyQUU8YCxSDg0eg4DxGg4G9PMxia36OZCMGbG3qpKkBdAbaQDA7vdpMQh-GPqY_pZr61qsYeYRM92FMUATLU2mGD09txEeMiv1Laj_UhdrW4KdXIm-9etsqgxbGX6lqZRpQZGp8qEE7hnH8QYfuwVF_LVfOTbiQw1VLUW6i8gN4O3i2bJ__7QTkS_PxFbtdceb3pMSdOBLfEd3s3NT-poEjuSi72t1bBV1CKr4Fllg6mRrcw-rWGBYwq3cLnxs3fgWjRyRNHckKuaZyH17e7ulEb3U5Axil92_Px7_XnN9WgyqWlXp4rZ8', 'https://lh3.googleusercontent.com/place-photos/AG9NLjA2p2YlVtcBP7FrkjXHYN5W6e1JkdXRgHD9POQT33TE9OunbKKcm8oeW2uP7cb3NCsIrkJZCqaBpoBqxeC0i1utSCfiZ1AaDwFfvGlBgheA7xCWjr2P4Pi0UKQlI27-X0Gp8d4v8PEJZ7hn3g=s4800-w750', 750, 562, 'Huy Nguyen (Marshall)', 'https://maps.google.com/maps/contrib/109752992531610948682', 0, true
from places where slug = 'vinhomes-central-park';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJyS548sYndTERx_fKlYIochM/photos/AWCwydiqNzLrXmgj1agrowY2lLL34RX4VnXF9oWiVtMWv9q8bKXFA5elFlazi6d2jxr9LTgPjHMxQTd0dVBxIxeJBmKLPzv4YZm248nL34m56tPhajNQoGqBGeQe6Tqhfc4kVnsmM6_Qqj3wubmT7s_yMEhhuLl1ID039EQgh3et00EZlqkSW5JHv1wryTe97Jw0NHDqgKtmgzhgeCUE2VNr74t78uMr4BviGmGqFpYuyxmISQBdhY45jMEMD1-L75qtMYLOsoBBnFYU8vh9tDOdFdT67H6gfXec1jPt7U8ecAlkVtb9w4MHVMsSVB9tn907dJMR1fyWzXr287w7RohKsBAvuKwDKpWHysU6mMXZMk7C0qE-1IO6cKMOf4ZFV2BNaE6O0fzvg6KL9zopqO2FngXkMOFh8pL7XsbM3gJ5f5qKeQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjD12S25j3DQzIEs129HTYpGRE7IMqgSMH9omoCICGScbuuzVy7No-snArF2442Z0w3OOQpQFT5Y6CkgzaR5JD7U1IrMIrl0z_PjOlitlzDRyQ3BWLvq_I5ukOqymaLCkDWq4rt8YKCSBqcj3g=s4800-w800', 4032, 3024, 'Vu Le', 'https://maps.google.com/maps/contrib/109257426014720480284', 1, false
from places where slug = 'vinhomes-central-park';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJyS548sYndTERx_fKlYIochM/photos/AWCwydid16-1sxjXJKEep1UFdLC5CzHAgAhcnuFRj546GPQ_i1WxLSuFNtJRODifdIaJOLPXFkbHUfo6wO3vHAkfy1zQbTlNhJLQFcVYJQSQkmUFqkNeI0-hLpCXweLezD80tmJvWERrls-u16wlHdbedJJT__k-ufLxNuaG3QNZ1CMKycz9jCKUvHlJRHPmoYFA3bGyKxWb1zZCtUPW7aC8LbHjE4VWGFyS4-1dKJh51xH_Csn0ccc877QQnRGPQ6LXcrpjbPUcs4FjxbTzmTQlkxCCMFycDts6TNT0AbJYdvhhPbtQdgq6CFeca9F7XJFQB9yRIL-MNnqYgQRJxeeDtKhwhbVOfERMV1eNBv4b5Vz3WtO-Y5ApEexBNyQUIC5I_2GqPHUPwFCAkH29dgukn9GUMVCj7CvqT_AHlU-TR9YR5w', 'https://lh3.googleusercontent.com/place-photos/AG9NLjB9vUA6C2H0KtcT_5E8bUS0GFQU98fvjo9iHyWzTiiXeF7j0l4_QrUom03KSnF9zoi71VZiWrm4jR2EYj7uOKoaMezaXe0V5jLmGxSxMditd0Iur27JrPQ8tg8EDW7BbeCZMeW4e6YObrBj0Q=s4800-w800', 2850, 3800, 'Bobby Nguyen', 'https://maps.google.com/maps/contrib/108074264753865084956', 2, false
from places where slug = 'vinhomes-central-park';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('saigon-square', 'ChIJU4Nmq0AvdTERUijlxbVwFQQ', 'Saigon Square', 'Saigon Square', 'out', false, array['shopping']::text[],
  'Nam Kỳ Khởi Nghĩa, D1', 'Nam Kỳ Khởi Nghĩa, Q1', '77 - 89 Nam Kỳ Khởi Nghĩa, Bến Thành, Hồ Chí Minh, Vietnam', 10.7727039, 106.7002091, 4.1, 9207,
  null, '0₫', 0, 60, 120,
  'Air-conditioned bargain maze — clothes, bags and shoes at haggle-friendly prices; go with a number in mind and halve it.', 'Mê cung mua sắm máy lạnh giá hời — quần áo, túi, giày thoải mái trả giá; cứ lấy giá họ nói chia đôi.', '🛍️', '["Monday: 9:00 AM – 9:00 PM","Tuesday: 9:00 AM – 9:00 PM","Wednesday: 9:00 AM – 9:00 PM","Thursday: 9:00 AM – 9:00 PM","Friday: 9:00 AM – 9:00 PM","Saturday: 9:00 AM – 9:00 PM","Sunday: 9:00 AM – 9:00 PM"]'::jsonb, 'https://s.shopee.vn/8KlMK9jsV8', null, 3, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'saigon-square');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJU4Nmq0AvdTERUijlxbVwFQQ/photos/AWCwydizSdwT4flzPBoQLKfcgBOdcAhe7fMUiA4c1L5jgeTojSKqFObh9yo0rrZRug3QtcV-HiOGRsFff517JfjCZedHYV6hk2A1RmiS77fZaUdeU0-1MyUVLH4XyP9e07DU-Gl-0jLILaKoWt7zggQYhGpkWfLV_LTBQ2Ak4T5Rrm9XqzE-jT-yRdL1h-X21MQ5_j6OlwE67MuXbhD2CSIgzMcner29rfYK6KfA9vjzbzVKvvTHbVrC6f7OEEnbJ_aEYaG5MomloJd64s5WwuvoKUL3i-Yx89dnGQYNb2HT698qN8VrH-uc6c9v3xY_5GzG4FHZT3Fd8srU9lLM4D5QiAwO7uvYGbgOQFH5oaOY0qRPwfFprNm-jAaHRVBFxTNLrcfOmxJHlAAnh5en528FP763-8JWcRE-Oxsw2RUdM6S46qk', 'https://lh3.googleusercontent.com/place-photos/AG9NLjB9NUu0nNkujshKr9dBNwIDbNOhnjjixlV8NAc95NsQEywtVrtl32k07jBLV1FnA7img4oh1cx_I7mu00Rj4oeJlYFK1GHUKlGFCynP8AsMhx4LPmcaauY9YRD9yy4Uvk-S756LerBfV3th7g=s4800-w800', 4608, 3456, 'soyoung Lee', 'https://maps.google.com/maps/contrib/116110839725911201519', 0, true
from places where slug = 'saigon-square';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJU4Nmq0AvdTERUijlxbVwFQQ/photos/AWCwydhMDkzpi-HRSpdCVbCe8KNRaYI21srmAV4jOOQFYQyGebxWvTe1OMYSxxXjuyrmek-boWjhVZYGRITLo30C-z80TVucqGfSro6izw-TfLlFoKzk9QOJx85R2tu6-3QasktmrEQXuyrwym4wxcEoIVPZpslVCdJKrunGkmdNKXE3q5jN84l4CnXPor5Es8M4FL1DIgul4XUw33QPdryf48MJ78y3v58KnAn0op2E6ZEg72cb11CITR5N5lcj-pp_c3sgHaRshOQPSsMPp2Jx5hodT7Bn5OT9BG2NnoOyQ0auhTiW5rY8eDD5kkCM3h1kJGSZ15Wmv6GdOsOZX3edFpZ-paNQRkU017etXn2o116lY2UZnowJgMWtGQSnyjGuaTgEt-fj42iPYqV5tVi6w_iyeskf9x0XXHhcBJVknG2LncPN', 'https://lh3.googleusercontent.com/place-photos/AG9NLjD9u6FogXvLfX4T-S8IyFT-R4qVivoEI8x50-RhiPKgsyYQcN4xTTKD4MpV5For7yogePMAeBZU9UJDw4JiU55CXHktqaULE43ImIVVe6O49uvheaglzYgGruUFwoFgFuszkWLAE6T2fzM7OwY=s4800-w800', 4624, 3468, 'Antal dr.Joó', 'https://maps.google.com/maps/contrib/116713703535436929261', 1, false
from places where slug = 'saigon-square';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJU4Nmq0AvdTERUijlxbVwFQQ/photos/AWCwydi17nFr2iebFggg_4rXSacbWTl7vRTsGO1JRPC__6PZYC8882LFWRhfhKuKe3V-XT2T-q6clc9fuyh9hYUGc_hmFDwt7UGgEP4Cn7-pjBepUKL2JzgcODYqWP9yq_jOZlrDw_Q_AzuGOMO-6GTYxWIIHTot6_V1WvEejUWsxQLwHw-Q3FvRyqVJGhjMJQs-KVY_altKVw3dUBfzEZo3k6AiSNjtnT5iWYEiPjFHweOuJCtZnL77rIrK8sZVL8twImZ5fAhPHoQlLQIA9f3Gll2J2r8u9T2vapc9WL3rPB4KvYFWZg3KbyF5KTT8mJS8AHulmSlUalertoy4aGARTXgKhVgMaisLzufHFloIVfeSf0mVF19uvDc4leJ73OyKFJ1HY3_3bZcS4R6jZ-BqKPfiFn9TSRsTkTPICHjGAnzmMg', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAnAKBk4gZZ3Y-BefekD1FvwuKdAJxYCr_VyWNtC-rG0g4aGzuyh32063r_r8Jsm9DM4OI3hL3LeZW-bRHZ_7HRUp8pWr4-u81IxnqWTdbF_FNjoonRJI9YwH6pIP_EBNY3vayKPMb4noM1wg=s4800-w800', 3024, 4032, 'Thamara Kandabada', 'https://maps.google.com/maps/contrib/110734025912425055109', 2, false
from places where slug = 'saigon-square';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('vincom-dong-khoi', 'ChIJm5rCdkgvdTERQiGNZ2iXx9I', 'Vincom Center Đồng Khởi', 'Vincom Center Đồng Khởi', 'out', false, array['shopping']::text[],
  'Đồng Khởi, D1', 'Đồng Khởi, Q1', '72 Lê Thánh Tôn, Sài Gòn, Hồ Chí Minh 70000, Vietnam', 10.7779043, 106.7022087, 4.5, 13472,
  null, '0₫', 0, 60, 120,
  'Downtown''s glossy mall — international brands upstairs, a big food basement below; the reliable rainy-afternoon option.', 'TTTM bóng bẩy giữa trung tâm — thương hiệu quốc tế phía trên, tầng hầm ẩm thực bên dưới; lựa chọn an toàn cho chiều mưa.', '🏬', '["Monday: 10:00 AM – 10:00 PM","Tuesday: 10:00 AM – 10:00 PM","Wednesday: 10:00 AM – 10:00 PM","Thursday: 10:00 AM – 10:00 PM","Friday: 10:00 AM – 10:00 PM","Saturday: 9:30 AM – 10:00 PM","Sunday: 9:30 AM – 10:00 PM"]'::jsonb, 'https://vincom.com.vn/vincom-center-dong-khoi', '+84 975 033 288', 1, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'vincom-dong-khoi');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJm5rCdkgvdTERQiGNZ2iXx9I/photos/AWCwydiU2_2RnMreN983Oq2A6yphtyGXIfJj-ZxzKDBDRf2WCEytns89K6rIKdZtxR9Xu_TFUyjg-PEpKXvx_KykHEiZ_AtFND7ftgt1RjJjELnHDcXd5bK3Qy6DVbwzULNQ43j0x5XKvLcuk5tmFE_7H_ex5GVKzvgk5NiBFqmxvOpQhLBzOC2R2eXloS1XPCSUS4hWLsQJpsr7S2LbtlJGbxR_e3Gz4BafdjQCYLvLdvI3VWSpuuYccckfkRsVDZZpmfmsafUORqkAsSPV_4sKSOhNn9rxSgrxsqV-_EDO7Tk7EtejzENZEZAt51ntsDPO5Y52a2tiHJHoVYCHR6eFzF4qvew8BhHY-4Dqj-QgHprqUV1c8ko1DGO0_HO0S-sfe7eSApHbg5hV8xvB6kwY8_1sdd5tTgJvBpdAeiaAC_zpBQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBD5QvZTJ8V6ZTZvRUfTKg2AZqjBv3a_nwFL-TK7lnB5u6qqfp3rEdRe3FK6VWT-42Rhp7Bv4WZhxlccjBCXmRw228HPSZxfVnpdzOvvveLETkmOjkx08u-z39LuZYvjSMZ_6ytLYWE_LA-lQ=s4800-w800', 1011, 632, 'DEUK YOUNG CHOI', 'https://maps.google.com/maps/contrib/111797006812364068231', 0, true
from places where slug = 'vincom-dong-khoi';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJm5rCdkgvdTERQiGNZ2iXx9I/photos/AWCwydiME-U7yQM5WVIpQOcRS2MpHqTGA5COupMjZK30YXlYstZrcImlWehN5EFNMQKEorGWK1ERPmmGyg6OMWyI_ZkbFTyxPTNnWBe4NHk59H1uGykcUaiITAT5h6uoamUziJym1RX0pi2PC1Y8nO2nRdhENIr9W79sJR_BFxbui7cofX8CAhYB3uUbWY7X-5IzAGM3oJ1tHfbRihvyhRItVJG6UHE3xEtS4vZ1O3SDHj4DMMIzcOxWpg3WQeuL2rudkKeYhjhObRK1pPmp_WzHglRwgKAFA44gQbJq5FFmQo9SFKqxn2AEhQJajgvT1ucRCrTrrPDYcAaIHeJnbeCHLB-XbrbIbWbb9fW7DFWGNXBkD0vrigXDlvPqlqeMh1WMASzPW6JKqRHHr4YLNtLKYt7ZYhTHjQTJrk6DOWZ0Vu0wK4BJ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBgRA8dMHnwuYDdC4AH62ZBAC2uGiL9cl80S6IIGvSAX52y_7L_qzeDm2lau-YGg1UwaPdOMr0mG4sjac0R96tGSMpZmFY6yaG1b5MKMF29VPy7QvO2OXRmFLEf62HaEEzq6m8ErpTUh2PmUPE=s4800-w800', 4800, 3200, 'Vincom Center Đồng Khởi', 'https://maps.google.com/maps/contrib/105751490212776525918', 1, false
from places where slug = 'vincom-dong-khoi';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJm5rCdkgvdTERQiGNZ2iXx9I/photos/AWCwydgurCfMF7A3vS3KG_gc7szBlfMb_VBOiUvZmVR7TPuCfWB6WgBptSOfdwc8jEaHAEXw7LA7f_RtjDvZT5NM5EX-QPvYL_62q2WPp-h_16iVcpfGigNozhUL8CsoUjbf-z-G-je7pD2SzC39xDpmHZPwTyJDLByyUPE9N8mjOFdpClZI_dv1I6LGcVO7VK787Wc4jhKLSQYnEdKy7zIMObsRfX1VPXvfc-VubRNSRot2zPc2ZGcikjzapEbIvObXAiU5E2pvrAZupNihiR5WVzxTqm5-AY_eS0c3UjZAO9JzaPHkDGCFYSPlEDU1vgeKUMnWZgbJX_-9Kpn9PhXJTewVXWbkORaEEyeAjr_M2xenXHnIh5Sl6N8kec6vWwAqrQkQsILhAEUmw6HHP_fSqON1K5W6Wu-Ecxio0kjzJ6bhkctMJhtmQQp3YXVsCw5W', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAHkTuliBWfnqLSbWcMGIN9AbNushKhKi5zyxYxvEP_GELKqr7vZb1-SbHpDrePKi6ZtVj6OOdQL0TcU-kF9AMDL3be7QTArbvzBM_Cjh-XAkkF9-xPtkJLBNOQapUi6g_iNtg_lMJwzjC1R1hLiMZp-w=s4800-w800', 4032, 3024, 'Всеволод Т', 'https://maps.google.com/maps/contrib/115338445120156477065', 2, false
from places where slug = 'vincom-dong-khoi';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('takashimaya', 'ChIJcxmJ8mzs8Q4Rpyi4KEspLc4', 'Takashimaya (Saigon Centre)', 'Takashimaya (Saigon Centre)', 'out', false, array['shopping']::text[],
  'Lê Lợi, D1', 'Lê Lợi, Q1', '92 - 94 Nam Kỳ Khởi Nghĩa, Sài Gòn, Hồ Chí Minh 70000, Vietnam', 10.772982899999999, 106.70066999999999, 4.4, 192,
  null, '0₫', 0, 60, 120,
  'Japanese department store polish on Lê Lợi — the basement food hall is a destination in itself.', 'Bách hoá chuẩn Nhật trên Lê Lợi — riêng khu ẩm thực tầng hầm đã đáng một chuyến ghé.', '🎁', '["Monday: 9:30 AM – 9:30 PM","Tuesday: 9:30 AM – 9:30 PM","Wednesday: 9:30 AM – 9:30 PM","Thursday: 9:30 AM – 9:30 PM","Friday: 9:30 AM – 10:00 PM","Saturday: 9:30 AM – 10:00 PM","Sunday: 9:30 AM – 10:00 PM"]'::jsonb, 'https://takashimaya-vn.com/', '+84 28 3821 1819', 1, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'takashimaya');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJcxmJ8mzs8Q4Rpyi4KEspLc4/photos/AWCwydgiFHCJ68thBOxkswzvriYRFgzdG9bQXw6EMqjRhELPUU9ppr9NHk0Il16u9ARs353QHhhZz0YJCiZOXv2H8kVZ-QljDt5cJsZB-kYJz3OBGBg8TcY5Xn5BijrbHYyKcgneZiDsIfFH9CdfVeT_vI55WWzDQdiT4qRHVfVC2Sh8-vd2rPc__VWIapXI88J604FgCEQP_vBX3DhrmWupqhJDj5Jgtme0I9jYwLguMoTSFKVcaogOi4GVn9m_jaj_hbKMGakHjFg5QZ-XCRsLxL8i4qFPM_hLLWXP9nAC4GjYHxHcVjA_SOHPK7xQxvh2cn69sPXnrgw8tToLf16YKcWerN0YcZ83Cw2g6FCQ3GEPpnJc_aUX12uTkUBIiyfXsna-aaNnifgNdJGBu9FHyOyyGK-gFOEgct9XITWmrJZjLjmTYVGMArMTjuqfaQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDJwBkyh87Idkm0J0SY1Ux4Q-gudche9M_tz54TozeSULQL3AVTjrui4eLCodaJptb3aeMi0f-DiQhmo8qSXtIpTzfzwqtlDyg4w9IIo0C2MluKvA_eaa9kQzh0GUeJfHf-H-hiLzjPy5rxA1c3pJ3A=s4800-w800', 4800, 3200, 'Takashimaya (Ho Chi Minh City Takashimaya Department Store)', 'https://maps.google.com/maps/contrib/117331852131316554826', 0, true
from places where slug = 'takashimaya';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJcxmJ8mzs8Q4Rpyi4KEspLc4/photos/AWCwydjnvb5_TtTUe3VzGOP43MTCa9_fSzj-D8LVXxwe1fbLsh-oGVjc4Jw1e_OoiKp1-wo9nUPtQXD1JVswnKKLr0LjJwP-uvMO-MPO4e2iQAVRlZVUs3WXjqLuUuFyOOWKXdb7drmyO9FIc_8mtNdIoAfC4vvxWOeBrjpFuskCNyUcDJ36nYD5Lu11k6mPzkQgZdX8DgQ72zjBAmKgy-A82KzqJfI0JCjt0upBY9HYpTVVZ_0SQ44oQj_K-Fcws2PImJQLWhPdJK7nyC9SlPZPeL31s5FujLe_NbacEw8BzbwuVv2eLAypdTH5xgNC-GzFJD4WUGUf6rA6Xdzm-3muznxSAqUrAqDatK2oPfaOHy83Y-X9x4gd9_0eBE4vz-toB7oDMv1CgpLm-L3u0xhuEt25A-4JGjNeurImBBG-BFuhbOyNutu2nTIPpvdqfgPz', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCj0Z4rHUUObZiGcq_FZK8vA7fDQw4gIvbDtC1AZZTHormYiDxvbHVkc8hw_d2xe-I-sKVS8i7EFARrjVFMAuwsFQmQVXs01Py9anuJrnsBFOmRvQyclx2T60Y1jtyyhP_PGWJwr5emhmkqDDbmg1QRBA=s4800-w800', 4800, 3600, 'Thuy Nguyen', 'https://maps.google.com/maps/contrib/110825430725218340140', 1, false
from places where slug = 'takashimaya';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJcxmJ8mzs8Q4Rpyi4KEspLc4/photos/AWCwydgeDARO8ptPInqLSbPb6gHEmZShK8haBod_LF8t6jmasaA1wV_mgSCH8Xfu5-IuGZZNxh32nAg2a6S3W_wY9EtiebLzwd4_4vFbv1deQcu5S5m3FcXdMPCC2F9P-SBOKg1VbtzObWp28r-MzWTbGabLcL4ScgBHMdlNBjls9VCVHTMP_Foq3kOa4QWsqw97t4DiasgEsUVLOPR7L_oZA8wX2Ud4yS1hBEiTVu_8oFE-4W4I4ayq09iHbfs9jVhkMCyiJx1TaxiRbDAVLR6t6wqm0btSXAG7V9ZrFXQMPwkK1rwCzGh1bQDsluNnj15FKggZGDCp6gFA02yYQLJ7JbGCAyoWebLyYsomMzsWp4tlOQvK4Tg_-Y7ds-55GtnPePad2GHd7if1bND43BMgMTMFAru19w4N4E9p9XffxnhbJ9R4qDtMdMLt6j0PmQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjD-QpK8oTBV9pvpAbL9RzSqy1m1UQQJf3_5cEYHyqyDaexxDZODuzFPYvS71c5vCydvPgQgjFytYWiSKV719Pwb9aq2pjoUO_pUUwmi-8FrLoYbycMKOhAfyJ_qK1AHrsbA5u0YYvNPP_oMAoxXKuMx=s4800-w800', 4000, 3000, 'TRUNG HIẾU TRẦN', 'https://maps.google.com/maps/contrib/103990228510062884101', 2, false
from places where slug = 'takashimaya';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('the-new-playground', 'ChIJwbgPCkgvdTERr8CnqMwa3co', 'The New Playground', 'The New Playground', 'out', false, array['shopping']::text[],
  'Lý Tự Trọng, D1', 'Lý Tự Trọng, Q1', '26 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 700000, Vietnam', 10.7782185, 106.701092, 4.3, 1701,
  null, '0₫', 0, 45, 90,
  'Underground mall of local streetwear brands — where young Saigon shops; come for the fits, stay for the people-watching.', 'Khu mua sắm dưới lòng đất của các brand streetwear Việt — giới trẻ Sài Gòn tụ hội; đến vì đồ, ở lại vì không khí.', '🧢', '["Monday: 10:00 AM – 9:00 PM","Tuesday: 10:00 AM – 9:00 PM","Wednesday: 10:00 AM – 9:00 PM","Thursday: 10:00 AM – 9:00 PM","Friday: 10:00 AM – 10:00 PM","Saturday: 10:00 AM – 10:00 PM","Sunday: 10:00 AM – 10:00 PM"]'::jsonb, 'https://vi-vn.facebook.com/Thenewplayground.vn', null, 3, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'the-new-playground');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJwbgPCkgvdTERr8CnqMwa3co/photos/AWCwydh5sE8QciayC0ugvoY4cuG-WCfl8mF2SGYq9ZLeXNMxpQavq5jOhJHXcickRcwyU0Ti3l_endUJ_n4nroU-Gj8kbQTOWaWxxVHfHi6GNDl-09XL0BAWuxpacGxKh88U4r9npADZnzHGwVG5BHnrIf12N5nVUciPvlTJ15zRIvRUakTS0lJwV_swexRchQPfZIGZHCBkl3eOKDc6e-MhuVZeYRU2pfp-Udo1_5tjG272tK6pQ8hqTOWAW5sLK-Gg0eTA38ig5e923yYKjOZT39Kujcf5EKNda09ojKZrR0RTCDDQPcqGf3VK_lHU4Z7X9s9TWRqZGmAjd6MucArHG6OutFnKdHw-OknNg8metTERehDK-m0OwnVLhH-PxRuyMOd-8OBwe1f8IDvc8A_fCZtNROrrmCLNUSnoXrIMIDUhiA', 'https://lh3.googleusercontent.com/place-photos/AG9NLjD64qQsVuj_22iRmgjS00Zz-4kAvKqUtCAx-cpMK_XyHCxwNIRS_bSZwFyQvHrsx-R_MaLPp5tOst6X7jAHHIwvszjewoOOy-HdyvJu_ozDa8WJOtgW_GvZbmfkOzOfu7xF20pV4ZyZ18rjig=s4800-w800', 2448, 3264, 'Andrey Solncev', 'https://maps.google.com/maps/contrib/113391204690213466392', 0, true
from places where slug = 'the-new-playground';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJwbgPCkgvdTERr8CnqMwa3co/photos/AWCwydguLF2L3kWWmpqbMINa6gMQWAoB0Gs6Rl76LfZrJGdnG0oIEg4CwvgcsHcXN5ewItCFg1DWPdVSr8pw1m3T7Rqm5zYqkWSDcvEqNB1x18wZXS-7Ge3I9rYitBlNmjUCEtfTlhOk1pk3JbQUbyEXM6XpYU8eGiJ91OEAXBRQMUzv5CKv_zC-lCtmqCqv7WrNJvB2xCG7OiSwPBJDIC7_YCtCyHB-pj5AAdHAGjlCGXhI0UgeztN5Iuy_UoV_jxlNXMXxzbd-h8rIpWOEmE01erFPvpebYz-8WqQeg3onAeu5V-9aNUQmLRrHXW3sXgbU7chMdNrodjSItQXM-1I0H8CaGl2T_rVZoOV13sygeoGsBxrtXZHW_LfGi2BY4csHezmbrLQKAgJf59KPwm36kYlZjwJjT9CDEM8jZ0Bdu20UbcCU3Y91onyd75uLC58B', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAR1Va9PLZlpuMCQryf0iCFxoEB2-BdUPHS5hDdRKKxzlYTSoTTel5fnT_SriDqJhZrZXwJV8SS-P9-mP-N2QBVEVo3okxxwqjgkKvBP9-OSb-WzYUyFNm_T5WTuQRCKqxL7fPAYB4639-qw0nE5-vYWw=s4800-w800', 4032, 3024, 'Ade Ardianta', 'https://maps.google.com/maps/contrib/101216190995275824854', 1, false
from places where slug = 'the-new-playground';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJwbgPCkgvdTERr8CnqMwa3co/photos/AWCwydicR5GiYQjAjx7ssTqLxz9XSQTHuDcNVdwfI5I-5Me25e4KGG2HBuBecbHkJdCG7GTFYpRGLW7Qy4gdqsxhpnes79UFoJYv8skA5zqHineOu89FJbjpuC6DJJMblw0jgdf2pNvlquxs9vgVsVMELYKidgEL9bSMUOoE1xfZD7M0szIXJokHKRGkBa-ofDTZsowagE9T4hyAdrWjas80RV0ztR6hHyG63VoqdkI2cT5UhO49maSyPc_rgnqZUnjPW7FZQt8rUN-RuCf_mkqN2bfEkyzSFIHStBF4zldIpO3EDeLsCiUbF8XN01IILQ7MWDzBCN6Qg7lstUiP2jdZyOS2i5hghzHlRwazq7SB00z26DH92acWbTbct2HvUWCy5Ic6uVic5mkodJhincS7CnzEYIqeBw7gXiIu8GQscE9LMw', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAwZntC4T276bWFHQgKYVnJH53K4qyUNuXTNxmcTGokak_D68B9MWSGRJwTh7_HNdKhXSfxR_EMdQOJs-Q8BhKbawj3298Exzq7IMrfoyhB4QqltOIDgSCSpBcCj4cQSFuQmee4WId6JLMULA=s4800-w800', 2268, 4032, 'Paintlim', 'https://maps.google.com/maps/contrib/112625441383353319899', 2, false
from places where slug = 'the-new-playground';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('an-dong-market', 'ChIJgWWpaeMudTERW4UyjBZPJ4I', 'An Đông Market', 'Chợ An Đông', 'out', false, array['shopping','food_tour']::text[],
  'District 5', 'Quận 5', '34-36 An Dương Vương, An Đông, Hồ Chí Minh 700000, Vietnam', 10.7581989, 106.6722817, 4.1, 10509,
  null, '0₫', 0, 60, 90,
  'Chợ Lớn''s wholesale fabric and fashion market with a serious food floor — less touristy than Bến Thành, better prices.', 'Chợ sỉ vải vóc và thời trang của Chợ Lớn với tầng ẩm thực đáng nể — ít khách du lịch hơn Bến Thành, giá mềm hơn.', '🧵', '["Monday: 6:00 AM – 6:00 PM","Tuesday: 6:00 AM – 6:00 PM","Wednesday: 6:00 AM – 6:00 PM","Thursday: 6:00 AM – 6:00 PM","Friday: 6:00 AM – 6:00 PM","Saturday: 6:00 AM – 6:00 PM","Sunday: 6:00 AM – 6:00 PM"]'::jsonb, 'https://www.tiktok.com/@longbanquet?_r=1&_t=ZS-97bOpzSX7jd', null, 1, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'an-dong-market');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJgWWpaeMudTERW4UyjBZPJ4I/photos/AWCwydjMAf2b272fqtCgH_Vy6vLc5mzV1ylHixaEZeQnR65vGyOeNWjuxhbAYVujnSxhdutvCh9_UCG2JDmdD9D2mGBCDXiKj0Q94gOvg8iW_7sWf60PHPMjUjqcbHSHxmXINZln3XTkHasCuwPnE3rCQGjMYdn828c6cmi1_fJYyeMgmq1wWzWjSWDyqoIpVmIymXIFUgU3wTCFZz5dOXtKMMg0vCrKADxUXQTEx4lts0q8nid97YkvnVcm8sqUSQkAg-nOKk5UpQHdrfMOs49i1C9HMRGVo07fWDMNeGrir3c3hFr9mybCT93aHN2jX4EorTk9MOSzdrSPItMtvh0BxgEHRRPSCJmz2WMrO1z6gfoWYfbF7awL77sJVfOjEbq_7txOi7-8lUIT4yCsTX8zo_GEMO1r2UhMw-bvclJ1rrvY7gE', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCTr4kcqTfVCjiWdhBuy8rj0zuSF8P70U6aS7DYUHYmt-Bjfof55me_oemYQHX-7qnkgofbl3nrXh3f8vSGtcvDu3tVg9EEtvR1cucrnj4uKkk8RjnTU4BscaP9fx31mQXazojS1jz6SKlGzQ=s4800-w800', 4032, 3024, 'Sorphalla Sean', 'https://maps.google.com/maps/contrib/108522475373420743460', 0, true
from places where slug = 'an-dong-market';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJgWWpaeMudTERW4UyjBZPJ4I/photos/AWCwydiYcB1LCVpvE3dIPXHjsPlMJrMt1avoqFLNzgfTw5nyv5ZTDTB_7ZzC-KG8uMeljPoEJoMG2m8R_s2qNZKMp-vI1HnalfHbDximguC7c7AVn_XLmtaGervOGHriBcGgCPbI_72rGA7wztoAQnybLSyWc2V35gorPNkjgwViXESir-N4A2b5vBN5q6qrXGHnjxIjlppHVdLJRzAmWQXzZ3xalmx4w7rps_LYFVaB7mz5cf20hCdG2P-cgVus3emQ5vKikgYSV-ZMRZRhXrgQcYaWaGKTLMCxav8NsE09KE0-KZpfPW01GNw3EPfh6TkSfN0FRPDd0ZHps8-KStkR6IuXSl-9bxt_9ylAXeuaSfpcgZlkOIAT0m8AGftxXUKa9KbaEmn4mDz_pdeQVjmLqCKvtlaRyovSuVU6zNJJ_2PdMDzl', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCY5k89xU7kvlt23mUhV_ZfAeaHJgBFuyZXOOW1B0kfty95EKmljDhX0eTgPjeCzd92MM63gvrgUsbq3foBAhBYZqbFlPej7VfCg2NCvsR8ddwIwgJ_DJlWbZtTXCJqObFs30XiEqxlXPcv9AI=s4800-w700', 700, 394, 'Chợ An Đông', 'https://maps.google.com/maps/contrib/103363236923791174818', 1, false
from places where slug = 'an-dong-market';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJgWWpaeMudTERW4UyjBZPJ4I/photos/AWCwydik-fR6YD3owgTwwdBICg3lR_OKtipcsgEFgg3GhjX_o1RztsBxvYwhf_AkB7Qzz0MHpEcoXewjIy5r1Z4xOl3Lqh6J-DElKlVcKXvtiqMGFWud6zzTsvAVq73_F9dUVP-71Didf5g1qE-lXdrehhnWxsIy9JIL3X_cbfOc2VE-Zw3dqbpw_yHlgrTTIW4QxYvMFross_qp_LNuHYQ5NO65yweBOBg89vRDByX13ysm0pD9dfK6HoVBWG6tbWYQFeP4dUxs_3X3E2HL3ZAmDxV1CNa7bZhdUw_339WNL2fBHNEtwjfbp3z0LdkzbnoLbXwCRODm7-D4i0F8PRut-RRtO3KqWFFc2CLlwvMv1z_qHEKLVBkSADrARXT9GaRVLRnizA_YAt-0zdzj3RV5eMhmMnoIto0-pXGTKuaO2w7OLZ8X2hhn2hngZQgiDLi-', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDwDmOkRKddlhZX3jZW2CIO1_L0d7ia9Gvs8wF9P8cBIJaDDdYSB8yuqxGPzhhF8Q66hadzlbPaZlVaRivjzYq0WP13kN5RqPWAhXLYrrbyw8573oJeJH6z0BfkdSRwr55Kjv7lvrRDZEq4L-J0uW4tjw=s4800-w800', 4800, 3600, '鄧Kevin', 'https://maps.google.com/maps/contrib/109960124253288979933', 2, false
from places where slug = 'an-dong-market';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('bui-vien-walking-street', 'ChIJCdzLBRYvdTERpsMyNScNwPE', 'Bùi Viện Walking Street', 'Phố đi bộ Bùi Viện', 'food', true, array['nightlife']::text[],
  'Phạm Ngũ Lão, D1', 'Phạm Ngũ Lão, Q1', 'Bùi Viện Phạm Ngũ Lão, phường, Bến Thành, Hồ Chí Minh, Vietnam', 10.767351000000001, 106.69388359999999, 4.3, 26920,
  null, '150k₫', 150000, 120, 180,
  'Neon, bass and street beer chairs — chaotic, loud, and exactly what some nights need. Weekends peak after 22:00.', 'Đèn neon, tiếng bass và ghế bia vỉa hè — ồn ào, hỗn loạn, và đúng chất cho những đêm cần ''quẩy''. Cuối tuần đông nhất sau 22h.', '🍻', '["Monday: Open 24 hours","Tuesday: Open 24 hours","Wednesday: Open 24 hours","Thursday: Open 24 hours","Friday: Open 24 hours","Saturday: Open 24 hours","Sunday: Open 24 hours"]'::jsonb, 'https://expresstickets.shop/ho-chi-minh-travel/', null, 4, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'bui-vien-walking-street');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJCdzLBRYvdTERpsMyNScNwPE/photos/AWCwydg7aOAzb9h5d5BTlV9ZA2JD52eQ9jOtGfiDeRPY7BEywkMCPCBAu91obGKKQ0S3sF8TIhsvk884BYHcqCMsrf5xfDLUv9-zIzD-TwYboRuDaoF6za2wlgT4M8GRB_KCw7CjItR-bxXPqeFBtcNLFcENFGahd6pHGsFFikP7NEWPOqNGGGb9rX6Wy7tYCiyQN953zKj6esTzn1vs50YvG5nUCut1aAe4_u0bgNOyIR2rVwjPaacFxN5rjKDEn8Zm6tztMA5S-7tpHwYUmUcD7IrVgLRAL37Vk19HysFLAJvL6CQ1GswK3R6-PWwvUedfF81N2M-Wd20p8gOz6tKnVazmobxKDxk0Ag0X7RVXSvECwaxwgTj6WmbBkV4TjGSFe5hvvf1g_D8_iJMMUurR6wiyth0hUNsiJRuLWSWJ2qkD_A', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDS2eKPgdUsPwvRXn0QjdjDM8CwZsa1rvMnLt5B5WJvoUeHDQvTwmqDv4-UcwQSb_e791QlgFMXRGPqLwtebAQ6CpE2IOkkdmuJcYSJv5u6Qe9o_bglVhFJvNGoPjm1eJWJUXMCOmlXqTdxFA=s4800-w800', 960, 639, 'Cường Lê', 'https://maps.google.com/maps/contrib/109839143565563769791', 0, true
from places where slug = 'bui-vien-walking-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJCdzLBRYvdTERpsMyNScNwPE/photos/AWCwydiSmZQLbumCwYZv15lU-Cf-RmR0Y-l_bFkfvdgsZaVi1uZIpBzD6ysTYKWdsoQ16nqDpoHGwVKGqjVmVZ0baBC1x5Dz6L1wswiwPYWkihtNjr2RWthNlDECLEBUKR1wfxCuOEuTcJqPgBYW45PwqCiELdPaG1pGmD0GmDdNotIpeaFfIdPLshtFrD_vo-k0EzhSaTE6rqBkqCUQjlEZTCTPZDS27lG6WK4ZbV8Nk1d6IP4dDcINyKVTZ8yL0-IQ7p_xO1D_fXvVL92wwCwwMZgS_AW5NIAuQwfP7L6VD1wzsj32q2PN1L3_kP515iShL_BZYDQh6r_bn6h_4mX9ub8DXIfTpG8B8vcQ8UgeN0xHLWiDq0qfOAcEN-tbfkqIDy8e840HvRM7OwSEASwzz0fruptPnDygi0FP_VNAJqOaQy0osg9eEAiSTQ7aXQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDr7vHWKVN6Cp16QxNL3Pv-4PAenUrs-byiLo7BZyLUg5wXqBK9gaFzLsKvGVRJE0ZJw1gpxFmSkFJL8SnUJ7h6Lf8SRQ7Xj7aXIqktolOlOxbUsR2d2yTfqLH1flAORN5dYrmPtGB75A9dZ1a5LoMm=s4800-w800', 4000, 3000, 'Phu Nguyenvan', 'https://maps.google.com/maps/contrib/108228788646108906575', 1, false
from places where slug = 'bui-vien-walking-street';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJCdzLBRYvdTERpsMyNScNwPE/photos/AWCwydgF-AGQPmtKNU7j3OjVcr3DNts7VZHuXI78wpteUCdjkf1ySOsUpKi61aLX1_-FgxwTgIn0kP-SpTvl2IfNY62I3bUMwhYRitNY3pxgWIIzpdqNgzYBaxYGBjqME0kpqMQUG7OhcG4Cgtqeuf5IIgZcXsyuRzj4HcSwS5KNAXY8kQ6Wa7ksrzXnJUkMDI4tI6Ce-T0bS_fCfn5XWVSVNGFHbliM9QsHEa07kl4JXOYP1NooqLBSTYFIWj8uHcPEzmdOXAZSgbgZXxi5ZrILM2SExgNqr-O7qDf5ICfV4hH52hWrChB7PjaSnFKXOqEzLYDer_U_cS8Ef_IVWrkMBTXUTh8NG-Xo4BTLukKnOXEKz_-DmsCGtLH3WeCxVislBRlGqkVqUtyMzyiDjW2RsAvlv6rzP6mZHTD3ZNOmJOF7-L13XVeqRoJWVHAEQA', 'https://lh3.googleusercontent.com/place-photos/AG9NLjB1asqsSUeYN_0Z42TnFY7acc3StHxNaZStaSZGXRVzx_l6QpJXuiH8CxGhlXDrgxiZnfJ9lsjeiYRaW8TkPMGzXdOR-UOf7iLzGBi_9yjpes1BC7PWDwSI52jWdDuNj2L0nvvwHtOX-39u7qXhT7JE=s4800-w800', 4000, 3000, 'Peter Holroyd', 'https://maps.google.com/maps/contrib/114220226898873699275', 2, false
from places where slug = 'bui-vien-walking-street';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('acoustic-bar', 'ChIJjUR5AzAvdTERdF8TduasR3w', 'Acoustic Bar', 'Acoustic Bar', 'food', false, array['nightlife']::text[],
  'Ngô Thời Nhiệm, D3', 'Ngô Thời Nhiệm, Q3', 'Ngô Thời Nhiệm/6E Võ Thị Sáu, Xuân Hòa, Hồ Chí Minh 72407, Vietnam', 10.7811947, 106.6899157, 4.5, 3426,
  'PRICE_LEVEL_MODERATE', '150k₫', 150000, 120, 180,
  'Saigon''s best-loved live music room — local bands covering everything from V-pop to rock; arrive by 20:30 for a table.', 'Phòng nhạc sống được yêu thích nhất Sài Gòn — ban nhạc chơi từ V-pop đến rock; đến trước 20:30 mới có bàn.', '🎸', '["Monday: 7:00 PM – 12:00 AM","Tuesday: 7:00 PM – 12:00 AM","Wednesday: 7:00 PM – 12:00 AM","Thursday: 7:00 PM – 12:00 AM","Friday: 7:00 PM – 12:00 AM","Saturday: 7:00 PM – 12:00 AM","Sunday: 7:00 PM – 12:00 AM"]'::jsonb, 'http://facebook.com/acousticbarngothoinhiem', '+84 816 777 773', 3, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'acoustic-bar');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJjUR5AzAvdTERdF8TduasR3w/photos/AWCwydjL5HFD6jDhOGAmeAaGjEQYzR2niPt97BXIi1TmucdNHof7zR-C4VLg-QH8yzI1gesPl77N4WqJb0deJHwmFEQyO2mvRZHqg1BaboABs4yx9mrEaKsMVeObklVx-rRtEhx3xE9OfCfHzCheAOIYFIJvRr0gR4uO2Fl01qd4YojqB7KqXVl8aYm8IeK0J4Sd6cDgGZeAnOR2Yu_aXBt9eq60wtQ-H9q1q6cEX8USwZOS8tl95ucUtk8vb-tDh20msv7cfxM3SxNgbytnk6nZKAqA7ZqET2x1Ld9rDcD5JMzm9wIV7O0KHexvZQ8-i9qY4BbvwUvSjHcaxfKHswqZkL-9XxUJikAbbI2zX7WDC1DVs3dUWX4QFPdvf8txLouNgvk4ga4E1CtW3JM0xmVyJmOVYk0mtyWJ0a3jypQ81Vi-Mw', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBCgTBcygJQlcMi8KrArINrhgQX6XWcKKr-Q507KrvOpFB801OpLYeyXcQAYcY6OfvnkaGxpxFgyHAK923LAMwI3KqeIWUmYWiNZyuQH6C3ukVpxlASwbQ4_mL1z6jsx52HMwZcA0SxIzlYbQ=s4800-w800', 4032, 3024, 'Hidetoshi Koizumi', 'https://maps.google.com/maps/contrib/111387759349662810071', 0, true
from places where slug = 'acoustic-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJjUR5AzAvdTERdF8TduasR3w/photos/AWCwydhO6NdDr6I2QwJJSyNj6ClrSMJLfKVzNsHBIoTEE_asivseBlhvTwuudLatE5xOxMLkKBrHYeg69l7wtwpNLsbSURsd0Xjnx3abKa56XNgauOChfG7MmQIj0zXHUuiNkK9ubkRc9D8fv2MG7YYiSuRfR2rZj01Npg_3OpI9HYMd-qIQNsEGus4LL8rPe3TaaqJRx2fKH7pVTaKLINZT4sX5A1Lkl7zsvqu0C79WXZ-_nJ2H1d4InXlcT55Tyk3khTnANan0CVxFxBi7_5b2t_IzhwtzZuLbfIk3ArFkti90cs9RzYsDlMTAiafsJXrl9x5rtLx5mYtuxomRO9ucphlbkSZjS6gIhPwiVZwWH96RY2rKhZpC8mUjkOuo_ApzFIjZ8lVqm0zyf2j1fLUzm4p6A7GFOmLbLeGfPET8Y8yTQv02jL_uk36NZNhkJ6TQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCZ3JLdqZgIu3_yvdb-MxRJqG0f6muG8wuTpUtnYPC5-Jf4YSXjE23WP3SEUH9yOLg5jceHPiN0UH9wck8BenYfE1Sae3MWXcUQZ_zyn4-kRP2Rn4dVaNpt7RaYRQ_1wYc21Sx2dyqbmZ4UDeaN2VKgLQ=s4800-w800', 4800, 3600, 'Joss Le', 'https://maps.google.com/maps/contrib/113765792221098152599', 1, false
from places where slug = 'acoustic-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJjUR5AzAvdTERdF8TduasR3w/photos/AWCwydgY25OU-TsXssjNlMXT_K70yEJMlkgzCX36Jctnukr0GWtJyfKl8qn8QYcXOgQiS-fsNhzf51JT7bCMd6UXvLz5CpPzGv1FCHs8CKRRmFm3apO-yfVlTtz-UCXv6EFUI_jZfgaPZztYMfS8TkR4gMamBZ2JEAijgeqSDIxbbQOTVXduCDDVvowERTBOvgUW91j38yAYy65aiJZ8wNSOGtJ6_FaqWDG3CfddbbT_7gZdPU3VYPpfKdpexPkS2lE9f2YHPgdk7alGmaHIPHiQmNvUBgRzKi2X_sLYS-Gqsm_Obf5nsD393XCYe9yxt1BWD-GshpS__m1XRkjn1jtAW9S0XMtTTPhz5tk12jxUef8V1cIFBWq95274EmbrmfZB5HU5jqPezgbuBorVsS3aqgY0kTCxBMs9hgVd6HbFMEU6VUSISX-Yn1j4lTWcCaUI', 'https://lh3.googleusercontent.com/place-photos/AG9NLjBqHIzPzHb1nfevHE849HvEzEi57U9F-Y0SmU2gFiZlmR0M1ZPPBWyi-6i-iwSH3qxpOowAXZSc59jWzC0Z-Gm7eeTIp5JIlqMZ9o-GcGod1iXAvPVsBr-PVQdUqN0yXit_CM9fsdC03hoVAXSISs3xdQ=s4800-w800', 4080, 2834, 'Viet Hoang', 'https://maps.google.com/maps/contrib/112876013197567789250', 2, false
from places where slug = 'acoustic-bar';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('broma-not-a-bar', 'ChIJxSLFs0YvdTERKOc0qdOtYrw', 'Broma: Not A Bar', 'Broma: Not A Bar', 'food', false, array['nightlife','views']::text[],
  'Nguyễn Huệ, D1', 'Nguyễn Huệ, Q1', '41 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh, Vietnam', 10.7727302, 106.7046106, 4.3, 348,
  'PRICE_LEVEL_MODERATE', '200k₫', 200000, 90, 150,
  'Grungy rooftop over Nguyễn Huệ with craft cocktails and DJ sets — watch the walking street buzz from above.', 'Rooftop bụi bặm nhìn xuống Nguyễn Huệ với cocktail thủ công và DJ — ngắm phố đi bộ nhộn nhịp từ trên cao.', '🌃', null, null, '+84 325 203 217', 2, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'broma-not-a-bar');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxSLFs0YvdTERKOc0qdOtYrw/photos/AWCwydhHj52gAw6_uUumqIZQMYYRRFOpt8sODnbQ2yCFDhiOfyQmsdZCR_9FVpK2-W0d6jT29kyVrk9EU8HodGfgXCPrsdqDGJ4R5FgnIEH4zlRhMkDpByYoua3pJhr8BbKV7x5xgE90hcOqerSTOsb21iVpO7cfITnDex04n6Obfg2fqodhhhKvORhmLwguzldXz4cNmpvUo9FxU_Hv4h65wTVIHrQJe9vbYoHWCScUWeihtpWRxQSBirwMCNR4cyaRoPglHinXinKpOKPqkLDk7mJb_ZLlbdTkNVOmdpFXGMc_C8HWILyV0dsjupA_tiw_zqvWWNa_PYYrW_Fxos0-C7yJrz7Itn-s-MgBPBF-8izUDaAsugmgoCM9_k1vUCNZlLfXJKMzQpEEXpBlsXECi6eQuislNWWjB1TNJIKTt6eEzQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjB9ka7vM2CWTtBcHOYmQmac1pWIhkZ3uU-zCvSUKEuxZXRABBiHDqx8aXK-dLlXFFD3AwnZG8WnzfUskplTyCCaSXwxqgdHNWsrcXcvwMM5bFPItF0Lzm06InTk7HyBdxqeE4CiSnO9_xg4LA=s4800-w800', 800, 533, 'Elegant Team', 'https://maps.google.com/maps/contrib/105136298221765102179', 0, true
from places where slug = 'broma-not-a-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxSLFs0YvdTERKOc0qdOtYrw/photos/AWCwydhfi8xQoQnJXSJxLPUNid0AFMFoANHJpLH49qNK3dYQ8BIi7f7WVynrzFT1_AeHgeAh1XlxtkLqThGJdc0zj0AD7tjKlPgkP6ij1Mbm_ENkH5PLcfth0VeCHT67WnEyptLVJ1BqLUZU1IgOHZtFs-HZH2mvB4wtRpuXiNmmW0xlSdAmEZlI9WA06Jt9CFtD0pFkVcbNdFWwmiv--oMxkk89PkoA0GzlVD145ZKSubyC9lVA7wj2J2p07c4kbk-8XhaHKUphZgnkeHYEzs6tHPG8VMVzEp66Lfrdi8AJmjieNLh-Gb69JN_nP_l3S4uy6y9MdnjsQcy1Zq_NK931a1X0ypM1WKPf9rgsfrF9xA6e66dotgH5q_-AyEqWua3SX-ILZkL-6cES_YlCpOuhOTMWY_ktR-uPEW38JUi03iI', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDrWdq6xe1VTla0KqXhP6z2ZN2ctt367Kay95BCEjzwh1XDBHkG9_oegK6uKkUtxItXnnTp9TpUfIGxwNbey73KYYZca6n6a21aPC3nWgw8CeEceVs8x6ENZmlhTN-QPsIoUsM46ANaweBB=s4800-w800', 1152, 2048, 'Not A Bar Kitchen & Bar', 'https://maps.google.com/maps/contrib/108807029419735558491', 1, false
from places where slug = 'broma-not-a-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxSLFs0YvdTERKOc0qdOtYrw/photos/AWCwydi991w8Ej-O9DhH3keaIKocOrcQ9tGWS3qTZmcYqpfKolqv1aPzr1aYUN9FaXxLQDClxcMMl-FNcMPwh4BWtpx6KhCVTJh2X79lbvOiVH8hm_bkaX6roOPq5VOadfDHs1RFZ8a_v7wy8Qdxuv4ww7CMXCYDqqdH3jlMgGOKO06A_njr5fvtzWOpFdseksBNuIMSXcy1ejgBzQ3fDr7u0EmHW3v48B_npk7BAuZXjp5SLsbiP93fL777zT7HND5-7wQyzELAlDT6akCDs_V_mYUgjhP0xhVIN6jfFyLXLvxl0QoXM7NnGcTT6BF2lMwK1uUeJwcUHD_9nTx0wWaLOIHFh7Nbm2NKI9rXLpDJk-uYuzT8APiH55OQnFWbUtvO3xwUY1xhk9PXNhQPwXJgX7AoDipamNnudtzRzsdDhqa6mrsy44Kiqco4PtXSqRJg', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCL_MaTMBclcDUimTMgom6YDeNAEZl0Kpc3A04T0iJllXOo_ZDIe_hCObTMQGvRLYSCxXg_QECVZWaGC2grKswje7reC_r83e0qTACo6t-hxl5o76-kep29MC1FugXIeHuXLKXxzohERbeLSs3fW_OZCA=s4800-w800', 3600, 4800, 'M. ZGN', 'https://maps.google.com/maps/contrib/106746960187710257477', 2, false
from places where slug = 'broma-not-a-bar';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('carmen-bar', 'ChIJxYy5RkkvdTERLuTCr74_4xI', 'Carmen Bar', 'Carmen Bar', 'food', false, array['nightlife']::text[],
  'Lý Tự Trọng, D1', 'Lý Tự Trọng, Q1', '8 Lý Tự Trọng, Sài Gòn, Hồ Chí Minh 700000, Vietnam', 10.782286700000002, 106.70473539999999, 4.3, 1055,
  null, '200k₫', 200000, 120, 180,
  'Cave-like cellar with live flamenco, Latin and Vietnamese classics every night — an old-school Saigon institution.', 'Hầm rượu như hang động với flamenco, nhạc Latin và tình ca Việt mỗi đêm — một ''định chế'' Sài Gòn xưa.', '💃', '["Monday: 7:00 PM – 1:00 AM","Tuesday: 7:00 PM – 1:00 AM","Wednesday: 7:00 PM – 1:00 AM","Thursday: 7:00 PM – 1:00 AM","Friday: 7:00 PM – 1:00 AM","Saturday: 7:00 PM – 1:00 AM","Sunday: 7:00 PM – 1:00 AM"]'::jsonb, 'http://www.netblitz.app/portal/carmenbar', '+84 903 618 577', 2, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'carmen-bar');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxYy5RkkvdTERLuTCr74_4xI/photos/AWCwydiwsKMEUTs5ufljFrWrizOaeaQS8p7WX1gP6Do8Yr6kexy1TxJo9PAJREh_j2UXZ1TmTkL4Lu8MEhBQd_FrjUYsZy9SP4k0HYziDHM-IWJkG_PjNGTA9d7VADnxHDnVPcC_0360yJFSHG2MaficrBjdsRIDMBXEKFUZ4hy-UkXVcmjH11zc6_NHNpbnSnz3QdVAcRDtcFLVw1ioH1Pf-z3bxCyBBwdYoZjhPFO6F7_YmtLNDDjK_Q4TaWmk-1mFA6zMkKNvzddBXN9bE_c6N3DLSo7bLI3mExxSiW2ZCCiVupzdRd_D--FPlkpCJ1dyd5lHeOgDiKGffGj1yUg_hRwChKybxkwznTxy9yCBUZQ97rPO13gtQUqsC-KySC6S3WZgDpqdwhKkOirEC2XdpDYW5v_ngCq-MaUy2w7Y9xeIZ4nS', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDnJBQQIPnJ6E24f_XD9i5_8Lx6t_xFpPknw-vh36o7yYuR4laFLkTsHvv62WGDeTcmL_mc9x2fjL7POZ-kFuUKzPgdqHpHzo0IJ1t64_RFam-8qIw8L6FQ8vuMa-xVts4hQE9Yfv3Dky16c8Y=s4800-w800', 4800, 3200, 'Carmen', 'https://maps.google.com/maps/contrib/110899780450108297949', 0, true
from places where slug = 'carmen-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxYy5RkkvdTERLuTCr74_4xI/photos/AWCwydgfN2Hh29IjgLAF-0c_UK7-1kJ6TZLsBXEbGPIpR7kOReVSj0lSb1Eo1SGwVg4xvZMMpqEy_WYAXIu0QKl5AohR6046qovbnQW9bwB93tsBFAkLmX6cjm6RACmRsNwEHkRmy5XAIRK_6jZDjN7c_IDjhEVxx_3WDNWZ92Mw1JxvWCPtKSZc2X9hNrHHL8to_nqxHZyiWsDT7appC51b1ZOexRNBce8vRoGeuZaQdGalaPFAlQhzHxqt_7aIuRwwe3DvKXBettXoOIg8Fi9FKvw05TQXQ87LBBZe0i1GR5tVK2mTv_XjkW6gPMUWdqexVyJKvr2LRP6WtkzYa7i0byIqlBWMfv7cZo-_aow4JU2rzvOgJAfjHt50FNlWsfCU8piUJQilBL6R4_vh31jIgkvD4hg-4A_XeM6KcqZKxHSlecQ', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDra9BH7gACFXJTH2tbTlg3E6S0EUJVbRJl2d2NPyeNuFeRaz0A81fFLnslLjNB1rIr8dSudfQ1quXaPc02Q_ngGhYR0U_1vKxBIUWckq0isSHVQDaVWhniMR55nm6D7Ox1Pe6FZPTlj1kq8g=s4800-w800', 1200, 900, 'Carmen', 'https://maps.google.com/maps/contrib/110899780450108297949', 1, false
from places where slug = 'carmen-bar';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJxYy5RkkvdTERLuTCr74_4xI/photos/AWCwydjt2ccSDxtSJr12B8fWhrm_G-kSKV6v1iaAW-ijA30c1vJDACaG615KcxfpNiLb8MHhTGnEEw_vB_IZbbp12YxQ2OsHTW7mxciDcQpq1f5Z1xxHAmXCmPxbwq4D1x-ImQ6s3bVWuJX-DnDh7_Ptd98yafYAjJuFagPAQXvVwND-J4scCn4nFACHxm_7b8bXkMmW6J1vq981Ln24dBdhq8tbCEbYExqsmnGke5P5eATKLaIsRdP9DyBl4vvA0d3G9VeQdC-h2vK2JZzO0l0YCe7_ZTPI2g-PjFeU4Ck6ntmq5ygxIDSJQoLaMKSTD-jnIF40SBgq0fwrJTF6YcIX0I1-Qjk3MPWmQHXaeeZF9_YKHztga7rlAJOWFJi0kogvjoNl24MxCFoLsaRp7ZPuEPqTABqBfL2ZNqNKvEsIpJcvUw', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDyK6wbJgq7Fkiq0Ow8lpGX9b4S72QOIWYNn3D69_shvDRbi2L_3JaH3tBLZMKnnXwPd8gV517bUvHtUx9kb5i5GQ3EOwZhBc3iq73daMXWyANW74vNU9y8Ly-8mb_XmsrJCjpNnkMEw5bntg=s4800-w800', 838, 530, 'Carmen', 'https://maps.google.com/maps/contrib/110899780450108297949', 2, false
from places where slug = 'carmen-bar';

insert into places (slug, google_place_id, name_en, name_vi, category, is_featured, vibe_tags,
  neighborhood_en, neighborhood_vi, address, lat, lng, rating, rating_count,
  price_level, price_display, price_vnd, duration_min, duration_max,
  desc_en, desc_vi, emoji, opening_hours, website, phone, saved_count, is_published, updated_at)
values ('bitexco-skydeck', 'ChIJVZKCP0EvdTERfHvs6AfGjok', 'Bitexco Saigon Skydeck', 'Saigon Skydeck (Bitexco)', 'out', false, array['views']::text[],
  'Hồ Tùng Mậu, D1', 'Hồ Tùng Mậu, Q1', '36 Hồ Tùng Mậu, Sài Gòn, Hồ Chí Minh 700000, Vietnam', 10.7715673, 106.7042465, 4.4, 12709,
  null, '240k₫', 240000, 45, 90,
  'The lotus-shaped tower''s 49th-floor deck with 360° views — cheaper than Landmark 81 and right in the old center.', 'Đài quan sát tầng 49 của toà tháp búp sen với view 360° — rẻ hơn Landmark 81 và nằm ngay trung tâm cũ.', '🏙️', '["Monday: 9:30 AM – 9:30 PM","Tuesday: 9:30 AM – 9:30 PM","Wednesday: 9:30 AM – 9:30 PM","Thursday: 9:30 AM – 9:30 PM","Friday: 9:30 AM – 9:30 PM","Saturday: 9:30 AM – 9:30 PM","Sunday: 9:30 AM – 9:30 PM"]'::jsonb, 'https://ticket-stations.com/saigon-skydeck-bitexco', null, 2, true, now())
on conflict (slug) do update set
  google_place_id = excluded.google_place_id, name_en = excluded.name_en, name_vi = excluded.name_vi,
  category = excluded.category, is_featured = excluded.is_featured, vibe_tags = excluded.vibe_tags,
  neighborhood_en = excluded.neighborhood_en, neighborhood_vi = excluded.neighborhood_vi, address = excluded.address,
  lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count,
  price_level = excluded.price_level, price_display = excluded.price_display, price_vnd = excluded.price_vnd,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  desc_en = excluded.desc_en, desc_vi = excluded.desc_vi, emoji = excluded.emoji,
  opening_hours = excluded.opening_hours, website = excluded.website, phone = excluded.phone,
  saved_count = excluded.saved_count, is_published = true, updated_at = now();

delete from place_photos where place_id = (select id from places where slug = 'bitexco-skydeck');
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJVZKCP0EvdTERfHvs6AfGjok/photos/AWCwydjazjHiqrmqiSMi-cFtaIDzfvoy0qDFZ1iJjXYKwb5QZCimyfY1qfRXl-ZeIusWsicFwd7V6Fj2FLGXUd-8PzuwhYUUez8XMPXOWHD6iuDmSzX41QqPKbx1aIUpf7q_3AVKJwROPx8SA0VzfIvX-mTHY824_UlwSuKWB5g3cm9eBL5n8rRq5i5Ds7sG3ZI97qTtgksCMx6o6JB0kAQAKlMWK9ZFVUJNRkoFwlUS99n24rqZA4-Fmq2Cx-Cyb7zrUjf_pmJuPpRbTwPuQl8eL6x76C1-Ryityn7LZpwcLXGlJmtQ2SehWVdepMybeXmZ8zB6tl6nV1zdwMD6kmI3vKdZKhECbzDprcD627tOQ7YfhNuY8b6igEtfzNJedHKArEBFpDYECKF2_f9eAvO_VYfdBEzzp0iUSihIkUjLByYl1po', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDF-OjlgoqNsTuYUgXT1v49e3jhZHypx30kv4KTA_vl5S2h35I-KDx47wM-LrAr7LcFHTsfXZteBl1KeQmq581Or-KTXF3ToQn1fL0r2L0MVqnQ2-3GDfcbjbR4rVT6e46l2SD2ByeWI4-niA=s4800-w800', 4032, 3024, 'Teddy Tan', 'https://maps.google.com/maps/contrib/105870042903561981748', 0, true
from places where slug = 'bitexco-skydeck';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJVZKCP0EvdTERfHvs6AfGjok/photos/AWCwydgrqU7WQB4OVyh8Hu1Oz32X9Bpmerv9-KiIglUrdsKBxRbuw88dQAEdw3CkYGNTZvQwyHIbHXWHMOEKx78xNMPcmgfpgRm2gntrMYBLA-vmmYkbrXg7by0DN5hihJSO_a6llsjqRledATPsn4FV0QHbQYQ2hLiSgGtq2tpKdLmwDLFY2A1GzV6avOWBXB4re-uXVScKmd1iaA-rjP4bRfAxn1S6AzrSh2r5R_TgnjFWYMXz2UvGJNgrQo-ZkaA7KebH9_IJWuy0qjD44JpVgAN8i6lVx1xGiXWKPLw8C0KPo9DDuM535EpyLF-Vp3IvWvAN7Mq9JPaqSeyJ1qttDkxG7PGOVbuMNSUHeOoOTaASERMf8l5UT3TJa0yQQUa0rB5AlK9OLzW5fizNhN_rhRY0RElFJyX9gjVxsGfLO-U1-O8n', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCEXzvzcnDx3hVMOISpneItlGH0As4izSyrM1mJGaYgSVrhNVxBdZQkzbsTTsjAQNBYq6yt2msUjoTPgZdFrP7FZ7QpJZXrpbO6uMFurDstBAL72xDpeDf1vzUyLNWr555aN4VRyJXN7KQpOBU=s4800-w800', 4160, 2340, 'Shiva shiva shiva', 'https://maps.google.com/maps/contrib/116909748471454316378', 1, false
from places where slug = 'bitexco-skydeck';
insert into place_photos (place_id, photo_ref, photo_uri, width_px, height_px, attribution_name, attribution_uri, sort_order, is_cover)
select id, 'places/ChIJVZKCP0EvdTERfHvs6AfGjok/photos/AWCwydh3XfwWxk_5PNYu1wBCG4w8uYRgi6C4sqJiS2AhVHAQNX81SopbAtEPDS4xEEIICDuNg65cuOCv6HMd5LN7mPZ5ZpzT2GNp7eSOjBeVP6RXn2jxlwoXdbrdjZvDbo8cH3kfFhOh2UEFOYfw0eTp5emuc-6SreF47IRKYVxJNZA7zhGfw04uCCXoKXJEsof5QpAGYdNK592HL5QwTU91YttbK__T-iHFByF7kNLe78YWRzmOLmYsVKyDUAt7_gXwStxdx_JccdJguy-uMyMgVxYj_g-y42UFcKlRvsGTUbuo8Od0H9vSdWCXXf1umRcDv1g1rUypWjXCOAS_KUmCOvP2-oETR16raBJ43LhC2tpN4kspL1XZJYXtM5J5jnwqR3LEIsfQONq-TYQ95UAZ_PZAvcfDP1cfI5KrVonHon6h5MFl53Fwzyg10GXBL6gX', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAjLuwfVqkyjt0_Z9OuLApreCG1RJYk9Hv5NBwSTeg0qQ3el4mT2eFz3apRPa7gnteljrCCa9ftRgLrwQyXb8qKlYBeU7NV83m5XH_iJQXmJXFT3OUQLAZq0T3w935l7Bs3jEvF7PJCnULfBy6h2bqUJg=s4800-w800', 3060, 4080, 'Trip Be Me Travel Stories', 'https://maps.google.com/maps/contrib/110595152436519858715', 2, false
from places where slug = 'bitexco-skydeck';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('rooftops-with-a-view', 'Rooftops with a view', 'Rooftop ngắm thành phố', 'Golden hour to midnight — the decks and bars where Saigon shows off its skyline.', 'Từ giờ vàng đến nửa đêm — những sân thượng và quầy bar nơi Sài Gòn khoe đường chân trời.', '@saigonnights', true, 1)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'chill-skybar' and ph.is_cover limit 1
) where slug = 'rooftops-with-a-view';
delete from collection_places where collection_id = (select id from collections where slug = 'rooftops-with-a-view');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'chill-skybar';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'blank-lounge';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'broma-not-a-bar';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'social-club-rooftop';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'bitexco-skydeck';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 5 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'landmark-81-skyview';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 6 from collections c, places p where c.slug = 'rooftops-with-a-view' and p.slug = 'the-deck-saigon';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('street-food-classics', 'Street food classics', 'Ẩm thực đường phố kinh điển', 'The stalls, alleys and night streets locals actually queue for.', 'Những quán, hẻm và phố đêm mà chính người Sài Gòn cũng xếp hàng.', '@foodmapvn', true, 2)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'banh-mi-huynh-hoa' and ph.is_cover limit 1
) where slug = 'street-food-classics';
delete from collection_places where collection_id = (select id from collections where slug = 'street-food-classics');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'banh-mi-huynh-hoa';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'pho-le';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'com-tam-ba-ghien';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'banh-xeo-46a';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'oc-dao';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 5 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'ho-thi-ky-food-street';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 6 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'vinh-khanh-food-street';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 7 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'lunch-lady';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 8 from collections c, places p where c.slug = 'street-food-classics' and p.slug = 'ben-thanh-street-food';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('old-saigon-heritage', 'Old Saigon heritage', 'Di sản Sài Gòn xưa', 'Colonial landmarks, incense-filled temples and the city''s oldest café.', 'Công trình thuộc địa, đền chùa nghi ngút khói hương và quán cà phê lâu đời nhất thành phố.', '@quietcorners', true, 3)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'central-post-office' and ph.is_cover limit 1
) where slug = 'old-saigon-heritage';
delete from collection_places where collection_id = (select id from collections where slug = 'old-saigon-heritage');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'independence-palace';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'central-post-office';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'notre-dame-cathedral';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'jade-emperor-pagoda';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'thien-hau-temple';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 5 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'fine-arts-museum';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 6 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'saigon-opera-house';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 7 from collections c, places p where c.slug = 'old-saigon-heritage' and p.slug = 'cheo-leo-cafe';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('cafes-of-saigon', 'Cafés worth the detour', 'Những quán cà phê đáng đường xa', 'From 1938 vợt coffee to specialty roasters — a caffeine trail across the city.', 'Từ cà phê vợt 1938 đến specialty roaster — hành trình caffeine xuyên thành phố.', '@saigoncaphe', true, 4)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'cafe-apartment' and ph.is_cover limit 1
) where slug = 'cafes-of-saigon';
delete from collection_places where collection_id = (select id from collections where slug = 'cafes-of-saigon');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'cafe-apartment';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'workshop-coffee';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'cheo-leo-cafe';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'little-hanoi-egg-coffee';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'bang-khuang-cafe';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 5 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'okkio-caffe';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 6 from collections c, places p where c.slug = 'cafes-of-saigon' and p.slug = 'oromia-coffee';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('green-escapes', 'Green escapes', 'Trốn phố tìm xanh', 'Parks, riverbanks and easy strolls when the group needs to breathe.', 'Công viên, bờ sông và những cung dạo bộ nhẹ nhàng khi cả nhóm cần thở.', '@quietcorners', true, 5)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'vinhomes-central-park' and ph.is_cover limit 1
) where slug = 'green-escapes';
delete from collection_places where collection_id = (select id from collections where slug = 'green-escapes');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'green-escapes' and p.slug = 'tao-dan-park';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'green-escapes' and p.slug = 'saigon-zoo';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'green-escapes' and p.slug = 'vinhomes-central-park';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'green-escapes' and p.slug = 'starlight-bridge';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'green-escapes' and p.slug = 'book-street';

insert into collections (slug, title_en, title_vi, desc_en, desc_vi, curator_handle, is_public, sort_order)
values ('first-timer-classics', 'First-timer classics', 'Lần đầu tới Sài Gòn', 'One perfect starter day: the must-sees that never miss.', 'Một ngày nhập môn hoàn hảo: những điểm phải ghé và không bao giờ gây thất vọng.', '@citycrew', true, 6)
on conflict (slug) do update set
  title_en = excluded.title_en, title_vi = excluded.title_vi, desc_en = excluded.desc_en, desc_vi = excluded.desc_vi,
  curator_handle = excluded.curator_handle, is_public = true, sort_order = excluded.sort_order;
update collections set cover_photo_id = (
  select ph.id from place_photos ph join places p on p.id = ph.place_id
  where p.slug = 'nguyen-hue-walking-street' and ph.is_cover limit 1
) where slug = 'first-timer-classics';
delete from collection_places where collection_id = (select id from collections where slug = 'first-timer-classics');
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 0 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'ben-thanh-street-food';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 1 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'independence-palace';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 2 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'nguyen-hue-walking-street';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 3 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'landmark-81-skyview';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 4 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'banh-mi-huynh-hoa';
insert into collection_places (collection_id, place_id, sort_order)
select c.id, p.id, 5 from collections c, places p where c.slug = 'first-timer-classics' and p.slug = 'bui-vien-walking-street';
