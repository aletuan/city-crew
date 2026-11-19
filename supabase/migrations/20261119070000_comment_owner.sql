-- What a list's owner may do about its comments, made reachable
-- (docs/comments-plan.md, C6).
--
-- The rules have been the server's since the first comments migration:
-- `collections.comments_off` closes a thread to new comments and
-- `post_comment` refuses with `comment:off`; `delete_comment` lets a
-- list's owner take down anybody's comment on it. What was missing is
-- the app being told — before somebody types — that a thread is closed,
-- and that the reader is the one who may reopen it. Two answers the app
-- already asks for grow by that much; no rule changes.
--
-- The switch itself is written by the owner through the table, as
-- `is_public` is ("owners update their collections"): a column of their
-- own row, with nothing to check that the policy does not. The test
-- holds that a stranger's write changes nothing.
--
-- ── what a card is told: `off` ──
--
-- `comment_previews` answered only for lists that had comments — a list
-- with none had no row, and the card read that as zero. Now it answers
-- for every list asked about that the reader may see, with zero and an
-- empty `latest` where there is nothing, and with `off`. So a card can
-- leave the bubble out on a closed, empty thread (there is nothing to
-- read and nothing may be written) and keep it on a closed thread that
-- has something in it.
--
-- A column more is a new return type, so the function is dropped and
-- made again. A build from before this reads the three columns it knows
-- and files a zero where it used to file nothing: the same drawing.
drop function if exists public.comment_previews(uuid[]);
create function public.comment_previews(p_collections uuid[])
returns table (collection_id uuid, n integer, latest jsonb, off boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select l.*, row_number() over (partition by l.collection_id order by l.created_at desc, l.id) as k
      from public.comments_seen(p_collections[1:200]) l
  ),
  said as (
    select r.collection_id,
           count(*)::integer as n,
           jsonb_agg(jsonb_build_object(
             'id', r.id, 'body', r.body, 'created_at', r.created_at,
             'author', r.author, 'handle', p.handle,
             'full_name', p.full_name, 'avatar_url', p.avatar_url)
             order by r.created_at desc, r.id) filter (where r.k <= 2) as latest
      from ranked r
      left join public.profiles p on p.id = r.author
     group by r.collection_id
  )
  select c.id, coalesce(s.n, 0), coalesce(s.latest, '[]'::jsonb), c.comments_off
    from public.collections c
    left join said s on s.collection_id = c.id
   where c.id = any (p_collections[1:200])
     and public.comment_subject_visible(c.id);
$$;

revoke all on function public.comment_previews(uuid[]) from public;
grant execute on function public.comment_previews(uuid[]) to anon, authenticated;

-- ── what the field is told: `off`, and `mine` ──
--
-- `comment_taggable` is what a field asks when it opens: whom and what
-- may be tagged here. It is the one question asked by exactly the reader
-- who might write, at exactly the moment before they do, so it also says
-- whether writing is closed (`off`) and whether the list is the caller's
-- (`mine`) — the two things that decide what stands where the field
-- would: the field, a line saying comments are off, or that line with
-- the owner's way to turn them on again. A third request for two
-- booleans was the other choice.
--
-- The body is 20261119050000's with the two keys; the people and places
-- are still returned on a closed thread, which costs nothing and means
-- reopening needs no second ask.
create or replace function public.comment_taggable(p_collection uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me    uuid := (select auth.uid());
  owner uuid;
  shut  boolean;
begin
  if me is null then
    return jsonb_build_object('people', '[]'::jsonb, 'places', '[]'::jsonb, 'off', false, 'mine', false);
  end if;
  select c.owner_id, c.comments_off into owner, shut
    from public.collections c
   where c.id = p_collection and c.is_public;
  if not found or (owner is not null and public.is_blocked_pair(me, owner)) then
    return jsonb_build_object('people', '[]'::jsonb, 'places', '[]'::jsonb, 'off', false, 'mine', false);
  end if;
  return jsonb_build_object(
    'off', shut,
    'mine', owner is not distinct from me,
    'people', coalesce((
      with cand as (
        select owner as id, 0 as tier, null::timestamptz as last
         where owner is not null
        union all
        select k.author, 1, max(k.created_at)
          from public.comments k
         where k.collection_id = p_collection
         group by k.author
        union all
        select case when f.requester = me then f.addressee else f.requester end, 2, null
          from public.friendships f
         where f.status = 'accepted' and me in (f.requester, f.addressee)
      ),
      first as (
        select distinct on (c.id) c.id, c.tier, c.last
          from cand c
         where c.id <> me and not public.is_blocked_pair(me, c.id)
         order by c.id, c.tier
      )
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'handle', p.handle,
               'full_name', p.full_name, 'avatar_url', p.avatar_url)
             order by f.tier, f.last desc nulls last, p.handle collate "C")
        from first f join public.profiles p on p.id = f.id), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pl.id, 'slug', pl.slug,
               'name_en', pl.name_en, 'name_vi', pl.name_vi, 'name_ja', pl.name_ja,
               'i18n', pl.i18n)
             order by cp.sort_order, pl.slug collate "C")
        from public.collection_places cp
        join public.places pl on pl.id = cp.place_id
       where cp.collection_id = p_collection and pl.is_published), '[]'::jsonb)
  );
end;
$$;


revoke all on function public.comment_taggable(uuid) from public, anon;
grant execute on function public.comment_taggable(uuid) to authenticated;
