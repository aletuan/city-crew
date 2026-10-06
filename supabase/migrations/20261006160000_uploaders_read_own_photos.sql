-- An uploader's delete can find their own file.
--
-- ── the same trap, one role over ──
--
-- The 10 Sep migration found that `place-photos` had delete policies and
-- no select, and that Postgres only deletes rows the caller can select —
-- Storage's `remove` included — so every removal the desk asked for
-- matched nothing and said nothing. It added the editor's select and
-- stopped there, because the editor was the only one removing files.
--
-- Then local guides were given a gallery (19 Sep) with a delete policy
-- over their own folder and, again, no select over it. So the app never
-- asked Storage to remove a file when a guide took a photograph back —
-- and if it had, the remove would have found nothing. The row went, the
-- file stayed; fifty-six such files were swept out on 6 Oct 2026, most
-- of them left this way (see `prune-photos`).
--
-- ── the policy ──
--
-- Select over one's own folder, and nothing wider. The bucket is public,
-- so this grants no reading that the CDN was not already doing; it only
-- lets a guide's delete — and nothing else, since their delete policy is
-- already bounded to the folder — find the object it names. A guide
-- gains no listing of anyone else's uploads, and no listing of the
-- `<slug>/` folders the imports write to.
--
-- The app now removes the file after the row (`removePlacePhoto`), and
-- takes an uploaded file back out when its insert is refused
-- (`useAddPhoto`). Both are best effort; this is what lets them work.

drop policy if exists "local guides read their own place photos" on storage.objects;
create policy "local guides read their own place photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
