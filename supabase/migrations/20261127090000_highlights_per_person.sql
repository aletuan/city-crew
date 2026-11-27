-- "Hoạt động nổi bật": a person fronts seven cards at most (owner,
-- 27 Nov 2026), not one.
--
-- One a person was the shelf's first rule, from when a card was a
-- person's: a shelf of one regular is one person's week. It outlived
-- the move to a card a place (`20261126210000_highlights_by_place.sql`)
-- and showed what it costs the next morning: @minh checked in at Ollin
-- Cafe at 08:15 — public, three photos, words — and the shelf did not
-- show it, because Minh already fronted 3 Con Mực, and Ollin had nobody
-- else. Four places and three people made three cards, whatever they did.
--
-- Seven of the ten is the owner's figure; two was proposed, enough for
-- that morning. At seven one person can hold most of a shelf, which the
-- first rule was there to stop — worth looking at again once a city has
-- more people checking in than the three it had.
--
-- Nothing else changes: which visits count, the order of places, and
-- whose visit fronts a place (written, others' hearts, newest) among
-- those under the cap.

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
