-- Mobile-first curation: Supabase Auth + Row Level Security.
--
-- Replaces the localhost Express server (which held the service key) with
-- direct browser access: the dashboard signs in via magic link and talks to
-- the database with the anon key; these policies are what stand between the
-- public internet and the data.
--
-- Access model:
--   anon / any signed-in visitor  → read only published+approved content
--                                   (the same view the mockup snapshot uses)
--   editors (email allow-list)    → full read/write on places, photos,
--                                   collections, and the place-photos bucket
--
-- Apply via the Supabase SQL editor, or `supabase db push`.

-- ── editor allow-list ────────────────────────────────────────────────────────
-- Signing in is not enough: an account only gets write access if its email is
-- in this table. RLS is enabled with no policies, so only the service role and
-- the security-definer helper below can read it.

create table if not exists public.editors (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.editors enable row level security;

insert into public.editors (email) values ('anhlt1983@gmail.com')
on conflict do nothing;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editors
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- ── places ───────────────────────────────────────────────────────────────────

alter table public.places enable row level security;

-- retire the pre-auth policy (published only, no review_status check)
drop policy if exists "anon read published places" on public.places;

drop policy if exists "public read published places" on public.places;
create policy "public read published places" on public.places
  for select using (is_published = true and review_status = 'approved');

drop policy if exists "editors manage places" on public.places;
create policy "editors manage places" on public.places
  for all using (public.is_editor()) with check (public.is_editor());

-- ── place_photos ─────────────────────────────────────────────────────────────

alter table public.place_photos enable row level security;

-- retire the pre-auth policy (no is_hidden / review_status check)
drop policy if exists "anon read photos of published places" on public.place_photos;

drop policy if exists "public read photos of published places" on public.place_photos;
create policy "public read photos of published places" on public.place_photos
  for select using (
    is_hidden = false
    and exists (
      select 1 from public.places p
      where p.id = place_photos.place_id
        and p.is_published = true
        and p.review_status = 'approved'
    )
  );

drop policy if exists "editors manage photos" on public.place_photos;
create policy "editors manage photos" on public.place_photos
  for all using (public.is_editor()) with check (public.is_editor());

-- ── collections ──────────────────────────────────────────────────────────────

alter table public.collections enable row level security;

drop policy if exists "anon read public collections" on public.collections;

drop policy if exists "public read public collections" on public.collections;
create policy "public read public collections" on public.collections
  for select using (is_public = true);

drop policy if exists "editors manage collections" on public.collections;
create policy "editors manage collections" on public.collections
  for all using (public.is_editor()) with check (public.is_editor());

-- ── collection_places ────────────────────────────────────────────────────────

alter table public.collection_places enable row level security;

drop policy if exists "anon read places of public collections" on public.collection_places;

drop policy if exists "public read public collection members" on public.collection_places;
create policy "public read public collection members" on public.collection_places
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_places.collection_id and c.is_public = true
    )
  );

drop policy if exists "editors manage collection members" on public.collection_places;
create policy "editors manage collection members" on public.collection_places
  for all using (public.is_editor()) with check (public.is_editor());

-- ── storage: place-photos bucket ────────────────────────────────────────────
-- The bucket stays public-read (photo URLs are baked into the mockup);
-- writes move from the service key to signed-in editors.

drop policy if exists "editors upload place photos" on storage.objects;
create policy "editors upload place photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'place-photos' and public.is_editor());

drop policy if exists "editors update place photos" on storage.objects;
create policy "editors update place photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'place-photos' and public.is_editor());

drop policy if exists "editors delete place photos" on storage.objects;
create policy "editors delete place photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'place-photos' and public.is_editor());
