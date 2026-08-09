-- Retire the 'sights' category.
--
-- It was insurance, not a category: the previous migration required every
-- place to carry at least one category, so anything the data could not
-- classify needed somewhere to land. But every place in the app is
-- somewhere to go, so a "Sights" chip filtered nothing and taught nothing —
-- its real membership was "rows we failed to classify", an implementation
-- detail wearing a user-facing label.
--
-- The Explore filter row has since grown an "All" chip, which is the better
-- insurance: an uncategorised place still appears in the full list, and the
-- dashboard flags it in red for an editor. So the guarantee can be dropped
-- along with the bucket.
--
-- Deploy order matters: redeploy scan-city and fetch-place BEFORE running
-- this. A function still writing 'sights' violates the new constraint and
-- the import fails.

alter table public.places drop constraint if exists places_categories_known;

update public.places
set categories = array_remove(categories, 'sights')
where 'sights' = any (categories);

-- Same closed vocabulary, minus 'sights', and no longer requiring a value:
-- an empty array now means "not classified yet", which is a fact the
-- dashboard can show rather than one the schema has to hide.
alter table public.places add constraint places_categories_known check (
  categories <@ array['cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife']
);
