-- Two new keys in the closed category vocabulary: `focus` and `fun`.
--
-- `fun` exists because the desk collected two cinemas and the taxonomy had
-- no word for them. A place whose `categories` stays empty is not merely
-- unfiltered — the planner selects on category overlap and the wizard
-- requires at least one category, so an uncategorised place can never
-- appear in any plan. Approving a cinema without a key for it would add a
-- place the app's main feature cannot reach. The key is `fun` rather than
-- `cinema` because the next additions are bowling alleys and shows, and a
-- vocabulary of one-venue-type keys is how taxonomies rot.
--
-- `focus` is a place to sit and work or study. It ships with no rows
-- tagged, deliberately: whether a café tolerates a laptop for three hours
-- is not in the data — the desk knows it, and tags at its own pace. The
-- app only offers a category chip where the city actually holds a tagged
-- place, so an empty key is invisible rather than a dead end.
--
-- This is the last step of the three the app-side comment prescribes:
-- app/src/lib/categories.ts and dashboard/src/categories.js already know
-- both keys. The constraint widens last because a constraint tightened
-- before the writers know about it fails every import. Widening is safe in
-- the other direction: no existing row can violate a larger allowed set.

alter table public.places drop constraint if exists places_categories_known;

alter table public.places add constraint places_categories_known check (
  categories <@ array[
    'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife',
    'focus', 'fun'
  ]
);
