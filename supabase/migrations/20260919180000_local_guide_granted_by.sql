-- Who opened the door, recorded without anybody having to remember to.
--
-- `local_guides.added_by` arrived with the table and has been null on every
-- row since, because the only thing writing to it was a hand-typed insert.
-- The desk gets a control for this now — a checkbox on the contributors
-- leaderboard — and a column that depends on the client remembering to
-- fill it is a column that is null half the time.
--
-- `auth.uid()` as a default resolves per insert, from the JWT of whoever
-- is signing the request. So the fact is recorded by the database at the
-- moment it becomes true, and the dashboard says nothing about it at all.
--
-- Not backfilled. The one existing row was granted by hand through this
-- session with no session of its own to name, and inventing an editor for
-- it would be worse than the null that honestly says "we did not record
-- this one".
alter table public.local_guides
  alter column added_by set default auth.uid();
