-- A list's owner's own like is a like (owner, 15 Nov 2026).
--
-- The card on a list's page counts every like on it. The page behind the
-- card — "View activity ›", and the figures behind that — left out the
-- owner's own, as Activity does: "somebody liked your list" is not news
-- about yourself. Activity is a feed of what others did; these two pages
-- are a count of the list. A list whose owner had liked it said ♥ 3 on
-- the card and named two people behind it, to the owner and, since that
-- morning's migration, to every reader.
--
-- So `likes_on_list` returns the owner's own like as a row, and
-- `collection_stats` counts it, all time and in the last seven days.
-- Both keep their names, arguments and return types, so they are
-- replaced in place and keep their grants (authenticated only).
--
-- What does not change:
--   - `likes_on_mine`, which Activity and its badge read, still leaves
--     the owner's own like out. Nobody is told they liked their own list.
--   - Copies. An owner's copy of their own list is still left out of
--     `copies_of_list` and of the figures: it is a second list of theirs,
--     not somebody taking the list up, and the card counts no copies to
--     disagree with.
--   - Blocks. A like by somebody the owner has blocked is still left out
--     of both, and the card's count does not read blocks — so the card
--     can still say one more than the page for an owner who has blocked a
--     liker. That gap is older than this one and is not closed here.
--
-- Rejected: taking the owner's own like off the card's count instead.
-- The heart on the card is also the button; an owner who pressed it
-- would watch it fill and the number stand still.

create or replace function public.likes_on_list(cid uuid)
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
