-- Ninh Bình's centre moves from the city to Tam Cốc – Tràng An.
--
-- A plan made from outside the city starts at the city's centre (owner,
-- 26 Oct 2026; `startPoint` in `app/src/lib/trip.ts`), so the centre has
-- to stand where a visitor's day does. Ninh Bình's stood in Ninh Bình
-- city, 20.2506, 105.9745, where none of its five published places are.
-- Measured 28 Oct 2026, from that centre:
--
--   Dam Khe Specialty Coffee Tam Coc   5.7 km   →  1.6 km
--   At Where                           5.9      →  1.6
--   Starbucks Tràng An                 5.8      →  3.2
--   Dia Tang Phi Lai Pagoda           21.8      → 24.3
--   Chau Son Holy Mother Monastery    26.7      → 23.7
--
-- The new point is the mean of the first three, between the Tam Cốc wharf
-- and Tràng An, which is also where visitors to Ninh Bình stay. The two
-- outlying sights stay far whichever point is chosen; Châu Sơn comes inside
-- the 25 km radius, which it was not.
--
-- Vũng Tàu, measured the same day and 10.3 km from the mean of its places,
-- was left as it is (owner, 28 Oct 2026). Its centre is on the city, where
-- four of its nine places are; the other five are in Long Hải and towards
-- Bà Rịa, 17–24 km away, and the mean of the two groups is in the wetland
-- between them, 11–15 km from both. Its problem is the catalog, not the
-- point.
--
-- Keyed on the id and on the old point, so a second run, or a centre the
-- desk has since moved by hand, is left alone.

update public.cities
   set center_lat = 20.2277, center_lng = 105.9296
 where id = 'ninhbinh' and center_lat = 20.2506 and center_lng = 105.9745;
