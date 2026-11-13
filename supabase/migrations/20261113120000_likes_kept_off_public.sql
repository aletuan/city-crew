-- A list's likes outlive its going private (owner, 13 Nov 2026).
--
-- ── the gap ──
--
-- A list that was public and gathered likes, then went to Friends or
-- Private, lost them from every screen at once: the heart on its card,
-- the number, and its Activity page. The rows in `collection_likes` were
-- never touched — nothing deletes a like when a list changes hands
-- between Public and Private — but all three readers asked `is_public`
-- first, so the likes were there and nobody could see them. The owner's
-- question, "where did my likes go?", had no answer in the app.
--
-- ── why the likes survive ──
--
-- A like is a reader's act on what the list was when they saw it, and
-- the list going private does not undo it. Deleting the rows on the way
-- to private would make visibility a one-way door: a curator who closed
-- a list for an afternoon to fix it would come back to zero. Keeping the
-- rows was already the database's answer; this makes the three reads
-- agree with it.
--
-- ── who sees what ──
--
-- `collection_like_counts()` widens from "public lists" to "public
-- lists, your own lists, and lists shared with you". A number and
-- nothing else, as it was: the function still returns ids and integers.
--
--   - The owner, because it is their list and their likes. Nothing the
--     count says is news to them that Activity does not say in full.
--   - A friend the list is shared with, because they are reading the
--     list now (`collection_shares`) and the count is a fact about it
--     that was public when it was made: every one of those likes was cast
--     on a list anybody could open. Telling a friend "twelve people liked
--     this" tells them less than the shelf told everyone a week ago.
--   - Nobody else. A stranger cannot open the list, and a count for a
--     list you cannot open is a count advertising nothing — the reason
--     the old filter gave, which still holds for them.
--
-- The names go only to the owner, as they always did: `likes_on_mine`
-- and `copies_of_mine` are keyed on `owner_id = auth.uid()` and that does
-- not change. A friend lent the list sees the number and never who; the
-- people who liked a public list did so in front of its curator, not in
-- front of whoever the curator later lends it to.
--
-- So `likes_on_mine` and `copies_of_mine` lose their `is_public` and keep
-- everything else: the owner's own acts left out, anybody the owner has
-- blocked left out, `since` as it was. The copy's own privacy is still
-- not opened — `copies_of_mine` says a copy was made and by whom, not
-- what is in it. The app offers "Save a copy" on a public list alone (a
-- friend's lent list has none, by the owner's call of 12 Nov), so a copy
-- reported on a list now private is one made while it was public.
--
-- ── why the heart stays public-only ──
--
-- The insert policy on `collection_likes` ("readers like public
-- collections", 20261017090000) is untouched: a new like still needs a
-- public list. A private list has no shelf, and a friend it is lent to
-- was given it to read (`collection_shares`, "Not like it"). So the app
-- draws the kept count on a Friends or Private list as a figure, not a
-- control — a live button there would send an insert this policy
-- refuses.
--
-- Rejected: letting a friend like a shared list. It would make likes on
-- a private list a thing that grows, which makes the count a measure of
-- one owner's circle rather than of the public, and every `others`
-- ranking assumption (`self_likes_shown_not_ranked`) was made about the
-- public. Not asked for, and not done.
--
-- ── `shared_with_me` from inside a definer function, as anon ──
--
-- `collection_like_counts` stays open to anon (the guest's Explore shelf
-- reads it; `function_grants_test.sql` lists it), and `shared_with_me` is
-- granted to the signed-in alone (20261112230000). That does not collide:
-- inside a `security definer` function the privilege check on a function
-- it calls is made as the definer function's owner, not as the caller,
-- so a guest's call reaches `shared_with_me` and gets false — its
-- `auth.uid()` is null. `likes_kept_off_public_test.sql` calls it as anon
-- to prove it.
--
-- Rejected: an inline `exists` on `collection_shares` instead of the
-- helper. The same plan, but a second spelling of "shared with me" that
-- could drift from the one the list's read policy uses.
--
-- ── what else still says "public only" ──
--
-- `suggested_friends()` (20261025120000) reads likes and copies of public
-- lists only, and its comment says a like on a list gone private stops
-- being a reason "the way it stops showing in Activity". The first half
-- stays true; the second is no longer how Activity behaves. Suggesting a
-- stranger to the owner because of a like on a list now private would be
-- a separate decision about friend suggestions, and is not made here.
--
-- ── grants ──
--
-- Same signatures, so `create or replace`, which keeps each function's
-- grants. They are stated again below anyway, as each function's last
-- migration stated them, so the file reads whole: the count to anon and
-- authenticated, the two feeds to authenticated alone.

create or replace function public.collection_like_counts()
returns table (collection_id uuid, likes integer, others integer)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id,
    count(*)::integer,
    -- `is distinct from`: desk lists have no owner, and `<>` against null
    -- would drop every like on them from the ranking. See 20261017090000.
    (count(*) filter (where l.user_id is distinct from c.owner_id))::integer
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  where c.is_public
     or c.owner_id = (select auth.uid())
     or public.shared_with_me(c.id)
  group by l.collection_id;
$$;

revoke all on function public.collection_like_counts() from public;
grant execute on function public.collection_like_counts() to anon, authenticated;

create or replace function public.likes_on_mine(since timestamptz)
returns table (collection_id uuid, liked_at timestamptz, liker_handle text, liker_name text)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at, p.handle, p.full_name
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.profiles p on p.id = l.user_id
  where c.owner_id = auth.uid()
    and l.user_id <> auth.uid()
    and l.created_at >= since
    and not exists (
      select 1 from public.blocks b
      where b.blocker = auth.uid() and b.blocked = l.user_id
    )
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_mine(timestamptz) from public, anon;
grant execute on function public.likes_on_mine(timestamptz) to authenticated;

create or replace function public.copies_of_mine(since timestamptz)
returns table (collection_id uuid, copied_at timestamptz, copier_handle text, copier_name text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, c.created_at, p.handle, p.full_name
  from public.collections c
  join public.collections o on o.id = c.copied_from
  left join public.profiles p on p.id = c.owner_id
  where o.owner_id = auth.uid()
    and c.owner_id is distinct from auth.uid()
    and c.created_at >= since
    and not exists (
      select 1 from public.blocks b
      where b.blocker = auth.uid() and b.blocked = c.owner_id
    )
  order by c.created_at desc;
$$;

revoke all on function public.copies_of_mine(timestamptz) from public, anon;
grant execute on function public.copies_of_mine(timestamptz) to authenticated;
