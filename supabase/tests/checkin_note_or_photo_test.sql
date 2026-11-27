-- Words or a photograph (20261127100000): a visit with either is a guest
-- review on its place and a card on Explore's shelf; one with neither —
-- its note hidden by the desk and no photo — is in neither. (Blank words
-- cannot be written: `checkins_note_shape`.) A card whose
-- visit brought no photograph carries the place's cover.
--
--   f9ce…0a  Ann, words only, the newest
--   f9ce…0b  Bao, a photo only
--   f9ce…0c  Chi, words the desk hid, no photo
--   f9ce…0e  Eve, words the desk hid, and a photo
--   f9ce…10  the reader

grant usage on schema public, storage to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f9ce0000-0000-0000-0000-00000000000a', 'np-a@x.com', '{"handle":"npann"}'),
 ('f9ce0000-0000-0000-0000-00000000000b', 'np-b@x.com', '{"handle":"npbao"}'),
 ('f9ce0000-0000-0000-0000-00000000000c', 'np-c@x.com', '{"handle":"npchi"}'),
 ('f9ce0000-0000-0000-0000-00000000000e', 'np-e@x.com', '{"handle":"npeve"}'),
 ('f9ce0000-0000-0000-0000-000000000010', 'np-r@x.com', '{"handle":"npreader"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f9ce0000-0000-0000-0000-0000000000a1', 'np-sen', 'hue', true, 'approved', 'Sen', '{eats}');
-- The cover is the marked one, not the first in order; a hidden one is
-- never it.
insert into public.place_photos (id, place_id, photo_uri, sort_order, is_cover, is_hidden) values
 ('f9ce0000-0000-0000-0000-0000000002a1', 'f9ce0000-0000-0000-0000-0000000000a1', 'https://x/first.jpg', 0, false, false),
 ('f9ce0000-0000-0000-0000-0000000002a2', 'f9ce0000-0000-0000-0000-0000000000a1', 'https://x/cover.jpg', 1, true, false),
 ('f9ce0000-0000-0000-0000-0000000002a3', 'f9ce0000-0000-0000-0000-0000000000a1', 'https://x/hidden.jpg', 2, true, true);

insert into public.checkins (id, user_id, place_id, city_id, at, note, audience, note_hidden_at) values
 ('f9ce0000-0000-0000-0000-0000000000c1', 'f9ce0000-0000-0000-0000-00000000000a', 'f9ce0000-0000-0000-0000-0000000000a1', 'hue', now() - interval '1 hour', 'Words only.', 'public', null),
 ('f9ce0000-0000-0000-0000-0000000000c2', 'f9ce0000-0000-0000-0000-00000000000b', 'f9ce0000-0000-0000-0000-0000000000a1', 'hue', now() - interval '2 hours', null, 'public', null),
 ('f9ce0000-0000-0000-0000-0000000000c3', 'f9ce0000-0000-0000-0000-00000000000c', 'f9ce0000-0000-0000-0000-0000000000a1', 'hue', now() - interval '3 hours', 'Hidden words.', 'public', now()),
 ('f9ce0000-0000-0000-0000-0000000000c5', 'f9ce0000-0000-0000-0000-00000000000e', 'f9ce0000-0000-0000-0000-0000000000a1', 'hue', now() - interval '5 hours', 'Hidden too.', 'public', now());
insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
 ('f9ce0000-0000-0000-0000-000000000102', 'f9ce0000-0000-0000-0000-0000000000c2', 'f9ce0000-0000-0000-0000-00000000000b', 1,
  'f9ce0000-0000-0000-0000-00000000000b/f9ce0000-0000-0000-0000-0000000000c2/f9ce0000-0000-0000-0000-000000000102.jpg', 10, 10, 1),
 ('f9ce0000-0000-0000-0000-000000000105', 'f9ce0000-0000-0000-0000-0000000000c5', 'f9ce0000-0000-0000-0000-00000000000e', 1,
  'f9ce0000-0000-0000-0000-00000000000e/f9ce0000-0000-0000-0000-0000000000c5/f9ce0000-0000-0000-0000-000000000105.jpg', 10, 10, 1);

do $$
declare
  r constant text := 'f9ce0000-0000-0000-0000-000000000010';
  j jsonb;
  got text;
begin
  set local role rls_client;
  perform set_config('test.uid', r, true);
  j := public.place_guest_reviews('np-sen');
  reset role;
  select string_agg((v ->> 'handle') || ':' || coalesce(v ->> 'note', '-') || ':' || coalesce(jsonb_array_length(v -> 'photos'), 0), ' ; ')
    into got from jsonb_array_elements(j -> 'visits') v;
  -- Ann's words alone, Bao's photo alone, Eve's photo with her hidden
  -- words not sent; Chi's has nothing to show.
  assert got = 'npann:Words only.:0 ; npbao:-:1 ; npeve:-:1', format('words or a photograph: %s', got);

  set local role rls_client;
  perform set_config('test.uid', r, true);
  j := public.featured_checkins('hue');
  reset role;
  assert jsonb_array_length(j) = 1, format('one place, one card: %s', j);
  -- Ann's, written, fronts it; three people went (Ann, Bao, Eve); her
  -- visit has no photograph, so the place's marked, shown cover comes
  -- with it.
  assert j -> 0 ->> 'handle' = 'npann', format('the written one fronts: %s', j);
  assert (j -> 0 ->> 'visitors')::int = 3, format('three people with something to show: %s', j);
  assert j -> 0 -> 'photo' = 'null'::jsonb or j -> 0 -> 'photo' is null, format('no photo of hers: %s', j);
  assert j -> 0 -> 'cover' ->> 'uri' = 'https://x/cover.jpg', format('the place''s cover: %s', j);

  -- The desk hides Ann's words too: Bao's photograph fronts, with its own
  -- photo, and the cover is still sent beside it.
  update public.checkins set note_hidden_at = now() where id = 'f9ce0000-0000-0000-0000-0000000000c1';
  set local role rls_client;
  perform set_config('test.uid', r, true);
  j := public.featured_checkins('hue');
  reset role;
  assert j -> 0 ->> 'handle' = 'npbao' and (j -> 0 ->> 'visitors')::int = 2
     and j -> 0 -> 'photo' ->> 'id' = 'f9ce0000-0000-0000-0000-000000000102',
    format('words gone, the photograph is left: %s', j);
end $$;
