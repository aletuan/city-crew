-- A list's activity is its readers' to see, not its owner's alone
-- (owner, 15 Nov 2026).
--
-- ── what changes ──
--
-- "View activity ›" on a list's card opened a page of who liked it and
-- who saved a copy, with a row of figures behind it, and drew for the
-- list's owner only. The app said why in a comment: "Threads draws its
-- 'View activity' the same way and to the author alone." It does not —
-- the owner sent a screenshot of the link on somebody else's post, and
-- of the page it opens — and asked for the same here: whoever can read
-- the list reads its activity, all of it, as the author does.
--
-- So three things answer a reader now:
--
--   likes_on_list(cid)    who liked this list, newest first
--   copies_of_list(cid)   who saved a copy of it, newest first
--   collection_stats(cid) its eight figures (already there; opened)
--
-- ── who is a reader ──
--
-- The same test `record_collection_view` applies to count an open: the
-- list is public, or the caller's own, or shared with the caller
-- (`shared_with_me`). A list the caller cannot open has no activity to
-- show them, and all three answer nothing — not an error, as
-- `collection_stats` already did for a stranger.
--
-- Signed in only. A guest reads a public list but is shown no link: the
-- page is a list of people with a friend button on each row, which a
-- guest cannot press, and names handed to anybody without an account
-- are a scrape. `anon` has no grant on any of the three.
--
-- ── the same answer the author gets ──
--
-- "As the author" is the rule, so the filters are the owner's, written
-- against the list's owner where they were written against the caller:
-- the owner's own like and own copy left out, and anybody the owner has
-- blocked left out. For the owner that is `likes_on_mine`'s answer for
-- this list, row for row, and `collection_stats`' figures as they were.
--
-- One filter is the reader's own, and only on the two lists of people:
-- a row by somebody the reader has blocked, or who has blocked the
-- reader, is left out. A block is a promise that the two do not meet in
-- the app, and a third person's list is not a way round it. The figures
-- do not move for it: a count names nobody, and a figure that changed
-- with who was asking would tell a reader they had been blocked.
--
-- ── what a reader learns that they could not, and the one promise in
--    the way ──
--
-- Who liked a list, who copied it, and its figures. The policy
-- (`app/src/lib/legal.ts`) is changed in the same commit, as it binds:
--
--   - the opens and the trips were "shown only to the list's author" —
--     numbers, naming nobody, and now a reader's too;
--   - a like on a list was never promised to anybody in particular, and
--     is now said to be listed by name;
--   - a copy was promised: "its curator can see that a copy was made and
--     by whom". Everybody who has saved a copy did it under that
--     sentence, and a new sentence cannot reach back to them.
--
-- So a reader is told of the copies made from 16 Nov 2026 on, Vietnam's
-- day — the first whole day after the policy that says so — and the
-- owner of every copy, as before. The count in the figures is every
-- copy's, since a number names nobody. The copy itself stays unnamed and
-- unreadable unless its own owner publishes it.
--
-- Rejected: all copies to every reader, which is what was first asked
-- for and is one line shorter. It would show people who were told they
-- would be shown to one curator only.
--
-- ── why new functions and not the old ones opened ──
--
-- `likes_on_mine(since)` and `copies_of_mine(since)` answer for every
-- list the caller owns, and Activity and the unread dot read them that
-- way. A reader's question is about one list that is not theirs: a
-- different question, so a different function, and the owner's two are
-- left as they stand — nothing that reads them changes.
--
-- Rejected: one `list_activity(cid)` returning both kinds. The app
-- already has a row type for each (`Applause`, `Copy`) and a merge that
-- takes the two (`actsOn`); the same shapes mean the page draws a
-- reader's rows with the code that draws the owner's.
--
-- `collection_stats` keeps its name and its return type, so it is
-- replaced in place and keeps its grants.

create function public.likes_on_list(cid uuid)
returns table (
  collection_id uuid, liked_at timestamptz, liker_handle text, liker_name text,
  liker_id uuid, liker_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at, p.handle, p.full_name, p.id, p.avatar_url
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.profiles p on p.id = l.user_id
  where c.id = cid
    and (c.is_public or c.owner_id = auth.uid() or public.shared_with_me(c.id))
    and l.user_id is distinct from c.owner_id
    and not exists (
      select 1 from public.blocks b
      where b.blocker = c.owner_id and b.blocked = l.user_id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = l.user_id)
         or (b.blocker = l.user_id and b.blocked = auth.uid())
    )
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_list(uuid) from public, anon;
grant execute on function public.likes_on_list(uuid) to authenticated;

create function public.copies_of_list(cid uuid)
returns table (
  collection_id uuid, copied_at timestamptz, copier_handle text, copier_name text,
  copier_id uuid, copier_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, c.created_at, p.handle, p.full_name, p.id, p.avatar_url
  from public.collections c
  join public.collections o on o.id = c.copied_from
  left join public.profiles p on p.id = c.owner_id
  where o.id = cid
    and (o.is_public or o.owner_id = auth.uid() or public.shared_with_me(o.id))
    -- The owner, every copy; a reader, the ones made under the policy
    -- that says a reader would see them — see the header.
    and (o.owner_id = auth.uid() or c.created_at >= timestamptz '2026-11-16 00:00:00+07')
    and c.owner_id is distinct from o.owner_id
    and not exists (
      select 1 from public.blocks b
      where b.blocker = o.owner_id and b.blocked = c.owner_id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = c.owner_id)
         or (b.blocker = c.owner_id and b.blocked = auth.uid())
    )
  order by c.created_at desc;
$$;

revoke all on function public.copies_of_list(uuid) from public, anon;
grant execute on function public.copies_of_list(uuid) to authenticated;

-- The figures, for whoever can read the list. The body is
-- `20261113160000_collection_stats`'s with two changes and no other: the
-- last line's `c.owner_id = auth.uid()` is the reader's test, and the
-- likes' and copies' filters name the list's owner where they named the
-- caller — the same rows left out, whoever asks.
create or replace function public.collection_stats(cid uuid)
returns table (
  views_total integer, views_7d integer,
  likes_total integer, likes_7d integer,
  copies_total integer, copies_7d integer,
  trips_total integer, trips_7d integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.total::integer, v.recent::integer,
    l.total::integer, l.recent::integer,
    k.total::integer, k.recent::integer,
    t.total::integer, t.recent::integer
  from public.collections c
  cross join lateral (
    select coalesce(sum(cv.views), 0) as total,
           coalesce(sum(cv.views) filter (
             where cv.day > (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7
           ), 0) as recent
    from public.collection_views cv
    where cv.collection_id = c.id
  ) v
  cross join lateral (
    select count(*) as total,
           count(*) filter (where cl.created_at >= now() - interval '7 days') as recent
    from public.collection_likes cl
    where cl.collection_id = c.id
      and cl.user_id is distinct from c.owner_id
      and not exists (
        select 1 from public.blocks b
        where b.blocker = c.owner_id and b.blocked = cl.user_id
      )
  ) l
  cross join lateral (
    select count(*) as total,
           count(*) filter (where cc.created_at >= now() - interval '7 days') as recent
    from public.collections cc
    where cc.copied_from = c.id
      and cc.owner_id is distinct from c.owner_id
      and not exists (
        select 1 from public.blocks b
        where b.blocker = c.owner_id and b.blocked = cc.owner_id
      )
  ) k
  cross join lateral (
    select count(*) as total,
           count(*) filter (where tr.created_at >= now() - interval '7 days') as recent
    from public.trip_collections tc
    join public.trips tr on tr.id = tc.trip_id
    where tc.collection_id = c.id
  ) t
  where c.id = cid
    and (c.is_public or c.owner_id = auth.uid() or public.shared_with_me(c.id));
$$;

revoke all on function public.collection_stats(uuid) from public, anon;
grant execute on function public.collection_stats(uuid) to authenticated;
