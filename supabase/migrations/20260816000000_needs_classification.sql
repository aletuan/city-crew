-- Which places the desk has not finished filing.
--
-- A place arrives from Google with a name, an address, photographs and a
-- rating, and with nothing at all about what it *is*. Categories and vibe
-- tags are the two things only a person can decide, and they are also the
-- two the app leans on hardest: Explore filters by category, the cards
-- wear the vibes, and the plan wizard picks from both. A place with
-- neither is in the catalog and reachable from nowhere.
--
-- The desk had no way to see that. Every filter chip counts places that
-- *have* a tag, so a place with none is absent from every count and shows
-- up in no filter — the one state the whole filter row cannot express.
--
-- Generated rather than a view or a client-side scan, because the desk
-- needs to *filter* by it: a stored column is one `eq` away, indexable,
-- and cannot drift from the arrays it is computed from. Both columns are
-- `not null default '{}'`, so empty is the only "missing" there is and
-- cardinality is the whole test.
--
-- `or`, not `and`: a place with categories but no vibes is half-filed,
-- and half-filed is what this is for.

alter table public.places
  add column if not exists needs_classification boolean
  generated always as (
    cardinality(categories) = 0 or cardinality(vibe_tags) = 0
  ) stored;

comment on column public.places.needs_classification is
  'True while a place has no categories or no vibe_tags. Generated — set the arrays, not this.';

-- Partial, and on city_id: the desk asks this question one city at a time,
-- and the rows it wants are the rare ones. A full index would be mostly
-- false and mostly useless.
create index if not exists places_needs_classification_idx
  on public.places (city_id)
  where needs_classification;
