-- A curator may like their own list again; the shelf does not count it.
--
-- `20260821000000_own_collection_not_likeable.sql` refused the like
-- outright, for one reason: the shelf is ordered by these counts, and at
-- a handful of accounts one self-vote takes the front of it. The owner
-- (17 Oct 2026) asked for the heart to behave as it does everywhere else
-- — on your own list too, at any count — and chose to keep the ranking
-- honest a different way: the like is cast and shown, and the order is
-- taken from everybody else's.
--
-- So the two things the old rule did at once are now done apart:
--
--   1. The insert policy loses its owner clause. A like is still yours to
--      cast and nobody else's, and still only on a public list.
--   2. `collection_like_counts()` returns a second figure, `others`: the
--      likes from anyone but the list's owner. `likes` stays the total —
--      what the heart beside it prints — and `others` is what the app
--      sorts the shelf by.
--
-- ── what `others` gives away ──
--
-- `likes - others` is 1 exactly when the owner has liked their own list.
-- That is a fact about the owner and their own work, and the heart they
-- tapped is visible on their own screens anyway; it says nothing about
-- any other reader. The rule that matters — nobody may learn who the
-- other likers are — is untouched: the function still returns ids and
-- integers and nothing that names a person.
--
-- ── `is distinct from`, again ──
--
-- Desk lists carry `owner_id is null`. `l.user_id <> c.owner_id` is null
-- for every one of them, and a `filter` treats null as false — so every
-- like on every editorial list would vanish from the ranking. The same
-- operator the old policy needed, for the same reason.
--
-- ── the applause feed ──
--
-- `likes_on_mine` already leaves out `l.user_id = auth.uid()`, so liking
-- your own list does not tell you that you liked it. Nothing to change.

drop policy if exists "readers like public collections" on public.collection_likes;
create policy "readers like public collections" on public.collection_likes
  for insert with check (
    -- Still yours to cast and nobody else's: without this a like can be
    -- filed under another name, which turns a count into a forgery.
    -- `(select …)`, asked once per statement: see 20260927120000_rls_ask_once.
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.collections c
      where c.id = collection_id
        -- A private list has no shelf, and nobody else can see it to like.
        and c.is_public
    )
  );

-- The return type changes, which `create or replace` cannot do, so the
-- function is dropped and made again in one transaction, grants and all.
-- `likes` keeps its name and position: a build still on the old bundle
-- reads exactly what it read before.
drop function if exists public.collection_like_counts();

create function public.collection_like_counts()
returns table (collection_id uuid, likes integer, others integer)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id,
    count(*)::integer,
    (count(*) filter (where l.user_id is distinct from c.owner_id))::integer
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  where c.is_public
  group by l.collection_id;
$$;

revoke all on function public.collection_like_counts() from public;
grant execute on function public.collection_like_counts() to anon, authenticated;
