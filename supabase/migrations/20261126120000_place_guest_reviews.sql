-- "Đánh giá từ khách" on a place's page (owner, 26 Nov 2026): how many
-- times the place has been checked in, and the visits a reader may read
-- that say something and show something.
--
-- ── which visits ──
--
-- Public ones, with a note *and* at least one photo — both, not either
-- (the owner's call): a note alone is a line nobody can check, a photo
-- alone says nothing about the place, and the section is the guests'
-- account of it. Everything else that `checkin_seen` already decides
-- holds here as it does on a person's page: a hidden visit and a
-- blocked person are not shown, a hidden note is not a note, a hidden
-- photo is not a photo (so a visit whose photos are all hidden, as a
-- suspension leaves them, drops out). Friends visits stay on the
-- person's page: the place's page is a stranger's page.
--
-- One a person, their newest: a regular's five visits would otherwise
-- be the whole section. Newest first, ten at most — a section on a
-- place's page, not a feed; and nothing in this file ranks by hearts,
-- which with two people liking check-ins (25 Nov 2026) would rank by
-- chance.
--
-- ── the count ──
--
-- Every check-in at the place, whoever made it and whoever it was
-- shown to: a sum, which names nobody — the same figure the place's
-- check-in pill has always been allowed to say. Shown to everybody,
-- signed in or not.
--
-- The name is the owner's: a visit has no stars yet, and the section is
-- where they would go.

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
       and c.note_hidden_at is null
       and c.note is not null
       and exists (select 1 from public.checkin_photos p
                    where p.checkin_id = c.id and p.hidden_at is null)
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
                   'note', s.note,
                   'likes', (select count(*) from public.checkin_likes l where l.checkin_id = s.id),
                   'liked', exists (select 1 from public.checkin_likes l
                                     where l.checkin_id = s.id and l.user_id = (select auth.uid())),
                   'photos', (select jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'width', p.width, 'height', p.height)
                                               order by p.position)
                                from public.checkin_photos p
                               where p.checkin_id = s.id and p.hidden_at is null)
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
