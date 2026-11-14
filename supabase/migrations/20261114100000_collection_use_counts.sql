-- How the public lists were used, for the order they are shown in
-- (owner, 14 Nov 2026).
--
-- `docs/collection-ranking.md` is the argument. A public shelf was
-- ordered by likes and then by date; it is ordered now by five signals,
-- and two of them are facts only this database holds and only a list's
-- owner could read (`collection_stats`): how many people built on a
-- list, and how often it is opened. The app ranks on the phone
-- (`app/src/lib/listRank.ts`), for every reader, a guest included, so
-- the totals have to reach every reader. This function is how.
--
-- ── what it answers ──
--
-- One row per public list, and three numbers:
--
--   uses   people other than its owner who started a trip from it
--          (`trip_collections`), plus people other than its owner who
--          saved a copy (`collections.copied_from`). People, not rows:
--          one reader who plans five evenings from a list is one reader
--          who found it useful, and counting the evenings would let one
--          account carry a list up a shelf. The owner's own are left
--          out, as their own like is left out of the ranking count
--          (`collection_like_counts.others`).
--   views  every open ever counted (`collection_views`), the owner's
--          own and repeats included: the table cannot tell them apart,
--          by design.
--   liked  likes from anyone but the owner, since opens were first
--          counted — the likes those opens could have led to.
--
-- ── views rank now, and the line that said to come back ──
--
-- `20261113160000_collection_stats` accepted that anyone can raise a
-- list's opens by opening it again, on the ground that "nothing ranks by
-- it", and said: "If views ever rank anything, this is the line to
-- revisit." This is the revisit. The app does not rank on `views`. It
-- ranks on `liked / views`, for a list with twenty opens or more: likes
-- per open. An author who opens their own list again and again lowers
-- that figure and cannot raise it, so the count is still not worth
-- inflating and the table still does not need to know who opened what.
--
-- Accepted with it: a reader can lower somebody else's rate the same
-- way, by opening their list and never liking it. The term is a tenth
-- of the score, and stopping it would need the identity the counter is
-- built not to hold.
--
-- ── why `liked` starts on 13 November 2026 ──
--
-- Opens have been counted since that day, when the counter was made, and
-- likes for two months before it. A rate of all a list's likes over the
-- opens since the 13th would hand every old list a rate no new list
-- could reach: eleven likes gathered since September over twenty opens
-- this week. So the likes counted are the ones from the same days as the
-- opens, by Vietnam's calendar, as the counter files them. The date is
-- written out and not read off `min(day)`: it is a fact about when
-- counting began, and an empty counter should not move it.
--
-- Not a pure conversion: a heart can be tapped on a shelf's card without
-- the list being opened, so `liked` can pass `views`. The app caps
-- nothing and measures each list against the best rate on its shelf.
--
-- ── who may ask, and what they learn ──
--
-- Everybody, signed in or not: the order of a public shelf is not a
-- private fact. What comes back is totals for lists anyone can already
-- read, and never who: not who opened, not who planned, not who copied.
-- A private list has no row, whoever asks, its owner included; the
-- owner's own figures are `collection_stats`', with its own exclusions.
--
-- No blocks are read here, where `collection_stats` reads the owner's:
-- that figure is drawn for one person and leaves out the people they
-- blocked, and this one is the same for every reader, so there is no
-- one whose blocks could apply.
--
-- `legal.ts` said both numbers were shown only to a list's author. They
-- still are shown only there; the same change adds that the app orders
-- public lists by them.
--
-- By slug, not id: the app keys its shelves by slug (`lib/listRank`),
-- and `collection_like_counts`, which answers ids, costs its caller a
-- second read to turn them into slugs.

create or replace function public.collection_use_counts()
returns table (slug text, uses integer, views integer, liked integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.slug,
    (
      (select count(distinct tr.owner_id)
         from public.trip_collections tc
         join public.trips tr on tr.id = tc.trip_id
        where tc.collection_id = c.id
          and tr.owner_id is distinct from c.owner_id)
      +
      (select count(distinct cc.owner_id)
         from public.collections cc
        where cc.copied_from = c.id
          and cc.owner_id is distinct from c.owner_id)
    )::integer,
    (select coalesce(sum(cv.views), 0)
       from public.collection_views cv
      where cv.collection_id = c.id)::integer,
    (select count(*)
       from public.collection_likes cl
      where cl.collection_id = c.id
        and cl.user_id is distinct from c.owner_id
        and (cl.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= date '2026-11-13')::integer
  from public.collections c
  where c.is_public;
$$;

revoke all on function public.collection_use_counts() from public;
grant execute on function public.collection_use_counts() to anon, authenticated;
