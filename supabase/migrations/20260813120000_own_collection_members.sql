-- Putting places into a list of your own.
--
-- The read side landed with the collections themselves; this is the write
-- side, held back until something in the app could use it.
--
-- Both policies gate on the parent collection's owner rather than on the
-- membership row, because a membership row has no owner of its own — the
-- question "may I put this here" is always a question about the list.
--
-- Nothing gates the place: every place a user can see is already public
-- catalog, and which ones someone saves is their business.

drop policy if exists "owners add to their collections" on public.collection_places;
create policy "owners add to their collections" on public.collection_places
  for insert with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "owners remove from their collections" on public.collection_places;
create policy "owners remove from their collections" on public.collection_places
  for delete using (
    exists (
      select 1 from public.collections c
      where c.id = collection_places.collection_id and c.owner_id = auth.uid()
    )
  );
