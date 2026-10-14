-- Three cities live in the database but have never lived in a migration:
-- Vũng Tàu, Hải Phòng and Melbourne were each added straight through the
-- desk, so a `supabase db reset` drops all three and takes their places
-- with them. This puts the rows back where the rest of the catalog keeps
-- them, next to the Đà Lạt/Huế insert.
--
-- Hải Phòng also spent its first days with is_active = false, and that
-- flag is not cosmetic: the `public read active cities` policy filters on
-- it, so the city was invisible to the app and the desk's Google Places
-- search returned nothing for it. The update below is what turns it on,
-- and it runs after the insert so a database that already holds the row
-- gets corrected rather than skipped.
--
-- Radius follows the pattern already set: 20km for a city whose sights sit
-- close together, 25km where they spread — Melbourne, like HCMC and Đà Nẵng.

insert into public.cities (
  id, name_en, name_vi, name_ja, short_en, short_vi, short_ja,
  center_lat, center_lng, radius_km, sort_order, is_active, tz
)
values
  ('vungtau',   'Vung Tau',  'Vũng Tàu',  'ブンタウ',   'Vung Tau',  'Vũng Tàu',  'ブンタウ',
   10.3460, 107.0843, 20, 6, true, 'Asia/Ho_Chi_Minh'),
  ('haiphong',  'Hai Phong', 'Hải Phòng', 'ハイフォン', 'Hai Phong', 'Hải Phòng', 'ハイフォン',
   20.8449, 106.6881, 20, 7, true, 'Asia/Ho_Chi_Minh'),
  ('melbourne', 'Melbourne', 'Melbourne', 'メルボルン', 'Melbourne', 'Melbourne', 'メルボルン',
   -37.8136, 144.9631, 25, 8, true, 'Australia/Melbourne')
on conflict (id) do nothing;

update public.cities
   set is_active = true
 where id in ('vungtau', 'haiphong', 'melbourne')
   and is_active is distinct from true;
