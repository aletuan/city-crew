-- How many people saved a copy of each public list, for the figure beside
-- the copy button on its card (owner, 20 Nov 2026).
--
-- The button moved into the card's row of acts, beside the heart, with
-- the number of people who copied the list next to it, as the heart has
-- its likes. `collection_use_counts` already counts copiers, but adds
-- them to the people who planned a trip from the list, for the shelf's
-- order: a sum that cannot be read back apart. This is the copy half
-- alone, under the same rules.
--
-- ── what it answers ──
--
-- One row per public list that somebody other than its owner has copied:
-- the slug and the number of people. People, not rows — one reader who
-- copies a list twice is one — and never the owner's own copy, as
-- `collection_use_counts` and `copies_of_list` leave it out. A list
-- nobody copied has no row; the app reads no row as none.
--
-- ── who may ask, and what they learn ──
--
-- Everybody, a guest included: a count of a public list's copiers names
-- nobody, and the same total already orders public shelves for every
-- reader (`collection_use_counts`). Who copied is still
-- `copies_of_list`'s, to a signed-in reader, under its own rule.
--
-- No blocks are read, as in `collection_use_counts`: the figure is the
-- same for every reader, so there is nobody whose blocks could apply, and
-- a figure that changed with who asked would tell a reader they had been
-- blocked (`20261115090000_list_activity_for_readers`).
--
-- A private list has no row, its owner included. The owner's own figure
-- for a list gone private is on its activity page, as before.

create or replace function public.collection_copy_counts()
returns table (slug text, copies integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.slug, count(distinct cc.owner_id)::integer
  from public.collections c
  join public.collections cc on cc.copied_from = c.id
  where c.is_public
    and cc.owner_id is distinct from c.owner_id
  group by c.slug;
$$;

revoke all on function public.collection_copy_counts() from public;
grant execute on function public.collection_copy_counts() to anon, authenticated;
