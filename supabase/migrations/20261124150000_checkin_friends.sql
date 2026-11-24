-- A visit a friend can see, and a heart on it (owner, 24 Nov 2026).
--
-- `20261124120000_checkin_notes.sql` gave a visit its words and an answer
-- to "who sees it", and left the table readable by its owner alone. This
-- is the read for everybody else, and it is deliberately not a policy.
--
-- ── why a function and not a policy on `checkins` ──
--
-- A policy lets a row through whole. A friend may know the place, the
-- *day*, and the note; not the hour (the owner, the same day: "bạn bè
-- thấy ngày, không thấy giờ" — a day says you went, an hour says when
-- you are not at home). Row level security has no way to hand over a
-- row with one column blunted, and a view would need the same definer
-- rights with less room to say who is asking. So the table stays the
-- owner's, and `person_checkins` answers for one person's page:
--
--   · your own page: every visit of yours, with its answer, so the page
--     can mark the private ones and ask for the notes they lack;
--   · a friend's page: their visits answered 'friends' — an accepted
--     friendship, and no block either way;
--   · anybody else's, or signed out: nothing, and nothing that says
--     whether there was anything.
--
-- The unanswered question (audience null: every visit before today, and
-- one whose sheet never closed) is private. Nobody was asked.
--
-- ── the day ──
--
-- The visit's instant on the clock of the city it was made in
-- (`cities.tz`, `20260923090000_city_clock.sql`), Vietnam's where the
-- city is unknown. Not the reader's clock: a breakfast in Hà Nội is the
-- same morning for a friend reading in Melbourne.
--
-- ── one card a place ──
--
-- The newest visit this reader may see at each place, not every visit:
-- a regular's page would otherwise be the same café nine times. The
-- regular's own list of every visit is the check-ins screen. Newest
-- *that the reader may see*: a private visit yesterday does not hide the
-- one shared last week.
--
-- Only places a reader can open — published and approved — for the
-- owner too: the card's press goes to the place.
--
-- ── the heart ──
--
-- On one visit, from somebody who can see it; the owner as well, as on
-- a list shared with friends. Only a visit answered 'friends' takes one:
-- a private visit has no audience to applaud it. The table is closed to
-- clients, as `comment_likes` is, and for its reason — who liked a thing
-- is the liker's act, and the page needs a count and "did I", which the
-- read above carries. Written through `like_checkin`, so the "can you
-- see it" check cannot be skipped.
--
-- Taking back the answer (friends → private) leaves the hearts where
-- they are and shows them to nobody but the count on the owner's page.
-- Removing the visit removes them (cascade), as removing the account
-- does.

create table if not exists public.checkin_likes (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);

-- The export's read, and the cascade from a deleted account.
create index if not exists checkin_likes_by_user on public.checkin_likes (user_id);

alter table public.checkin_likes enable row level security;
revoke all on table public.checkin_likes from anon, authenticated;

-- Whether the caller may see the visit `c`: their own, or a friend's
-- that was answered 'friends', with no block between them. One place for
-- the rule the read and the heart both ask.
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
          and not public.blocked_with(c.user_id));
$$;

revoke all on function public.checkin_seen(public.checkins) from public, anon, authenticated;

drop function if exists public.person_checkins(uuid);
create function public.person_checkins(p_person uuid)
returns table (
  id uuid, place_slug text, name_en text, name_vi text, i18n jsonb,
  categories text[], cover text, city_id text,
  day date, note text, audience text,
  likes integer, liked boolean
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
         -- The answer is the owner's business: a friend only ever sees
         -- rows where it is 'friends', and is told nothing by it.
         case when s.user_id = (select auth.uid()) then s.audience end,
         (select count(*)::integer from public.checkin_likes l where l.checkin_id = s.id),
         exists (select 1 from public.checkin_likes l
                  where l.checkin_id = s.id and l.user_id = (select auth.uid()))
    from seen s
    join public.places p on p.id = s.place_id
    left join public.cities ci on ci.id = s.city_id
   where p.is_published and p.review_status = 'approved'
   order by s.at desc
   -- A page, not an archive: the feed draws five at a time and the
   -- longest shelf it was built for is 24 cards.
   limit 60;
$$;

revoke all on function public.person_checkins(uuid) from public, anon;
grant execute on function public.person_checkins(uuid) to authenticated;

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
  if not found or c.audience is distinct from 'friends' or not public.checkin_seen(c) then
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

-- The export's part: the hearts this account gave, as the place and the
-- day it gave them. Not whose visit: that is the other person's, and the
-- file is about the account that asked for it (`comment_takeout` draws
-- the same line). A heart on a visit its owner has since made private,
-- or after the friendship ended, is still this account's act and is
-- still listed.
create or replace function public.checkin_hearts_takeout()
returns table (place_slug text, liked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.slug, l.created_at
    from public.checkin_likes l
    join public.checkins c on c.id = l.checkin_id
    join public.places p on p.id = c.place_id
   where l.user_id = (select auth.uid())
   order by l.created_at desc;
$$;

revoke all on function public.checkin_hearts_takeout() from public, anon;
grant execute on function public.checkin_hearts_takeout() to authenticated;
