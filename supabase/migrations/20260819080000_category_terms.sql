-- Search synonyms the desk can edit without waiting for a release.
--
-- The gap this closes: somebody searching "cinema" could not find a
-- multiplex, because the word "cinema" appears nowhere in its record — not
-- in the name, not in the description (two thirds of this catalog has
-- none), and not in the label of the category it is filed under, which
-- reads "Fun". The app now folds a synonym list into each place's search
-- text, and this table is the half of that list which does not require
-- shipping a new build.
--
-- ── why a table at all ──
--
-- This repo is deliberately reluctant about new state, and the bar is
-- "cannot be derived". Synonyms qualify: they are not a fact about a place,
-- they are a record of what readers actually type — which is learned from
-- misses, changes with usage and slang, and is therefore editorial content
-- with a lifecycle of its own. Nine rows, one per category key.
--
-- ── why it can only add ──
--
-- The app ships defaults in `app/src/lib/categories.ts` and unions this
-- table onto them (`mergeTerms`). It cannot subtract. So an editor who
-- clears a row, a fetch that fails offline, or a table that does not exist
-- yet all cost exactly nothing: search degrades to the day it shipped
-- rather than to silence. That is the same shape as every other fallback
-- in this app, and it is what lets a public-readable table hold text that
-- steers results without being able to break them.
--
-- ── why the key is not constrained ──
--
-- A `check` against the nine known keys would make this the *fourth* copy
-- of a vocabulary that already lives in three places, and the fourth is
-- the one nobody remembers. Instead an unknown key is inert: the app looks
-- terms up by the categories a place actually carries, so a row for a
-- category that does not exist is never read. Wrong data here is dead
-- weight, not a bug.

create table if not exists public.category_terms (
  -- A key from the closed category vocabulary. Uncontrolled on purpose —
  -- see above.
  category   text primary key,
  -- Words a reader might type for this concept. One flat list, languages
  -- mixed: search never reads the reader's UI language, because somebody
  -- with the app in Vietnamese types "cinema" and somebody with it in
  -- English types "pho".
  terms      text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.category_terms enable row level security;

-- Read by everyone, including signed-out readers: the search box works
-- before you have an account, the same as the catalog it searches.
drop policy if exists "public read category terms" on public.category_terms;
create policy "public read category terms" on public.category_terms
  for select using (true);

-- Written by the desk only, on the same allow-list that guards places.
drop policy if exists "editors manage category terms" on public.category_terms;
create policy "editors manage category terms" on public.category_terms
  for all using (public.is_editor()) with check (public.is_editor());
