-- "Hoạt động nổi bật": the card's words and faces (owner, 26 Nov 2026).
--
-- Two changes to `20261126210000_highlights_by_place.sql`, which places
-- are on the shelf and in what order unchanged.
--
-- ── whose visit a card shows ──
--
-- Of a place's visitors not yet fronting a card: one who wrote
-- something, then the one whose visit other people hearted most, then
-- the newest. It was written, then newest. The words are what the card
-- now leads with under its photo, and a line other people have hearted
-- is the place's best one this week — for the reader choosing, and for
-- the owner reading it. Other people's hearts, as in the shelf's order:
-- a heart on your own visit is shown and is not a vote.
--
-- ── the faces ──
--
-- Whoever was there last, first, up to three. They were the visit's
-- author first. The card no longer names anybody at its foot (the owner
-- chose faces and a "+N" over a name, 26 Nov 2026), so nothing ties the
-- first face to the words above it, and "who was here lately" is what a
-- row of faces says without a name.

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
