-- Pin every collection's cover instead of leaning on the app's fallback.
--
-- Six collections still had cover_photo_id null and were rendering the first
-- member's cover photo via the fallback in CollectionsScreen/ExploreScreen.
-- That looks right until someone reorders the list in the data desk, at which
-- point the collection's face silently changes to a different place. Pinning
-- the photo the app is already showing changes nothing on screen today and
-- makes the cover an editorial decision rather than a side effect of ordering.
--
-- Picks the first PUBLISHED member by sort_order — not the member at
-- sort_order = 0, which is what the Da Nang and Hanoi migrations used and what
-- would fail here. Deleting places leaves holes in collection_places.sort_order
-- (hanoi-museum-hop starts at 2; rooftops-with-a-view and first-timer-classics
-- start at 1), so an equality test finds nothing and leaves the cover null.
-- Ordering instead mirrors membersOf() in app/src/lib/data.ts exactly: sort by
-- sort_order, keep only published+approved places, take the first.
--
-- Within that place, photo choice follows photosOf(): visible photos only,
-- is_cover first, then sort_order.
--
-- Idempotent and non-destructive: scoped to rows that have no cover, so a
-- replay skips everything already pinned and never overrides an editor's pick.
-- A collection with no live members (street-food-classics) resolves to null and
-- stays null.
update public.collections c set cover_photo_id = (
  select ph.id
  from public.collection_places cp
  join public.places p
    on p.id = cp.place_id
   and p.is_published
   and p.review_status = 'approved'
  join public.place_photos ph
    on ph.place_id = p.id
   and not ph.is_hidden
  where cp.collection_id = c.id
  order by cp.sort_order, ph.is_cover desc, ph.sort_order
  limit 1
)
where c.cover_photo_id is null;
