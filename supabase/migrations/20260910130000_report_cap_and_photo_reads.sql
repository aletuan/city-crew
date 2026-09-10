-- Two policies that read as right and did nothing, both found by running
-- them as a client rather than reading them (see
-- supabase/tests/reports_rls_test.sql and likes_moderation_rls_test.sql).
--
-- ── the report cap counted nothing ──
--
-- "readers file reports" caps a reporter at twenty a day by counting
-- their own rows in a subquery. A subquery inside a policy runs as the
-- caller, under the caller's RLS — and a reporter cannot read reports at
-- all, their own included, on purpose (see `reports.sql`: a readable queue
-- would answer "who reported me"). So the count was always zero and the
-- cap never closed: thirty reports in a day went through on the bench, and
-- any account could fill the desk's queue without limit.
--
-- The count moves into a definer function, the way `trip_invite_count`
-- already reads invitations its caller cannot see. It answers only about
-- the caller — no argument names anybody — so it lends no reach: what it
-- reveals is how many reports you yourself filed today, which you knew.
--
-- ── the desk could not remove a photo ──
--
-- `place-photos` had insert, update and delete policies for editors and
-- no select. Postgres only updates or deletes rows the caller can select,
-- and Storage's own `remove` and overwrite go through the same rule, so
-- every removal the dashboard asked for — a deleted photo, a deleted
-- place — matched no row and reported no error. The files stayed; sixty-
-- three of them had no photo row pointing at them when this was written.
--
-- The bucket is public, so reading a file never needed a policy: the CDN
-- serves it. This select is only what lets an editor's delete and update
-- find the object. Editors only — a signed-in reader gains no listing of
-- the bucket.

create or replace function public.my_reports_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.reports r
   where r.reporter = auth.uid()
     and r.created_at > now() - interval '1 day';
$$;

revoke all on function public.my_reports_today() from public;
grant execute on function public.my_reports_today() to authenticated;

drop policy if exists "readers file reports" on public.reports;
create policy "readers file reports" on public.reports
  for insert with check (
    auth.uid() = reporter
    and status = 'new'
    and not (kind = 'profile' and target_id = auth.uid())
    and public.my_reports_today() < 20
  );

drop policy if exists "editors read place photos" on storage.objects;
create policy "editors read place photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'place-photos' and public.is_editor());
