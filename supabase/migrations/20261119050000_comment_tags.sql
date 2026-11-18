-- Tags in a comment, made usable (docs/comments-plan.md, C5).
--
-- `post_comment` has taken tags since the first migration and
-- `comment_thread` has returned them; nothing could write one, because
-- the app had no way to ask "whom may I tag here?", and a place tag could
-- not be pressed, because it carried the place's id and the place page is
-- opened by slug. This is those two things and nothing else: the rules
-- for a tag are `post_comment`'s and are not restated.
--
-- ── whom, and what, may be tagged here ──
--
-- `comment_taggable(collection)` answers with the people and the places
-- the caller could tag in a comment on that list, in one object:
--
--   { "people": [ { id, handle, full_name, avatar_url } … ],
--     "places": [ { id, slug, name_en, name_vi, name_ja, i18n } … ] }
--
-- People are exactly those `post_comment` would accept (decision 4): the
-- list's owner, anybody who has written in the thread, and the caller's
-- friends — never the caller, never somebody blocked either way. The
-- order is the order of likelihood: the owner, then the thread's writers
-- by their latest comment, then friends by handle. A person is listed
-- once, at their first place in that order.
--
-- It is the same three sources as the check in `post_comment`, written a
-- second time; `comment_tags_test.sql` holds the two together by posting
-- a tag for every person this returns and for one it does not.
--
-- Places are the list's own, in the list's order, with the columns the
-- app's `localized()` reads a name from. Only published ones: the list a
-- reader picks from should not be where an unreviewed place is first
-- seen by a stranger. (`post_comment` would take a tag for any place on
-- the list; the picker is the narrower door, and the only one there is.)
--
-- One object and not two functions: the composer asks once when it
-- opens, and the two halves are never wanted apart.
--
-- Nothing for a guest, and nothing for a list the caller cannot comment
-- on — the same test `post_comment` opens with. Empty, not an error: the
-- composer asks before anybody has typed, and has no use for a refusal.
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
begin
  if me is null then
    return jsonb_build_object('people', '[]'::jsonb, 'places', '[]'::jsonb);
  end if;
  select c.owner_id into owner
    from public.collections c
   where c.id = p_collection and c.is_public;
  if not found or (owner is not null and public.is_blocked_pair(me, owner)) then
    return jsonb_build_object('people', '[]'::jsonb, 'places', '[]'::jsonb);
  end if;
  return jsonb_build_object(
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

-- ── a place tag that can be pressed ──
--
-- Each place tag now carries the place's slug beside its id. Weighed
-- against looking the id up in the list's places on the phone
-- (docs/comments-plan.md, C5): that needs no migration, but a place
-- taken off the list after the comment was written would stop opening,
-- and the page would need the list's places just to read a thread.
--
-- The return type is unchanged (`mentions` was jsonb and is), so the
-- function is replaced in place; the body is 20261118190000's with one
-- join and one key more.
create or replace function public.comment_thread(p_collection uuid, p_order text default 'new')
returns table (
  id uuid, parent_id uuid, root_id uuid, depth smallint,
  body text, created_at timestamptz,
  author uuid, handle text, full_name text, avatar_url text,
  mentions jsonb,
  likes integer, liked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if p_order <> 'new' then
    raise exception 'comment:order';
  end if;
  return query
  select s.id, s.parent_id, s.root_id, s.depth, s.body, s.created_at,
         s.author, p.handle, p.full_name, p.avatar_url,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'at', mn.at, 'len', mn.len,
                    'person', mn.person_id, 'handle', mp.handle,
                    'place', mn.place_id, 'slug', mpl.slug) order by mn.at)
             from public.comment_mentions mn
             left join public.profiles mp on mp.id = mn.person_id
             left join public.places mpl on mpl.id = mn.place_id
            where mn.comment_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.comment_likes l where l.comment_id = s.id),
         exists (select 1 from public.comment_likes l where l.comment_id = s.id and l.user_id = me)
    from public.comments_seen(array[p_collection]) s
    left join public.profiles p on p.id = s.author
    left join public.comments r on r.id = s.root_id
   order by coalesce(r.created_at, s.created_at) desc,
            coalesce(s.root_id, s.id),
            (s.root_id is not null),
            s.created_at asc, s.id;
end;
$$;

revoke all on function public.comment_thread(uuid, text) from public;
grant execute on function public.comment_thread(uuid, text) to anon, authenticated;
