-- Two more cities take their place on the shelf: Đà Lạt and Huế. Rows
-- only — the catalog for both arrives through the desk in its own time,
-- and every hero field stays null until there is a place to point at
-- (all the hero readers already treat null as "no hero yet").
--
-- Radius 20km: Đà Lạt's sights spread to Lang Biang, Huế's to the
-- imperial tombs, and both fit inside twenty kilometres of their
-- centres — the same figure Hanoi uses.

insert into public.cities (
  id, name_en, name_vi, name_ja, short_en, short_vi, short_ja,
  center_lat, center_lng, radius_km, sort_order, is_active
)
values
  ('dalat', 'Da Lat', 'Đà Lạt', 'ダラット', 'Da Lat', 'Đà Lạt', 'ダラット',
   11.9416, 108.4383, 20, 4, true),
  ('hue', 'Hue', 'Huế', 'フエ', 'Hue', 'Huế', 'フエ',
   16.4637, 107.5909, 20, 5, true)
on conflict (id) do nothing;
