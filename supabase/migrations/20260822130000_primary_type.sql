-- Keep Google's own answer to "what is this place, mainly".
--
-- The importer has always held it: `primaryType` arrives in the details
-- fetch, `classify` reads it, and the derived categories get written while
-- the word itself is thrown away. Translation kept, original burned.
--
-- Twice now that has cost real work. When `store` was removed from the
-- classification table, every already-imported row that had worn the
-- mistake had to be found by hand, because nothing recorded what Google
-- had said about it. And the planned "Treats" category — splitting
-- bakeries and dessert shops out of cafés once there are enough of them —
-- needs to know which cafés *are* bakeries, which is exactly the word
-- this column keeps.
--
-- Free-text rather than a check constraint, deliberately: the value is
-- Google's vocabulary, not ours, and their type list grows without
-- notice. A constraint here would make their next new type our next
-- failed import. Nothing in the app reads this column; it exists so a
-- future reclassification is one UPDATE instead of one API call per row.
--
-- Nullable with no backfill: rows imported before this column simply do
-- not know, and re-asking Google costs money per row for a question no
-- feature is asking yet. The column fills forward from here.
alter table public.places add column primary_type text;

comment on column public.places.primary_type is
  'Google Places primaryType at import time, verbatim. Null for rows imported before 2026-08-22.';
