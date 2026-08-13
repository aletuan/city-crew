-- Collections a signed-in app user makes for themselves.
--
-- Editorial collections keep owner_id null: they belong to the desk, not to
-- a person, and the existing editor policies already cover them. A row with
-- an owner belongs to that person.
--
-- Owned rows are private and stay private. The insert and update checks pin
-- is_public to false, so a user cannot publish into the feed every other
-- user reads — `fetchCollections()` selects on `is_public = true` alone, and
-- without this a single client call would put unreviewed content on
-- everybody's Collections tab. Publishing stays an editor action.

alter table public.collections
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

create index if not exists collections_owner_idx on public.collections(owner_id);

-- Read your own, whatever the is_public flag says.
drop policy if exists "owners read their collections" on public.collections;
create policy "owners read their collections" on public.collections
  for select using (owner_id = auth.uid());

-- Write only your own rows, and only ever as your own: the check on
-- owner_id is what stops a client inserting a row owned by someone else.
drop policy if exists "owners insert their collections" on public.collections;
create policy "owners insert their collections" on public.collections
  for insert with check (owner_id = auth.uid() and is_public = false);

drop policy if exists "owners update their collections" on public.collections;
create policy "owners update their collections" on public.collections
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_public = false);

drop policy if exists "owners delete their collections" on public.collections;
create policy "owners delete their collections" on public.collections
  for delete using (owner_id = auth.uid());

-- Members of your own collections. Read only for now: nothing can add a
-- place to a collection from the app yet, and the write policies land with
-- the flow that can. Without this select an owned collection would render
-- empty the moment it stopped being empty.
drop policy if exists "owners read their collection members" on public.collection_places;
create policy "owners read their collection members" on public.collection_places
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_places.collection_id and c.owner_id = auth.uid()
    )
  );
