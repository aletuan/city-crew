-- A fix applied to the live project and never committed; its change was
-- later folded into the file it fixes. Copied from the live history on
-- 25 Nov 2026, byte for byte, so the two histories name the same rows.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

drop policy if exists "readers like public collections" on public.collection_likes;
create policy "readers like public collections" on public.collection_likes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and c.is_public
    )
  );
