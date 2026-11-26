-- "Đánh giá từ khách" (20261126120000): the count is every visit; the
-- list is public visits with a note and a photo, one a person, their
-- newest, closed by what closes a visit anywhere else.
--
--   f7…0a  Ann, public with note and photo (twice: the newer one shown)
--   f7…0b  Bao, public with a note and no photo
--   f7…0c  Chi, public with a photo and no note
--   f7…0d  Dan, friends with note and photo
--   f7…0e  Eve, public with note and photo, then hidden by the desk
--   f7…0f  Fay, public with note and photo, the reader's blocker
--   f7…10  the reader

grant usage on schema public, storage to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f7ae0000-0000-0000-0000-00000000000a', 'gr-a@x.com', '{"handle":"grann"}'),
 ('f7ae0000-0000-0000-0000-00000000000b', 'gr-b@x.com', '{"handle":"grbao"}'),
 ('f7ae0000-0000-0000-0000-00000000000c', 'gr-c@x.com', '{"handle":"grchi"}'),
 ('f7ae0000-0000-0000-0000-00000000000d', 'gr-d@x.com', '{"handle":"grdan"}'),
 ('f7ae0000-0000-0000-0000-00000000000e', 'gr-e@x.com', '{"handle":"greve"}'),
 ('f7ae0000-0000-0000-0000-00000000000f', 'gr-f@x.com', '{"handle":"grfay"}'),
 ('f7ae0000-0000-0000-0000-000000000010', 'gr-r@x.com', '{"handle":"grreader"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f7ae0000-0000-0000-0000-0000000000a1', 'gr-omu', 'hanoi', true, 'approved', 'Omu', '{eats}'),
 ('f7ae0000-0000-0000-0000-0000000000a2', 'gr-draft', 'hanoi', false, 'pending', 'Draft', '{eats}');
insert into public.friendships (requester, addressee, status) values
 ('f7ae0000-0000-0000-0000-00000000000d', 'f7ae0000-0000-0000-0000-000000000010', 'accepted');
insert into public.blocks (blocker, blocked) values
 ('f7ae0000-0000-0000-0000-00000000000f', 'f7ae0000-0000-0000-0000-000000000010');

insert into public.checkins (id, user_id, place_id, city_id, at, note, audience, hidden_at) values
 ('f7ae0000-0000-0000-0000-0000000000c1', 'f7ae0000-0000-0000-0000-00000000000a', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-20 03:00+00', 'Older.', 'public', null),
 ('f7ae0000-0000-0000-0000-0000000000c2', 'f7ae0000-0000-0000-0000-00000000000a', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 03:00+00', 'Omurice, soft.', 'public', null),
 ('f7ae0000-0000-0000-0000-0000000000c3', 'f7ae0000-0000-0000-0000-00000000000b', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 04:00+00', 'Words only.', 'public', null),
 ('f7ae0000-0000-0000-0000-0000000000c4', 'f7ae0000-0000-0000-0000-00000000000c', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 05:00+00', null, 'public', null),
 ('f7ae0000-0000-0000-0000-0000000000c5', 'f7ae0000-0000-0000-0000-00000000000d', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 06:00+00', 'For friends.', 'friends', null),
 ('f7ae0000-0000-0000-0000-0000000000c6', 'f7ae0000-0000-0000-0000-00000000000e', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 07:00+00', 'Hidden.', 'public', now()),
 ('f7ae0000-0000-0000-0000-0000000000c7', 'f7ae0000-0000-0000-0000-00000000000f', 'f7ae0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 08:00+00', 'Blocked.', 'public', null),
 ('f7ae0000-0000-0000-0000-0000000000c8', 'f7ae0000-0000-0000-0000-00000000000a', 'f7ae0000-0000-0000-0000-0000000000a2', 'hanoi', '2026-11-24 09:00+00', 'Draft place.', 'public', null);

insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes)
select ('f7ae0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, c::uuid, u::uuid, 1,
       u || '/' || c || '/f7ae0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0') || '.jpg', 10, 10, 1
  from (values
    (1, 'f7ae0000-0000-0000-0000-0000000000c1', 'f7ae0000-0000-0000-0000-00000000000a'),
    (2, 'f7ae0000-0000-0000-0000-0000000000c2', 'f7ae0000-0000-0000-0000-00000000000a'),
    (4, 'f7ae0000-0000-0000-0000-0000000000c4', 'f7ae0000-0000-0000-0000-00000000000c'),
    (5, 'f7ae0000-0000-0000-0000-0000000000c5', 'f7ae0000-0000-0000-0000-00000000000d'),
    (6, 'f7ae0000-0000-0000-0000-0000000000c6', 'f7ae0000-0000-0000-0000-00000000000e'),
    (7, 'f7ae0000-0000-0000-0000-0000000000c7', 'f7ae0000-0000-0000-0000-00000000000f')
  ) as t(n, c, u);
insert into public.checkin_likes (checkin_id, user_id) values
 ('f7ae0000-0000-0000-0000-0000000000c2', 'f7ae0000-0000-0000-0000-000000000010');

-- One reader's answer, as "count | handle:note:photos:likes* ; …".
create function public._gr_read(as_user text, slug text) returns text
language plpgsql set search_path = public as $$
declare j jsonb; out text;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  j := public.place_guest_reviews(slug);
  reset role;
  if j is null then return 'null'; end if;
  select (j ->> 'count') || ' | ' || coalesce(string_agg(
           (v ->> 'handle') || ':' || coalesce(v ->> 'note', '-') || ':' || coalesce(jsonb_array_length(v -> 'photos'), 0)
           || ':' || (v ->> 'likes') || (case when (v ->> 'liked')::boolean then '*' else '' end), ' ; '), '')
    into out
    from jsonb_array_elements(j -> 'visits') v;
  return out;
end $$;

do $$
declare
  r constant text := 'f7ae0000-0000-0000-0000-000000000010';
  got text;
begin
  got := public._gr_read(r, 'gr-omu');
  assert got = '7 | grann:Omurice, soft.:1:1*',
    format('every visit counted; Ann''s newest alone shown, with the reader''s heart: %s', got);

  got := public._gr_read('', 'gr-omu');
  assert got = '7 | ', format('signed out: the count and nobody''s words: %s', got);

  got := public._gr_read(r, 'gr-draft');
  assert got = 'null', format('a place not published says nothing: %s', got);
  got := public._gr_read(r, 'no-such-place');
  assert got = 'null', format('nor a place that is not there: %s', got);

  -- A hidden note takes the visit out, and the older public one does not
  -- step in: one a person, their newest that qualifies.
  update public.checkins set note_hidden_at = now() where id = 'f7ae0000-0000-0000-0000-0000000000c2';
  got := public._gr_read(r, 'gr-omu');
  assert got = '7 | grann:Older.:1:0', format('the newest that still says something: %s', got);

  -- Photos all hidden — as a suspension leaves them — and it drops out.
  update public.checkin_photos set hidden_at = now(), hidden_for = 'suspended' where checkin_id = 'f7ae0000-0000-0000-0000-0000000000c1';
  got := public._gr_read(r, 'gr-omu');
  assert got = '7 | ', format('no photo left, no review: %s', got);
end $$;

drop function public._gr_read(text, text);
