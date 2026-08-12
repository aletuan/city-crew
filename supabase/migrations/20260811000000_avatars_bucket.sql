-- Profile photos.
--
-- One public bucket, one object per person at `${auth.uid()}/avatar.jpg`,
-- overwritten on every change. Nothing accumulates, so nothing has to be
-- swept up later; the cost is a stable URL, which the app answers with a
-- ?v= stamp on the stored link so a changed face is not hidden by a cache.
--
-- Public read is deliberate: the app renders avatars straight from the URL,
-- and signing every one of them would buy nothing — the objects are only
-- reachable by a path that contains a UUID nobody can enumerate.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The app compresses to ~512px before upload, so 2 MB is headroom, not a
-- target: it is the wall that stops someone posting a 40 MB original.

drop policy if exists "avatars are readable by anyone" on storage.objects;
create policy "avatars are readable by anyone" on storage.objects
  for select using (bucket_id = 'avatars');

-- Writes are confined to a folder named after the caller's own uid. Without
-- this, any signed-in account could overwrite anyone else's face.
drop policy if exists "own avatar insert" on storage.objects;
create policy "own avatar insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
