-- Places in common, the most lately kept first (owner, 16 Nov 2026).
--
-- A person's page shows five of each kind of thing two people have in
-- common, and says of a row that was cut that these are the most recent
-- (`InCommon`). The collections both liked were already answered that
-- way — by the latest like of either. The places were answered by name,
-- so the five shown would have been the first five of the alphabet, and
-- "most recent" a thing the row could not say.
--
-- So a place's turn is the last time either of the two put it in a
-- public collection: `collection_places.created_at`, the latest over
-- both. Nothing else in the function changes — who is told, what is
-- read, the blocks, the cap — and it is replaced in place, so it keeps
-- its grants (`authenticated` only).
--
-- A row from before `collection_places` had a `created_at`
-- (`20260910090000_daily_caps`) carries the day that column was added;
-- those tie, and the slug settles them.

create or replace function public.places_in_common(other uuid)
returns table (slug text, name_en text, name_vi text, name_ja text, photo_uri text)
language sql
stable
security definer
set search_path = public
as $$
  with held as (
    select c.owner_id, cp.place_id, cp.created_at
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    where c.is_public and c.owner_id in (auth.uid(), other)
  )
  select p.slug, p.name_en, p.name_vi, p.name_ja,
    -- The place's cover, else its first photograph that is not hidden.
    (select ph.photo_uri from public.place_photos ph
      where ph.place_id = p.id and ph.is_hidden = false
      order by ph.is_cover desc, ph.sort_order, ph.created_at
      limit 1)
  from public.places p
  where auth.uid() is not null
    and other is distinct from auth.uid()
    and p.is_published and p.review_status = 'approved'
    and exists (select 1 from held h where h.owner_id = auth.uid() and h.place_id = p.id)
    and exists (select 1 from held h where h.owner_id = other and h.place_id = p.id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = other)
         or (b.blocker = other and b.blocked = auth.uid())
    )
  order by (select max(h.created_at) from held h where h.place_id = p.id) desc, p.slug
  limit 30;
$$;
