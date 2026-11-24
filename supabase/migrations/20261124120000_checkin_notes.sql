-- A check-in gets a line of words and an answer to "who can see it"
-- (owner, 24 Nov 2026).
--
-- The first cut was a row saying this account was at this place at this
-- instant and nothing else (`20261008130000_checkins.sql`, and
-- `app/src/lib/checkin.ts` for why). This is the next cut the header of
-- that file promised: a note. Not a photograph — that is user content
-- with its own storage and its own moderation, and it is last in
-- `docs/collection-feed-plan.md` for that reason.
--
-- ── `note` ──
--
-- Up to 280 characters, the length of a remark and not of a review. Null
-- rather than '' for none, so "has a note" is one test. Trimmed by the
-- app; the check refuses a note of nothing but spaces so the invitation
-- to write one ("What did you think of this place?") is not answered by
-- a slip of the thumb.
--
-- ── `audience` ──
--
-- 'private' or 'friends'. Two answers, not the collections' three: a
-- check-in says where a person was and when, and the plan's fifth
-- principle is that strangers see less than friends — there is no
-- 'public'.
--
-- NULL means the question was never answered, and reads as private. That
-- is every row written before today, and a row whose sheet never closed
-- (the app writes the row on the tap and the answer when the sheet goes,
-- so a friend never sees a visit its owner has not had the chance to
-- keep to themselves). NULL rather than a default of 'private' because
-- the app offers, as the answer for the next visit, the last one the
-- reader gave: a default would make every old row look like a choice of
-- Private, and the first new visit would open on it.
--
-- ── who reads ──
--
-- Still the owner alone. 'friends' is recorded here and honoured by the
-- migration that gives friends something to read it with — the card on a
-- person's page — together with the privacy policy's sentence about it.
-- Opening the read before there is a screen that says who sees what
-- would be a promise kept in the wrong order.
--
-- ── who writes ──
--
-- The owner, these two columns and no others: a visit's place and instant
-- are what happened and are not edited, only taken back (delete). The
-- column grant is the bound; the policy is the row's.

alter table public.checkins
  add column if not exists note text,
  add column if not exists audience text;

alter table public.checkins drop constraint if exists checkins_note_shape;
alter table public.checkins add constraint checkins_note_shape
  check (note is null or (char_length(note) <= 280 and btrim(note) <> ''));

alter table public.checkins drop constraint if exists checkins_audience_known;
alter table public.checkins add constraint checkins_audience_known
  check (audience is null or audience in ('private', 'friends'));

-- The table-wide UPDATE first taken away, then the two columns given.
-- `20261008130000_checkins.sql` granted select, insert and delete and no
-- update, and on a bare Postgres (the one `supabase/tests/run.sh` makes)
-- that is the whole of it. The live project is not bare: Supabase's
-- default privileges hand `anon` and `authenticated` every privilege on
-- every table made in `public` (seen on the project on 24 Nov 2026,
-- before this ran: UPDATE on `checkins` for both). It did nothing while
-- no update policy existed. With the policy below and without this
-- revoke, an owner could have moved a visit's `at` — and so walked round
-- the ten minutes and the three a day `may_check_in` counts — or its
-- place. A column grant does not narrow a table grant; it only adds.
revoke update on table public.checkins from anon, authenticated;
grant update (note, audience) on table public.checkins to authenticated;

drop policy if exists "owners edit their check-ins" on public.checkins;
create policy "owners edit their check-ins" on public.checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
