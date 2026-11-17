-- A list shared with friends can be liked by the people it is shared
-- with, and by its owner (owner, 17 Nov 2026).
--
-- ── what was, and what was asked ──
--
-- A new like needed a public list ("readers like public collections",
-- 20261017090000). A list that went from Public to Friends kept the
-- likes it had (20261113120000) and could gain none: its heart was a
-- figure, not a button. That migration wrote the alternative down as
-- rejected — "letting a friend like a shared list … Not asked for, and
-- not done."
--
-- It is asked for now. The owner's own example: a list is public and
-- gathers likes; it keeps them; it is shared with a group; the friends
-- in the group like it too; the number goes on growing. A group the
-- list is read in is a place to say you like it.
--
-- ── who may like what ──
--
--   public list                 anybody signed in, as before
--   shared with friends         the friends it is shared with, and its
--                               owner (who may like their own list
--                               anywhere else, 20261017090000)
--   private, shared with nobody nobody — only its owner can open it, and
--                               a heart only you can press is a count of
--                               yourself. It still shows what it kept.
--
-- "Shared with me" is the helper the list's read policy asks
-- (`shared_with_me`), so who may like a shared list is exactly who may
-- read it. The owner's half asks the share table directly: a list of
-- yours with at least one share.
--
-- A public list that is also shared is public, as everywhere.
--
-- ── what was weighed against it ──
--
-- The rejection's reason was the ranking: `others`, the likes from
-- anyone but the owner, orders the public shelf, and a like cast inside
-- a circle of friends is not the public's. It stays true and is accepted:
-- a list is only ranked while it is public, a friend's like there would
-- have counted anyway, and the case it changes is a list that gathers
-- likes in a group and is then published — it arrives on the shelf with
-- its friends' likes. The same as a list published to friends first on
-- any social app.
--
-- ── who sees a like made here ──
--
-- Nothing new. The count goes to the owner and the friends the list is
-- shared with (`collection_like_counts`), and the names to the same
-- people on the list's activity page (`20261115090000`), which the
-- privacy policy already says of every like: "for anyone signed in who
-- can open the collection".
--
-- A like outlives the share it was cast under, as it outlives the list
-- going private: unsharing does not delete it, and the friend can no
-- longer reach the list to take it back. The same trade the kept likes
-- already make.
--
-- ── the roles ──
--
-- The policy stays for every role, as it was. A guest's insert is
-- refused before or at `shared_with_me`, which anon may not execute —
-- refused either way.

drop policy if exists "readers like public collections" on public.collection_likes;
drop policy if exists "readers like lists they can read with others" on public.collection_likes;
create policy "readers like lists they can read with others" on public.collection_likes
  for insert with check (
    -- Still yours to cast and nobody else's.
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (
          c.is_public
          or public.shared_with_me(c.id)
          or (
            c.owner_id = (select auth.uid())
            and exists (select 1 from public.collection_shares s where s.collection_id = c.id)
          )
        )
    )
  );
