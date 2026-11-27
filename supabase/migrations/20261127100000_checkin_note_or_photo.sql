-- A check-in with words or a photograph, not both, is enough (owner,
-- 27 Nov 2026) — for "Đánh giá từ khách" on a place and for "Hoạt động
-- nổi bật" on Explore.
--
-- Both asked for more until now: the place's reviews for a note and a
-- photo (`20261126120000_place_guest_reviews.sql`), the shelf for a
-- photo (`20261126150000_explore_highlights.sql`). On a city with three
-- people checking in that left most visits unseen — a line of words with
-- no photograph, or a photograph with nothing said, is still somebody
-- saying they went, and it is what the reader asked the section for.
--
-- ── what is still required ──
--
-- Something to show. A visit with its note hidden by the desk and no
-- photograph left has nothing, and neither section shows it. Everything
-- else is unchanged: public, readable by the caller (`checkin_seen`), the
-- place published, the shelf's seven days, its order and its caps.
--
-- ── a card with no photograph ──
--
-- The shelf's card is a photograph over its words. A visit that brought
-- none is drawn over the place's own cover, sent as `cover` beside
-- `photo` and used by the app only when `photo` is empty. Every one of
-- the 1,590 published places had a shown photo on 27 Nov 2026 (measured
-- on live). A plain ground with the words alone was the alternative; on
-- a shelf under one of photographs a flat card would read as a hole.
--
-- ── the reviews ──
--
-- A note the desk hid is sent as nothing, now that a review can be a
-- photograph alone: before, such a visit was not a review at all.

create or replace function public._featured_visits(p_city text)
returns table (
  id uuid, user_id uuid, place_id uuid, at timestamptz, note text,
  hearts bigint, others bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.place_id, c.at,
         case when c.note_hidden_at is null then nullif(btrim(c.note), '') end,
         (select count(*) from public.checkin_likes l where l.checkin_id = c.id),
         (select count(*) from public.checkin_likes l where l.checkin_id = c.id and l.user_id <> c.user_id)
    from public.checkins c
    join public.places p on p.id = c.place_id
   where c.city_id = p_city
     and c.audience = 'public'
     and c.at > now() - interval '7 days'
     and p.is_published and p.review_status = 'approved'
     and (exists (select 1 from public.checkin_photos ph
                   where ph.checkin_id = c.id and ph.hidden_at is null)
          or (c.note_hidden_at is null and nullif(btrim(c.note), '') is not null))
     and public.checkin_seen(c);
$$;

create or replace function public.featured_checkins(p_city text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cards jsonb := '[]'::jsonb;
  fronting uuid[] := '{}';
  pl record;
  v record;
begin
  for pl in
    select q.place_id,
           count(distinct q.user_id) as visitors,
           sum(q.hearts) as hearts
      from public._featured_visits(p_city) q
     group by q.place_id
     order by floor(extract(epoch from now() - max(q.at)) / 86400),
              count(distinct q.user_id) desc,
              sum(q.others) desc,
              bool_or(public.friends_with(q.user_id)) desc,
              bool_or(q.note is not null) desc,
              max(q.at) desc
  loop
    select q.* into v
      from public._featured_visits(p_city) q
     where q.place_id = pl.place_id
       and (select count(*) from unnest(fronting) f where f = q.user_id) < 7
     order by (q.note is not null) desc, q.others desc, q.at desc
     limit 1;
    continue when not found;
    fronting := fronting || v.user_id;
    cards := cards || (
      select jsonb_build_object(
               'id', v.id,
               'place_slug', p.slug,
               'name_en', p.name_en,
               'name_vi', p.name_vi,
               'i18n', p.i18n,
               'handle', pr.handle,
               'full_name', pr.full_name,
               'avatar_url', pr.avatar_url,
               'note', v.note,
               'likes', pl.hearts,
               'liked', exists (select 1 from public.checkin_likes l
                                 where l.checkin_id = v.id and l.user_id = (select auth.uid())),
               'visitors', pl.visitors,
               -- Whoever was there last, first.
               'faces', (select jsonb_agg(jsonb_build_object(
                                  'handle', f.handle, 'full_name', f.full_name, 'avatar_url', f.avatar_url)
                                  order by f.last desc)
                           from (select fp.handle, fp.full_name, fp.avatar_url, max(q.at) as last
                                   from public._featured_visits(p_city) q
                                   join public.profiles fp on fp.id = q.user_id
                                  where q.place_id = pl.place_id
                                  group by fp.handle, fp.full_name, fp.avatar_url, q.user_id
                                  order by max(q.at) desc
                                  limit 3) f),
               'photo', (select jsonb_build_object('id', ph.id, 'path', ph.path, 'width', ph.width, 'height', ph.height)
                           from public.checkin_photos ph
                          where ph.checkin_id = v.id and ph.hidden_at is null
                          order by ph.position
                          limit 1),
               -- The place's own cover, for a visit that brought words and
               -- no photograph: the catalog's pick (`coverOf` in the app),
               -- shown, the marked cover first, then the keeper's order.
               'cover', (select jsonb_build_object('id', pp.id, 'uri', pp.photo_uri)
                           from public.place_photos pp
                          where pp.place_id = v.place_id and not pp.is_hidden
                          order by pp.is_cover desc, pp.sort_order
                          limit 1))
        from public.places p, public.profiles pr
       where p.id = v.place_id and pr.id = v.user_id
    );
    exit when jsonb_array_length(cards) >= 10;
  end loop;
  return cards;
end;
$$;

revoke all on function public.featured_checkins(text) from public, anon;
grant execute on function public.featured_checkins(text) to authenticated;

create or replace function public.place_guest_reviews(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with place as (
    select id from public.places
     where slug = p_slug and is_published and review_status = 'approved'
  ),
  said as (
    select distinct on (c.user_id) c.*
      from public.checkins c
      join place on place.id = c.place_id
     where c.audience = 'public'
       and ((c.note_hidden_at is null and nullif(btrim(c.note), '') is not null)
            or exists (select 1 from public.checkin_photos p
                        where p.checkin_id = c.id and p.hidden_at is null))
       and public.checkin_seen(c)
     order by c.user_id, c.at desc
  )
  select jsonb_build_object(
    'count', (select count(*) from public.checkins c join place on place.id = c.place_id),
    'visits', coalesce((
      select jsonb_agg(x.v order by x.at desc)
        from (
          select s.at,
                 jsonb_build_object(
                   'id', s.id,
                   'user_id', s.user_id,
                   'handle', pr.handle,
                   'full_name', pr.full_name,
                   'avatar_url', pr.avatar_url,
                   'day', (s.at at time zone coalesce(ci.tz, 'Asia/Ho_Chi_Minh'))::date,
                   'note', case when s.note_hidden_at is null then nullif(btrim(s.note), '') end,
                   'likes', (select count(*) from public.checkin_likes l where l.checkin_id = s.id),
                   'liked', exists (select 1 from public.checkin_likes l
                                     where l.checkin_id = s.id and l.user_id = (select auth.uid())),
                   -- An empty list, not null, now that a review can have none.
                   'photos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'width', p.width, 'height', p.height)
                                                        order by p.position)
                                         from public.checkin_photos p
                                        where p.checkin_id = s.id and p.hidden_at is null), '[]'::jsonb)
                 ) as v
            from said s
            join public.profiles pr on pr.id = s.user_id
            left join public.cities ci on ci.id = s.city_id
           order by s.at desc
           limit 10
        ) x), '[]'::jsonb)
  )
  where exists (select 1 from place);
$$;

revoke all on function public.place_guest_reviews(text) from public;
grant execute on function public.place_guest_reviews(text) to anon, authenticated;
