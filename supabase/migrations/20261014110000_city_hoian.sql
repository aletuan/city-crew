-- Hội An joins the shelf. The town sits about thirty kilometres down the
-- coast from Đà Nẵng — outside that city's twenty-five kilometre radius,
-- so its places could never have been collected under danang — and the
-- desk had no row to file them against at all.
--
-- Radius 20km, the figure Hanoi, Đà Lạt, Huế and Hải Phòng use: the
-- ancient town, An Bàng and Cửa Đại all fall inside it.
--
-- The row arrives active. is_active is read by the `public read active
-- cities` policy, so a city added with the flag off is invisible to the
-- app and the desk's Google Places search returns nothing for it — the
-- mistake Hải Phòng spent its first days in.
--
-- Hero fields stay null until there is a place worth pointing at; every
-- hero reader already treats null as "no hero yet".

insert into public.cities (
  id, name_en, name_vi, name_ja, short_en, short_vi, short_ja,
  center_lat, center_lng, radius_km, sort_order, is_active, tz
)
values
  ('hoian', 'Hoi An', 'Hội An', 'ホイアン', 'Hoi An', 'Hội An', 'ホイアン',
   15.8801, 108.3380, 20, 9, true, 'Asia/Ho_Chi_Minh')
on conflict (id) do nothing;
