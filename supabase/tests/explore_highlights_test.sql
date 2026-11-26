-- "Hoạt động nổi bật" (20261126150000): this week's public check-ins
-- with a photo, in one city, one a person (their most hearted), hearts
-- then newest; closed by what closes a visit anywhere else.
--
--   f8…0a  Ann: two public with photos this week (the hearted one shown)
--   f8…0b  Bao: public with a photo, eight days ago
--   f8…0c  Chi: public, no photo
--   f8…0d  Dan: friends, with a photo
--   f8…0e  Eve: public with a photo, in another city
--   f8…0f  Fay: public with a photo, newest of all — the reader's blocker
--   f8…11  Gia: public with a photo, no note, yesterday
--   f8…10  the reader

grant usage on schema public, storage to rls_client, anon;

-- The visits earlier files left in these cities are not this file's to
-- count; the database is thrown away after the run.
delete from public.checkins where city_id in ('hanoi', 'danang');

insert into auth.users (id, email, raw_user_meta_data) values
 ('f8fe0000-0000-0000-0000-00000000000a', 'fc-a@x.com', '{"handle":"fcann"}'),
 ('f8fe0000-0000-0000-0000-00000000000b', 'fc-b@x.com', '{"handle":"fcbao"}'),
 ('f8fe0000-0000-0000-0000-00000000000c', 'fc-c@x.com', '{"handle":"fcchi"}'),
 ('f8fe0000-0000-0000-0000-00000000000d', 'fc-d@x.com', '{"handle":"fcdan"}'),
 ('f8fe0000-0000-0000-0000-00000000000e', 'fc-e@x.com', '{"handle":"fceve"}'),
 ('f8fe0000-0000-0000-0000-00000000000f', 'fc-f@x.com', '{"handle":"fcfay"}'),
 ('f8fe0000-0000-0000-0000-000000000011', 'fc-g@x.com', '{"handle":"fcgia"}'),
 ('f8fe0000-0000-0000-0000-000000000010', 'fc-r@x.com', '{"handle":"fcreader"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f8fe0000-0000-0000-0000-0000000000a1', 'fc-omu', 'hanoi', true, 'approved', 'Omu', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a2', 'fc-sea', 'danang', true, 'approved', 'Sea', '{eats}');
insert into public.friendships (requester, addressee, status) values
 ('f8fe0000-0000-0000-0000-00000000000d', 'f8fe0000-0000-0000-0000-000000000010', 'accepted');
insert into public.blocks (blocker, blocked) values
 ('f8fe0000-0000-0000-0000-00000000000f', 'f8fe0000-0000-0000-0000-000000000010');

insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
 ('f8fe0000-0000-0000-0000-0000000000c1', 'f8fe0000-0000-0000-0000-00000000000a', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '3 days', 'Hearted.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c2', 'f8fe0000-0000-0000-0000-00000000000a', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '1 hour', 'Newer.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c3', 'f8fe0000-0000-0000-0000-00000000000b', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '8 days', 'Old.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c4', 'f8fe0000-0000-0000-0000-00000000000c', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '2 hours', 'No photo.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c5', 'f8fe0000-0000-0000-0000-00000000000d', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '2 hours', 'Friends.', 'friends'),
 ('f8fe0000-0000-0000-0000-0000000000c6', 'f8fe0000-0000-0000-0000-00000000000e', 'f8fe0000-0000-0000-0000-0000000000a2', 'danang', now() - interval '2 hours', 'Elsewhere.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c7', 'f8fe0000-0000-0000-0000-00000000000f', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '1 minute', 'Blocked.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c8', 'f8fe0000-0000-0000-0000-000000000011', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '1 day', null, 'public');

insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes)
select ('f8fe0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, c::uuid, u::uuid, 1,
       u || '/' || c || '/f8fe0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0') || '.jpg', 10, 10, 1
  from (values
    (1, 'f8fe0000-0000-0000-0000-0000000000c1', 'f8fe0000-0000-0000-0000-00000000000a'),
    (2, 'f8fe0000-0000-0000-0000-0000000000c2', 'f8fe0000-0000-0000-0000-00000000000a'),
    (3, 'f8fe0000-0000-0000-0000-0000000000c3', 'f8fe0000-0000-0000-0000-00000000000b'),
    (5, 'f8fe0000-0000-0000-0000-0000000000c5', 'f8fe0000-0000-0000-0000-00000000000d'),
    (6, 'f8fe0000-0000-0000-0000-0000000000c6', 'f8fe0000-0000-0000-0000-00000000000e'),
    (7, 'f8fe0000-0000-0000-0000-0000000000c7', 'f8fe0000-0000-0000-0000-00000000000f'),
    (8, 'f8fe0000-0000-0000-0000-0000000000c8', 'f8fe0000-0000-0000-0000-000000000011')
  ) as t(n, c, u);
insert into public.checkin_likes (checkin_id, user_id) values
 ('f8fe0000-0000-0000-0000-0000000000c1', 'f8fe0000-0000-0000-0000-000000000010');

-- One reader's shelf, as "handle:note:likes* ; …".
create function public._fc_read(as_user text, city text) returns text
language plpgsql set search_path = public as $$
declare j jsonb; out text;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  j := public.featured_checkins(city);
  reset role;
  select coalesce(string_agg(
           (v ->> 'handle') || ':' || coalesce(v ->> 'note', '-') || ':' || (v ->> 'likes')
           || (case when (v ->> 'liked')::boolean then '*' else '' end)
           || ':' || coalesce(v -> 'photo' ->> 'id', 'nophoto'), ' ; ' order by ord), '')
    into out
    from jsonb_array_elements(j) with ordinality as e(v, ord);
  return out;
end $$;

do $$
declare
  r constant text := 'f8fe0000-0000-0000-0000-000000000010';
  got text; why text;
begin
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcann:Hearted.:1*:f8fe0000-0000-0000-0000-000000000101 ; fcgia:-:0:f8fe0000-0000-0000-0000-000000000108',
    format('Ann''s hearted one first, then Gia''s; nobody else qualifies: %s', got);

  got := public._fc_read(r, 'danang');
  assert got = 'fceve:Elsewhere.:0:f8fe0000-0000-0000-0000-000000000106', format('a city asks for its own: %s', got);

  -- Signed out: not the caller's to ask.
  begin
    set local role anon;
    perform public.featured_checkins('hanoi');
    reset role;
    raise exception 'anon was let in';
  exception when insufficient_privilege then
    reset role;
  end;

  -- The desk hides Ann's hearted one: her newer one steps in, and it is
  -- newer than Gia's, so it leads on the tie.
  update public.checkins set hidden_at = now() where id = 'f8fe0000-0000-0000-0000-0000000000c1';
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcann:Newer.:0:f8fe0000-0000-0000-0000-000000000102 ; fcgia:-:0:f8fe0000-0000-0000-0000-000000000108',
    format('hidden, the next of hers; ties go to the newest: %s', got);

  -- A hidden note is not sent; the visit stays, it is the photo's shelf.
  update public.checkins set note_hidden_at = now() where id = 'f8fe0000-0000-0000-0000-0000000000c2';
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcann:-:0:%', format('the note held back: %s', got);
end $$;

drop function public._fc_read(text, text);
