-- A visit anybody signed in can see (owner, 25 Nov 2026).
--
-- `20261124120000_checkin_notes.sql` gave a visit two answers and wrote
-- down why there was no third: a check-in says where a person was, and
-- strangers see less than friends (`docs/collection-feed-plan.md`,
-- principle 5). This is the owner's decision to offer the third answer
-- anyway, made while weighing a shelf of check-ins worth showing on
-- Explore: a visit a stranger can read is the only kind such a shelf
-- could ever hold, and the reader who wants their visit seen should be
-- able to say so.
--
-- What principle 5 still decides:
--
--   · Public is never assumed. It is chosen on the visit's own sheet,
--     every time: the answer a new visit opens on is never Public, even
--     after a public one (`nextAudience` in `app/src/lib/checkin.ts`).
--     Unanswered (null) is still private, as is every visit before today.
--   · What a stranger is shown is what a friend is shown — the place,
--     the day and never the hour, the note, the photos — and not more.
--     Public widens *who*, not *what*.
--   · Signed in. `person_checkins` already refuses a caller with no
--     account, and the photos are reached only through Storage as
--     `authenticated`; a visit is not a page on the open web.
--   · A block still closes it, whichever side the block is on.
--
-- ── what changes ──
--
-- The answer's check takes 'public'. `checkin_seen`, the one place the
-- read, the heart and the photos' Storage policy all ask "may this
-- caller see the visit", lets a public visit through to anybody signed in
-- and unblocked. `like_checkin` takes a heart on one. `person_checkins`
-- tells a reader who is not the owner that a visit is public — the card
-- wears the globe rather than the friends' mark — and still tells them
-- nothing about a friends one, which is what it told them before.
--
-- Reporting is unchanged and enough for now: a photo can be reported by
-- whoever sees it (`20261125120000_checkin_photo_desk.sql` never asked
-- for a friendship), and the person can be reported from their page. A
-- note has no report of its own, which is the next thing a stranger's
-- reading of it asks for.

alter table public.checkins drop constraint if exists checkins_audience_known;
alter table public.checkins add constraint checkins_audience_known
  check (audience is null or audience in ('private', 'friends', 'public'));

create or replace function public.checkin_seen(c public.checkins)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id = (select auth.uid())
      or (c.audience = 'friends'
          and public.friends_with(c.user_id)
          and not public.blocked_with(c.user_id))
      or (c.audience = 'public'
          and (select auth.uid()) is not null
          and not public.blocked_with(c.user_id));
$$;

revoke all on function public.checkin_seen(public.checkins) from public, anon, authenticated;

create or replace function public.like_checkin(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  c  public.checkins;
begin
  if me is null then
    raise exception 'checkin:signed_out';
  end if;
  select * into c from public.checkins where id = p_id;
  -- One refusal for "not there", "not yours to see" and "private": a
  -- caller learns nothing about a visit they could not read.
  if not found or c.audience is null or c.audience not in ('friends', 'public')
     or not public.checkin_seen(c) then
    raise exception 'checkin:unseen';
  end if;
  if p_on then
    insert into public.checkin_likes (checkin_id, user_id) values (p_id, me)
    on conflict do nothing;
  else
    delete from public.checkin_likes where checkin_id = p_id and user_id = me;
  end if;
end;
$$;

revoke all on function public.like_checkin(uuid, boolean) from public, anon;
grant execute on function public.like_checkin(uuid, boolean) to authenticated;

-- `20261124230000_checkin_photos.sql`'s, with one line changed: the
-- answer column.
drop function if exists public.person_checkins(uuid);
create function public.person_checkins(p_person uuid)
returns table (
  id uuid, place_slug text, name_en text, name_vi text, i18n jsonb,
  categories text[], cover text, city_id text,
  day date, note text, audience text,
  likes integer, liked boolean,
  photos jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with seen as (
    select distinct on (c.place_id) c.*
      from public.checkins c
     where c.user_id = p_person
       and (select auth.uid()) is not null
       and public.checkin_seen(c)
     order by c.place_id, c.at desc
  )
  select s.id, p.slug, p.name_en, p.name_vi, p.i18n, p.categories,
         (select ph.photo_uri from public.place_photos ph
           where ph.place_id = p.id and not ph.is_hidden
           order by ph.is_cover desc, ph.sort_order
           limit 1),
         s.city_id,
         (s.at at time zone coalesce(ci.tz, 'Asia/Ho_Chi_Minh'))::date,
         s.note,
         -- The owner gets their answer, whatever it is. Anybody else is
         -- told 'public' when it is — anyone could have learned that by
         -- reading — and nothing for 'friends', as before this file.
         case when s.user_id = (select auth.uid()) then s.audience
              when s.audience = 'public' then 'public' end,
         (select count(*)::integer from public.checkin_likes l where l.checkin_id = s.id),
         exists (select 1 from public.checkin_likes l
                  where l.checkin_id = s.id and l.user_id = (select auth.uid())),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', cp.id, 'path', cp.path, 'width', cp.width, 'height', cp.height)
                            order by cp.position)
             from public.checkin_photos cp
            where cp.checkin_id = s.id and cp.hidden_at is null), '[]'::jsonb)
    from seen s
    join public.places p on p.id = s.place_id
    left join public.cities ci on ci.id = s.city_id
   where p.is_published and p.review_status = 'approved'
   order by s.at desc
   limit 60;
$$;

revoke all on function public.person_checkins(uuid) from public, anon;
grant execute on function public.person_checkins(uuid) to authenticated;
