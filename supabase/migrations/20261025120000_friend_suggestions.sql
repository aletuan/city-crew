-- Friend suggestions from four things two people did, each with its reason.
--
-- ── the gap ──
--
-- `suggested_friends()` knew one thing: places two people both hold in
-- public lists. Measured on the live project on 25 Oct 2026, 10 of 50
-- accounts have a public list, so 40 can never be suggested to anyone
-- and never see a suggestion; 6 saw one each. Meanwhile the app already
-- holds stronger signals that it never used: 11 accounts have liked a
-- list, 3 have copied one, 9 have checked in somewhere. The owner's call
-- (25 Oct): use all four, and let a reader put one away with an ×.
--
-- ── the four, in the order they rank ──
--
--   1. `liked_yours`, `copied_yours` — they liked or copied a public list
--      of yours. Activity already tells the owner exactly this
--      (`likes_on_mine`, `copies_of_mine`), so naming it here says
--      nothing new; it is the strongest sign there is that they would
--      want to hear from you.
--   2. `you_liked`, `you_copied` — you liked or copied a public list of
--      theirs. Your own act, read back to you.
--   3. `saves` — places in any list of yours, private ones included, that
--      sit in a public list of theirs. Counting the reader's private
--      lists takes the reach from 6 accounts to 9; it tells the reader
--      nothing about anybody else, only which public lists overlap what
--      they keep, which they could find by browsing.
--   4. `visits` — places you checked in at that sit in a public list of
--      theirs. Check-ins are read only as the caller's own, as above.
--
-- Their side is only ever public: a list of theirs that is private, or a
-- place in it that is not live, is in no reason. A like or copy of a list
-- that has since gone private stops being a reason, the way it stops
-- showing in Activity.
--
-- Each person appears once, under their strongest reason: lowest rank,
-- then the larger count, then the most recent act. `n` is the count of
-- places for `saves` and `visits` and 1 for the acts; `collection_id` is
-- the list a like or copy was about (the most recent one), so the row can
-- name it, and null for the counts.
--
-- ── putting one away ──
--
-- `suggestion_dismissals` holds who a reader put away, theirs to read,
-- add to and take back, and nobody else's: the person dismissed is never
-- told, as a block is never told. Forever rather than for a season — a
-- reader who said no should not have to say it twice; a reason to meet
-- them again is a request, which the field above already offers.
--
-- ── why a definer ──
--
-- For `suggested_friends`' reason: the likes, copies and lists it reads
-- are other people's rows, and no reader's select policy reaches them.
-- Every branch is pinned to `auth.uid()`, and the answer names only
-- people and the reader's own or public lists.
--
-- `suggested_friends()` stays until the app reads this one; it is dropped
-- in the migration after.

create table if not exists public.suggestion_dismissals (
  user_id    uuid not null references auth.users(id) on delete cascade,
  other      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, other),
  check (user_id <> other)
);

comment on table public.suggestion_dismissals is
  'People a reader put away from their friend suggestions. The reader''s own rows only; see 20261025120000_friend_suggestions.';

alter table public.suggestion_dismissals enable row level security;
revoke all on public.suggestion_dismissals from public, anon;
grant select, insert, delete on public.suggestion_dismissals to authenticated;

drop policy if exists "readers read their dismissals" on public.suggestion_dismissals;
create policy "readers read their dismissals" on public.suggestion_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "readers dismiss for themselves" on public.suggestion_dismissals;
create policy "readers dismiss for themselves" on public.suggestion_dismissals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "readers take a dismissal back" on public.suggestion_dismissals;
create policy "readers take a dismissal back" on public.suggestion_dismissals
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.friend_suggestions()
returns table(other uuid, reason text, collection_id uuid, n integer)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  -- Live places in public lists, by owner: the only side of anybody
  -- else this function reads.
  shown as (
    select c.owner_id, cp.place_id
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    join public.places p on p.id = cp.place_id
    where c.is_public and c.owner_id is not null
      and p.is_published and p.review_status = 'approved'
  ),
  reasons as (
    select l.user_id as other, 'liked_yours'::text as reason, 1 as rank,
           c.id as collection_id, 1 as n, l.created_at as at
    from public.collection_likes l
    join public.collections c on c.id = l.collection_id
    where c.owner_id = (select id from me) and c.is_public
    union all
    select k.owner_id, 'copied_yours', 1, o.id, 1, k.created_at
    from public.collections k
    join public.collections o on o.id = k.copied_from
    where o.owner_id = (select id from me) and o.is_public
      and k.owner_id is not null
    union all
    select c.owner_id, 'you_liked', 2, c.id, 1, l.created_at
    from public.collection_likes l
    join public.collections c on c.id = l.collection_id
    where l.user_id = (select id from me) and c.is_public
      and c.owner_id is not null
    union all
    select o.owner_id, 'you_copied', 2, o.id, 1, k.created_at
    from public.collections k
    join public.collections o on o.id = k.copied_from
    where k.owner_id = (select id from me) and o.is_public
      and o.owner_id is not null
    union all
    select s.owner_id, 'saves', 3, null::uuid, count(distinct s.place_id)::integer, null::timestamptz
    from shown s
    where s.place_id in (
      select cp.place_id
      from public.collection_places cp
      join public.collections c on c.id = cp.collection_id
      where c.owner_id = (select id from me)
    )
    group by s.owner_id
    union all
    select s.owner_id, 'visits', 4, null::uuid, count(distinct s.place_id)::integer, null::timestamptz
    from shown s
    where s.place_id in (
      select ch.place_id from public.checkins ch where ch.user_id = (select id from me)
    )
    group by s.owner_id
  ),
  best as (
    select distinct on (r.other) r.other, r.reason, r.rank, r.collection_id, r.n, r.at
    from reasons r
    where r.other <> (select id from me)
    order by r.other, r.rank, r.n desc, r.at desc nulls last
  )
  select b.other, b.reason, b.collection_id, b.n
  from best b
  -- A suggestion is a face and a handle; an account without a profile
  -- has neither to show.
  join public.profiles pr on pr.id = b.other
  -- No reader, no rows: every branch above is pinned to the caller, and
  -- each comparison with a null caller is null.
  where not exists (
      select 1 from public.friendships f
      where least(f.requester, f.addressee) = least((select id from me), b.other)
        and greatest(f.requester, f.addressee) = greatest((select id from me), b.other)
    )
    and not exists (
      select 1 from public.suggestion_dismissals d
      where d.user_id = (select id from me) and d.other = b.other
    )
    and not public.is_blocked_pair((select id from me), b.other)
  order by b.rank, b.n desc, b.at desc nulls last, b.other
  limit 10;
$$;

revoke all on function public.friend_suggestions() from public, anon;
grant execute on function public.friend_suggestions() to authenticated;
