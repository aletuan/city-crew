-- A photograph taken by the person who put the place here.
--
-- Until now every row in `place_photos` was written by an editor: the
-- importer pulling from Google, or somebody at the desk replacing a
-- picture by hand. The `editors manage photos` policy is the only write
-- path there is, and `is_editor()` reads an allow-list of emails. This
-- opens a second, much narrower path — a named person adding a
-- photograph to a place **they themselves imported**.
--
-- ── what does not need building, which is most of it ──
--
-- The visibility rule asked for is already the rule. A photograph on a
-- place that is approved and published is public the moment it is
-- written; a photograph on a place still waiting at the desk is visible
-- to the person who submitted that place and to nobody else. Neither
-- sentence needed a line of SQL: `public read photos of published
-- places` and `submitters read their own place photos` have said exactly
-- that since the submissions flow was built, and they say it about the
-- *place's* review status rather than the photograph's.
--
-- That is why there is no `review_status` on a photograph here, and no
-- queue to drain. A photograph inherits the standing of the place it
-- belongs to, which is the only standing it could honestly have: the
-- desk approving a place is already approving what is on it. `is_hidden`
-- remains what it has always been — an editor's decision to take one
-- picture down — and is not overloaded to mean "not looked at yet".
--
-- ── the three things that did need building ──
--
-- `local_guides` names who may do this at all. Deliberately a table of
-- ids rather than a flag on a profile, and deliberately not `editors`:
-- an editor is somebody with the desk open and the whole catalog in
-- reach, a local guide is somebody with the app open and one place of
-- their own in front of them. Keyed by `user_id`, not by email the way
-- `editors` is, because the desk grants this to people it knows by their
-- handle — an app account, with an id — where an editor is a colleague
-- known by the address they sign in with.
--
-- `uploaded_by` is who took it. It earns its place three times over: the
-- caps below count on it, account deletion has something to find, and
-- the desk can see whose picture it is looking at.
--
-- `created_at` is new here for the reason it was new on
-- `collection_places` in `20260910090000_daily_caps.sql`: counting needs
-- a clock, and this table never had one.
--
-- ── the caps, and why they are two ──
--
-- Ten a day bounds the account. Five per place bounds the *place*, which
-- is the limit that actually matters: a hundred photographs of one café
-- is not a contribution, it is a gallery nobody asked for, and the
-- second cap is what keeps a single enthusiastic afternoon from burying
-- the picture the desk chose. Both are counted off the rows themselves
-- inside `with check`, the shape every other cap in this schema uses —
-- no counter to reset, nothing that can drift from what was written.
--
-- Both counts go through definer functions rather than inline selects,
-- for the reason `own_collection_places_today` exists: a policy on
-- `place_photos` that selects from `place_photos` is evaluated under
-- that table's own read policies, which reach back through `places`, and
-- Postgres refuses the loop.

-- ── who may ──

create table if not exists public.local_guides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  -- Which editor opened the door, kept for the same reason `reports`
  -- keeps `handled_by`: a permission granted by somebody is a fact about
  -- two people, not one.
  added_by uuid references auth.users(id) on delete set null,
  note text
);

alter table public.local_guides enable row level security;

drop policy if exists "editors manage local guides" on public.local_guides;
create policy "editors manage local guides" on public.local_guides
  for all using (is_editor()) with check (is_editor());

-- A guide reads their own row and no one else's. The app needs this:
-- the panel that offers to add a photograph must know whether to appear,
-- and a person who is not a guide should see nothing rather than a
-- control that refuses them.
drop policy if exists "guides read their own grant" on public.local_guides;
create policy "guides read their own grant" on public.local_guides
  for select using (user_id = auth.uid());

create or replace function public.is_local_guide()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.local_guides where user_id = auth.uid()
  );
$function$;

-- ── what a photograph now carries ──

alter table public.place_photos
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

alter table public.place_photos
  add column if not exists created_at timestamptz not null default now();

-- The desk's own uploads and the importer's rows keep a null
-- `uploaded_by`: they were not taken by an account, and pretending
-- otherwise would put an editor's id on three thousand Google
-- photographs.

create index if not exists place_photos_uploaded_by_idx
  on public.place_photos (uploaded_by, created_at desc)
  where uploaded_by is not null;

-- ── the caps ──

create or replace function public.own_place_photos_today()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int from public.place_photos
  where uploaded_by = auth.uid()
    and created_at > now() - interval '1 day';
$function$;

create or replace function public.own_photos_on_place(target uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int from public.place_photos
  where uploaded_by = auth.uid()
    and place_id = target;
$function$;

-- ── the one new write path ──
--
-- Every clause is load-bearing:
--
--   is_local_guide()        the desk opened this door for this person
--   uploaded_by = auth.uid  a photograph cannot be filed under somebody
--                           else's name
--   source = 'upload'       'google' is the importer's word and carries
--                           attribution terms with it
--   not is_cover            phase one adds to the gallery; which picture
--                           stands for a place stays the desk's call
--   not is_hidden           a row cannot be written already hidden, which
--                           would be a way past the per-place cap
--   places.submitted_by     the place is theirs. Not "published", on
--                           purpose: somebody who has just imported a
--                           café and is looking at it while it waits at
--                           the desk is exactly who has the better
--                           photograph, and making them wait for approval
--                           to offer it is making them forget.
drop policy if exists "local guides add photos to their own places" on public.place_photos;
create policy "local guides add photos to their own places" on public.place_photos
  for insert to authenticated
  with check (
    is_local_guide()
    and uploaded_by = auth.uid()
    and source = 'upload'
    and is_cover = false
    and is_hidden = false
    and exists (
      select 1 from public.places p
      where p.id = place_id and p.submitted_by = auth.uid()
    )
    and public.own_place_photos_today() < 10
    and public.own_photos_on_place(place_id) < 5
  );

-- Taking one back. A photograph that appears the instant it is written
-- needs an undo that works the same way: somebody who picked the wrong
-- picture from a roll of forty must not have to write to the desk about
-- it. Bounded to their own rows, so this reaches nothing an editor
-- placed.
drop policy if exists "uploaders remove their own photos" on public.place_photos;
create policy "uploaders remove their own photos" on public.place_photos
  for delete to authenticated
  using (uploaded_by = auth.uid());

-- ── the file behind the row ──
--
-- Namespaced by uid, like avatars, for the same two reasons: one
-- person's uploads cannot collide with another's, and the policy can be
-- written against the first path segment without consulting any table.
-- Unlike an avatar this is not overwritten — a gallery keeps what it is
-- given — so each file gets its own name from the client.
drop policy if exists "local guides upload place photos" on storage.objects;
create policy "local guides upload place photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and is_local_guide()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "local guides delete their place photos" on storage.objects;
create policy "local guides delete their place photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── shut to the signed-out ──
--
-- Supabase grants EXECUTE on every new function to `anon` by name, and a
-- migration's `revoke ... from public` does not take that back — the
-- whole subject of `20260910150000_close_signed_in_functions_to_anon`,
-- and a rule `function_grants_test.sql` now enforces over every definer
-- function in this schema.
--
-- All three belong to the signed-in. Each is only ever reached from a
-- policy written `to authenticated`, so no policy evaluated for `anon`
-- needs EXECUTE on them — which is the one case that would force the
-- opposite, since a policy naming a role that lacks EXECUTE errors
-- rather than returning no rows.
revoke execute on function public.is_local_guide() from anon;
revoke execute on function public.own_place_photos_today() from anon;
revoke execute on function public.own_photos_on_place(uuid) from anon;
