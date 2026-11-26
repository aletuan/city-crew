-- "Hoạt động nổi bật" on Explore (owner, 26 Nov 2026): this week's
-- public check-ins with a photo, in one city.
--
-- ── which ──
--
-- Public, at least one photo still showing, made in the last seven days,
-- at a published place in the city asked about, and readable by the
-- caller (`checkin_seen`: not hidden by the desk, nobody blocked either
-- way, signed in). A note is not required here, unlike the place's
-- "Đánh giá từ khách": a shelf of pictures is a shelf of pictures, and
-- the photo is what the card is.
--
-- One a person, their most hearted — a shelf of ten visits by one
-- regular is one person's week, not the city's.
--
-- ── in which order ──
--
-- Hearts first, then newest. With two people hearting check-ins (25 Nov
-- 2026) the hearts will mostly tie at zero and newest decides, which is
-- the honest order for a shelf that says "this week"; as hearts come,
-- they lift what people liked. A week, not a day or an hour: never a
-- time a reader could follow somebody by.
--
-- Ten at most. Whether the shelf is drawn at all is the app's
-- (`FEATURED_MIN` in `screens/explore/CheckinShelf`): too few, and a
-- row of two reads as a quiet app, not a lively one.

create or replace function public.featured_checkins(p_city text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with seen as (
    select distinct on (c.user_id)
           c.*,
           (select count(*) from public.checkin_likes l where l.checkin_id = c.id) as hearts
      from public.checkins c
      join public.places p on p.id = c.place_id
     where c.city_id = p_city
       and c.audience = 'public'
       and c.at > now() - interval '7 days'
       and p.is_published and p.review_status = 'approved'
       and exists (select 1 from public.checkin_photos ph
                    where ph.checkin_id = c.id and ph.hidden_at is null)
       and public.checkin_seen(c)
     order by c.user_id,
              (select count(*) from public.checkin_likes l where l.checkin_id = c.id) desc,
              c.at desc
  )
  select coalesce(jsonb_agg(x.v order by x.hearts desc, x.at desc), '[]'::jsonb)
    from (
      select s.hearts, s.at,
             jsonb_build_object(
               'id', s.id,
               'place_slug', p.slug,
               'name_en', p.name_en,
               'name_vi', p.name_vi,
               'i18n', p.i18n,
               'handle', pr.handle,
               'full_name', pr.full_name,
               'avatar_url', pr.avatar_url,
               'note', case when s.note_hidden_at is null then s.note end,
               'likes', s.hearts,
               'liked', exists (select 1 from public.checkin_likes l
                                 where l.checkin_id = s.id and l.user_id = (select auth.uid())),
               'photo', (select jsonb_build_object('id', ph.id, 'path', ph.path, 'width', ph.width, 'height', ph.height)
                           from public.checkin_photos ph
                          where ph.checkin_id = s.id and ph.hidden_at is null
                          order by ph.position
                          limit 1)
             ) as v
        from seen s
        join public.places p on p.id = s.place_id
        join public.profiles pr on pr.id = s.user_id
       order by s.hearts desc, s.at desc
       limit 10
    ) x;
$$;

revoke all on function public.featured_checkins(text) from public, anon;
grant execute on function public.featured_checkins(text) to authenticated;
