-- A curator cannot like their own list.
--
-- This reverses the call made in `20260819120000_collection_likes.sql`,
-- which allowed it deliberately and said so at length. The argument
-- recorded there for allowing it — that the gesture belongs to everyone,
-- and a heart that does nothing is a rule the reader has to learn from a
-- control — was heard and has been decided the other way round. The shelf
-- is ordered by these counts, and a count that includes the author's own
-- vote is not a reading of what other people preferred.
--
-- At the present size that is not a rounding error. There are nine lists
-- with an owner and a handful of accounts; a single self-like is enough to
-- move a list to the front of a shelf that claims to show what readers
-- chose.
--
-- ── nothing to clean up ──
--
-- `collection_likes` holds no rows at all, so this is a policy change and
-- not a migration of data. Checked before writing it rather than assumed:
-- had there been self-likes already cast under the old rule, they would
-- have needed deleting here, because a count left standing that the rule
-- now forbids is a wrong number that nothing would ever correct.
--
-- ── `is distinct from`, and why it is not `<>` ──
--
-- This is the whole risk in the change. Fifteen of the twenty-four
-- collections are the desk's, and those carry `owner_id is null`. Written
-- as `c.owner_id <> auth.uid()` the clause evaluates to NULL for every one
-- of them — not false, but not true either, which a `with check` treats as
-- refusal. The result would be a heart that silently fails on every
-- editorial list on the shelf: the fifteen most visible lists in the app,
-- broken by an operator that looks correct.
--
-- `is distinct from` is null-aware and answers "not mine" rather than
-- "known not to be mine", which is the question actually being asked.

drop policy if exists "readers like public collections" on public.collection_likes;
create policy "readers like public collections" on public.collection_likes
  for insert with check (
    -- Still yours to cast and nobody else's: without this a like can be
    -- filed under another name, which turns a count into a forgery.
    auth.uid() = user_id
    and exists (
      select 1 from public.collections c
      where c.id = collection_id
        -- A private list has no shelf to be ordered on.
        and c.is_public
        -- And not your own. Null owner means the desk wrote it, which is
        -- nobody's own — see the note above on why this is not `<>`.
        and c.owner_id is distinct from auth.uid()
    )
  );

-- The delete policy is untouched on purpose. Taking back a like you
-- somehow hold has to keep working whatever the insert rule says, or a row
-- cast under an older rule would be stuck to its author forever.
