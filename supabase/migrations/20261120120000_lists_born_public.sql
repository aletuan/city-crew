-- A list may be made public from the start (owner, 20 Nov 2026).
--
-- Until today the insert policy pinned `is_public = false`, on an argument
-- written down twice: in `20260813000000_user_collections.sql` ("a user
-- cannot publish into the feed every other user reads") and again when
-- owners were let publish, in `20260815120000_publish_collections.sql`:
-- "A collection is still born private, and always; publishing is a
-- separate, deliberate second act by someone who has already seen what is
-- in the list."
--
-- The owner reversed it, having had that argument put to him: the form
-- that makes a list now asks who sees it — Public, Friends or Private —
-- and Public is the answer it opens on. The deliberate act is now that
-- choice, made on the form, rather than a second visit to the list.
--
-- What the second act was guarding, and where each part went:
--
-- - An empty list in public view. The Community tab already draws only
--   lists with a place in the catalog, and a person's page now hides a
--   public list of theirs from other readers until it has one (the app,
--   `person/Shared`). The row is public; it is simply not shown empty.
-- - Somebody else's curation republished under your name by default. A
--   copy is still made private by the app (`copyCollection` writes
--   `is_public = false`), and the form offers the choice only on a list
--   of your own making.
-- - Attribution. Unchanged: `stamp_curator` runs before insert as well as
--   update, so a list born public carries its owner's handle from its
--   first row, read from `profiles`, never from the request.
--
-- What does not change: you insert only as yourself, and twenty a day.
-- The policy below is the live one with its `is_public = false` clause
-- taken out — the live one, not `20260910090000_daily_caps.sql`'s: the
-- count went into `own_collections_today()` and `auth.uid()` into a
-- subquery in `20260927120000_rls_ask_once.sql`, and a policy written
-- after that migration has to be in its shape already (the inline count
-- recurses through `collections`' own read policies).

drop policy if exists "owners insert their collections" on public.collections;
create policy "owners insert their collections" on public.collections
  for insert with check (
    owner_id = (select auth.uid())
    and (select public.own_collections_today()) < 20
  );
