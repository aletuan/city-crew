-- The vibe vocabulary grows its suitability wing.
--
-- `places_vibe_tags_check` predates the migrations directory — it locks
-- vibe_tags to the original eight values, and it is the constraint that
-- refused the first `kid_friendly` write. The app, the classifier and the
-- dashboard picker all learned the three suitability values in the
-- suitability-vibes change; this is the database catching up.
--
-- Found the honest way: the first tagging pass tripped over it in
-- production. The repo grep that declared "no vocabulary constraint on
-- vibe_tags" searched the migrations directory, and this constraint is
-- older than the directory. The lesson is the usual one — read the
-- database, not the folder that is supposed to describe it.
--
-- The three are hand-assigned only. `classify` never emits them (its
-- tests walk every Google type to prove it), so the importer cannot
-- write them — the desk is the only producer, which is what keeps the
-- axis carrying information the categories do not already hold.
--
-- Not wired into supabase/tests/run.sh: the harness runs a curated list
-- of migration globs against stub tables that do not carry this
-- constraint, and adding it there would be testing a stub against a rule
-- written for the real schema.

alter table public.places drop constraint if exists places_vibe_tags_check;
alter table public.places add constraint places_vibe_tags_check check (
  vibe_tags <@ array[
    'cafes', 'food_tour', 'outdoors', 'views', 'culture', 'shopping',
    'nightlife', 'chill',
    'kid_friendly', 'romantic', 'quiet'
  ]::text[]
);
