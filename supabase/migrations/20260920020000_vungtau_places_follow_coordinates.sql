-- Seven places filed under hcmc that the coordinates now put in vungtau.
--
-- Applied to production as `vungtau_places_follow_coordinates_20260920`;
-- this is the repo's copy. Keyed on slug, so re-running changes nothing.
--
-- These were not mis-imported. They went in between 18/09 and 19/09, when
-- `vungtau` was not yet a city in the catalog and hcmc was the only honest
-- answer — after the 2025 merger Vũng Tàu is administratively part of it,
-- and they sat 59–64 km from its centre, inside MAX_CITY_KM. The city row
-- arriving is what changed the right answer, not the import.
--
-- Worth keeping in mind for the next city added: `nearestCity` reads the
-- `cities` table live, so new imports follow a new row immediately, and
-- everything imported before it does not. Adding a city means sweeping the
-- places that now belong to it. This file is that sweep for Vũng Tàu.

update public.places set city_id = 'vungtau'
where slug in (
  'oasis-sea',            --  3 km from the centre
  'sea-sun-3-coffee',     --  3
  'the-hill-coffee',      --  2
  'ocean-house',          --  3
  '1991-s-coffee-beer',   -- 17
  'apina-cafe',           -- 20, in Bà Rịa
  'leona-cafe'            -- 24
) and city_id <> 'vungtau';
