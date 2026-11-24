-- Two files a person, by name: `<uid>/avatar.jpg` and `<uid>/wall.jpg`
-- (owner, 24 Nov 2026).
--
-- ── the hole ──
--
-- The bucket's write policies (`20260811000000_avatars_bucket.sql`,
-- `20260910090100_avatar_cooldown.sql`) asked one question of a path:
-- is its folder the caller's uid? Not what the file is called. The app
-- only ever writes the two names (`lib/auth`, `uploadOwnPhoto`), but a
-- signed-in account talking to Storage directly could put any number of
-- 2 MB files in its folder, under any names, in a bucket anyone may read
-- — image hosting on this project's domain and bill, for whatever
-- somebody wanted hosted. Found while weighing photographs on check-ins,
-- which every account would upload; that bucket will be private, and
-- this one should not have been the open door beside it.
--
-- Checked on the live project before this ran: 31 `avatar.jpg` and 2
-- `wall.jpg`, each in its owner's folder, all `image/jpeg`, the largest
-- 374,007 bytes. Nothing else to clean up.
--
-- ── the fix ──
--
-- Insert and update name the two paths outright, so a third file cannot
-- be written and an existing one cannot be renamed into a third. The
-- minute's cooldown on a replacement stays as it was. Delete stays
-- folder-wide: taking down your own file harms nobody, and a stray file
-- from before this, had there been one, should be removable by its
-- owner.
--
-- And only JPEG: the app writes nothing else (`SaveFormat.JPEG`), and
-- every object in the bucket is one. Storage checks the type a client
-- *declares*, not the bytes, so this narrows what can be claimed rather
-- than what can be sent; the names are what bound the damage. 2 MB is
-- kept: five times the largest wall.
--
-- `(select auth.uid())`: see `_rls_ask_once.sql`.

update storage.buckets set allowed_mime_types = array['image/jpeg'] where id = 'avatars';

drop policy if exists "own avatar insert" on storage.objects;
create policy "own avatar insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name in ((select auth.uid())::text || '/avatar.jpg', (select auth.uid())::text || '/wall.jpg')
  );

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and name in ((select auth.uid())::text || '/avatar.jpg', (select auth.uid())::text || '/wall.jpg')
    and updated_at < now() - interval '60 seconds'
  )
  with check (
    bucket_id = 'avatars'
    and name in ((select auth.uid())::text || '/avatar.jpg', (select auth.uid())::text || '/wall.jpg')
  );
