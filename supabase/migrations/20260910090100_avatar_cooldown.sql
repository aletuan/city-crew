-- A face may change once a minute, not once a millisecond.
--
-- The avatar is one object per person, overwritten in place (see
-- `auth.tsx`, `setAvatar`), so there is no row per upload to count the
-- way the daily caps in `20260910090000_daily_caps.sql` count. What the
-- object does carry is `updated_at`, which Storage stamps on every
-- write — so the update policy reads the existing row and refuses a
-- second write inside sixty seconds of the last. A cooldown rather than
-- a cap: it stops a loop, and a person who picked the wrong photo is
-- back in a minute. The first upload is an insert and is not touched.
--
-- `using` is what sees the row being replaced; `with check` sees the
-- replacement, which carries a fresh stamp and would refuse everything
-- if the clock were read there.
--
-- Not run by the test harness, like `avatars_bucket.sql` before it: the
-- bench has no storage schema.

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and updated_at < now() - interval '60 seconds'
  )
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
