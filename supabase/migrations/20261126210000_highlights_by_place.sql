-- "Hoạt động nổi bật", a card a place (owner, 26 Nov 2026).
--
-- The shelf was a card a person, their most hearted, hearts then newest
-- (`20261126150000_explore_highlights.sql`). One day of it on live showed
-- what that costs: 3 Con Mực had two people in on the same day, the
-- strongest thing the city had to say, and was not on the shelf — each
-- of the two had an older visit elsewhere with more hearts, and that
-- visit was their card. Hearts over a week also keep Monday's card in
-- front until Sunday, so a reader who opens Explore two days running
-- sees the same shelf twice.
--
-- ── which visits count ──
--
-- Unchanged, and in one place now (`_featured_visits`): public, a photo
-- still showing, the last seven days, a published place in the city, and
-- readable by the caller (`checkin_seen`).
--
-- ── a card is a place ──
--
-- One card a place, whoever and however many went. It carries how many
-- different people went ("2 người đã ghé") and up to three of their
-- faces: a count of people, not of visits, so one regular going daily
-- is one, and it is the number a place's owner will read.
--
-- ── in which order ──
--
--   1. the day of the place's newest visit, in whole days back from now
--      — today's before yesterday's, so the shelf turns over daily;
--   2. more people before fewer;
--   3. more hearts — other people's: a heart on your own visit is shown
--      on the card and counts for nothing here;
--   4. a place a friend of the reader went to;
--   5. a place somebody wrote about;
--   6. newest.
--
-- Whole days back from now rather than calendar days: a calendar day
-- needs the city's timezone, and "within 24 hours" is what a reader
-- means by today on a shelf that never says the hour.
--
-- No weights and no decay curve. With three people checking in there is
-- nothing to fit one to; an order that can be read out loud is one the
-- owner can check against what the shelf shows.
--
-- ── whose visit the card shows ──
--
-- A person still fronts one card at most — the first rule's reason
-- stands, a shelf of one regular is one person's week. Places are taken
-- in order, and each takes, of its visitors not yet fronting a card,
-- the one who wrote something, then the newest. A place whose every
-- visitor already fronts a better card is left out.
--
-- The card's photo, note and heart are that visit's. Its count of hearts
-- is the place's, over every visit that counts.
--
-- Ten at most; whether the shelf is drawn at all is still the app's
-- (`FEATURED_MIN`).

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
     and exists (select 1 from public.checkin_photos ph
                  where ph.checkin_id = c.id and ph.hidden_at is null)
     and public.checkin_seen(c);
$$;

-- The shelf's own, called by nothing else.
revoke all on function public._featured_visits(text) from public, anon, authenticated;

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
     where q.place_id = pl.place_id and q.user_id <> all (fronting)
     order by (q.note is not null) desc, q.at desc
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
               -- The one fronting first, then whoever was there last.
               'faces', (select jsonb_agg(jsonb_build_object(
                                  'handle', f.handle, 'full_name', f.full_name, 'avatar_url', f.avatar_url)
                                  order by f.lead desc, f.last desc)
                           from (select fp.handle, fp.full_name, fp.avatar_url,
                                        (q.user_id = v.user_id) as lead, max(q.at) as last
                                   from public._featured_visits(p_city) q
                                   join public.profiles fp on fp.id = q.user_id
                                  where q.place_id = pl.place_id
                                  group by fp.handle, fp.full_name, fp.avatar_url, q.user_id
                                  order by (q.user_id = v.user_id) desc, max(q.at) desc
                                  limit 3) f),
               'photo', (select jsonb_build_object('id', ph.id, 'path', ph.path, 'width', ph.width, 'height', ph.height)
                           from public.checkin_photos ph
                          where ph.checkin_id = v.id and ph.hidden_at is null
                          order by ph.position
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
