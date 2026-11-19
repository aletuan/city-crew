-- What happened to you in comments: the rows the Activity screen draws
-- (docs/comments-plan.md, "Về thông báo" and C7a).
--
-- Four things are news, each to exactly one reader:
--
--   tag      somebody tagged you in a comment
--   reply    somebody answered a comment of yours
--   on_list  somebody commented on a list of yours
--   heart    somebody liked a comment of yours
--
-- ── no table of notifications ──
--
-- The usual build writes a row to a `notifications` table when the thing
-- happens. Not taken: the rest of Activity "holds what still stands" — a
-- like taken back leaves no line — and a written row would have to be
-- found and removed on every delete, every heart withdrawn, every block,
-- every list made private, with one miss leaving a line that opens
-- nothing. So the rows are worked out when they are read, from the
-- comments, tags and hearts themselves, and nothing can point at what is
-- gone. The price is that no row can be marked read; what is new is the
-- phone's to know (C7c). Push (C11) will need a record of what was sent,
-- and the question is opened again there.
--
-- ── the rules, as the plan numbers them ──
--
-- 1. One comment, one reader, one row — by the strongest reason: a tag,
--    then a reply, then "on your list".
-- 2. A reply is news to the writer of the comment it answers, and to
--    nobody else in the thread.
-- 3. Hearts are gathered by comment: one row a liked comment, carrying
--    the latest liker, how many others, and the time of the latest.
-- 4. Nothing of your own, and nothing across a block.
-- 5. Only what a reader could open: a comment the thread would show them
--    (`comments_seen` — a public list, nobody blocked on the way down).
--
-- The window is the caller's (`p_since`; the app sends its two weeks),
-- held to 31 days so that no caller can ask for everything; newest
-- first, 200 at most — more than a screen of Activity has ever held.
--
-- Each row names the list as the app reads a name (`list`: id, slug and
-- the title in each language it has), built from the row as JSON so a
-- language column added later needs no change here.
--
-- A liker is named to the writer of the comment, and to nobody else —
-- as `likes_on_mine` names a list's likers to its owner (owner, 19 Nov
-- 2026). In the thread a heart is still only a number.
create or replace function public.comment_news(p_since timestamptz)
returns table (
  kind text, comment_id uuid, list jsonb,
  actor uuid, handle text, full_name text, avatar_url text,
  body text, at timestamptz, others integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select (select auth.uid()) as id),
  since as (select greatest(p_since, now() - interval '31 days') as t),
  -- Comments by somebody else that are news to the caller, with why.
  said as (
    select c.id, c.collection_id, c.author, c.body, c.created_at,
           case
             when exists (select 1 from public.comment_mentions mn
                           where mn.comment_id = c.id and mn.person_id = me.id) then 'tag'
             when par.author = me.id then 'reply'
             else 'on_list'
           end as kind
      from me, since, public.comments c
      join public.collections col on col.id = c.collection_id
      left join public.comments par on par.id = c.parent_id
     where me.id is not null
       and c.author <> me.id
       and c.created_at >= since.t
       and (col.owner_id = me.id
            or par.author = me.id
            or exists (select 1 from public.comment_mentions mn
                        where mn.comment_id = c.id and mn.person_id = me.id))
  ),
  -- Hearts by somebody else on the caller's comments, latest first.
  liked as (
    select c.id, c.collection_id, c.body, l.user_id, l.created_at,
           row_number() over (partition by c.id order by l.created_at desc, l.user_id) as k,
           count(*) over (partition by c.id) as n
      from me, since, public.comment_likes l
      join public.comments c on c.id = l.comment_id
     where me.id is not null
       and c.author = me.id
       and l.user_id <> me.id
       and l.created_at >= since.t
       and not public.is_blocked_pair(me.id, l.user_id)
  ),
  rows as (
    select s.kind, s.id, s.collection_id, s.author as actor, s.body, s.created_at as at, 0 as others
      from said s
    union all
    select 'heart', h.id, h.collection_id, h.user_id, h.body, h.created_at, (h.n - 1)::integer
      from liked h
     where h.k = 1
  ),
  -- Rule 5: only what the thread would show this reader.
  seen as (
    select v.id from public.comments_seen(array(select distinct r.collection_id from rows r)) v
  )
  select r.kind, r.id,
         (select jsonb_build_object(
                   'id', col.id, 'slug', col.slug,
                   'title_en', j -> 'title_en', 'title_vi', j -> 'title_vi', 'title_ja', j -> 'title_ja')
            from public.collections col, to_jsonb(col) j
           where col.id = r.collection_id),
         r.actor, p.handle, p.full_name, p.avatar_url,
         r.body, r.at, r.others
    from rows r
    join seen on seen.id = r.id
    left join public.profiles p on p.id = r.actor
   order by r.at desc, r.id, r.kind
   limit 200;
$$;

revoke all on function public.comment_news(timestamptz) from public, anon;
grant execute on function public.comment_news(timestamptz) to authenticated;
