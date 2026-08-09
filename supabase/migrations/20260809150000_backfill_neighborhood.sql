-- Backfill neighborhood_en/neighborhood_vi for places the scan/add-place
-- pipeline imported before it knew how to derive them (see the same-day
-- fix to supabase/functions/_shared/import-place.ts, which now reads
-- Google's addressComponents for every import from here on).
--
-- Da Nang was entirely scan-imported and had zero neighborhoods; a chunk
-- of Hanoi's scanned places were missing them too. HCMC was hand-curated
-- from the start and already has them all.
--
-- The stored `address` already carries the district/ward as its own
-- comma segment — consistently the third-from-last, after the street
-- portion (which varies in length) and before "<City> <postcode?>,
-- Vietnam" (always exactly those last two). No new Google API calls
-- needed; this is pure text extraction from data already on the row.
update public.places
set neighborhood_en = seg,
    neighborhood_vi = seg
from (
  select id,
    (regexp_split_to_array(address, '\s*,\s*'))
      [array_length(regexp_split_to_array(address, '\s*,\s*'), 1) - 2] as seg
  from public.places
  where (neighborhood_en is null or neighborhood_en = '')
    and address is not null
    and array_length(regexp_split_to_array(address, '\s*,\s*'), 1) >= 3
) derived
where public.places.id = derived.id;
