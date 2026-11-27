-- "Hoạt động nổi bật" (20261126150000, by place since 20261126210000):
-- this week's public check-ins with a photo, in one city, a card a place
-- and a person fronting one card at most; today's before yesterday's,
-- then more people, others' hearts, a friend's, a written one, newest;
-- closed by what closes a visit anywhere else.
--
--   f8…0a  Ann: Omu three days ago (hearted by the reader), Pho an hour ago
--   f8…0b  Bao: Omu, eight days ago
--   f8…0c  Chi: Omu, no photo
--   f8…0d  Dan: Omu, friends only — the reader's friend
--   f8…0e  Eve: public with a photo, in another city
--   f8…0f  Fay: Omu, newest of all — the reader's blocker
--   f8…11  Gia: Pho yesterday with no note, Bun two days ago
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
 ('f8fe0000-0000-0000-0000-0000000000a2', 'fc-sea', 'danang', true, 'approved', 'Sea', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a3', 'fc-pho', 'hanoi', true, 'approved', 'Pho', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a4', 'fc-bun', 'hanoi', true, 'approved', 'Bun', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a5', 'fc-xoi', 'hanoi', true, 'approved', 'Xoi', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a6', 'fc-che', 'hanoi', true, 'approved', 'Che', '{eats}'),
 ('f8fe0000-0000-0000-0000-0000000000a7', 'fc-com', 'hanoi', true, 'approved', 'Com', '{eats}');
insert into public.friendships (requester, addressee, status) values
 ('f8fe0000-0000-0000-0000-00000000000d', 'f8fe0000-0000-0000-0000-000000000010', 'accepted');
insert into public.blocks (blocker, blocked) values
 ('f8fe0000-0000-0000-0000-00000000000f', 'f8fe0000-0000-0000-0000-000000000010');

insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
 ('f8fe0000-0000-0000-0000-0000000000c1', 'f8fe0000-0000-0000-0000-00000000000a', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '3 days', 'Hearted.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c2', 'f8fe0000-0000-0000-0000-00000000000a', 'f8fe0000-0000-0000-0000-0000000000a3', 'hanoi',  now() - interval '1 hour', 'Newer.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c3', 'f8fe0000-0000-0000-0000-00000000000b', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '8 days', 'Old.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c4', 'f8fe0000-0000-0000-0000-00000000000c', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '2 hours', 'No photo.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c5', 'f8fe0000-0000-0000-0000-00000000000d', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '2 hours', 'Friends.', 'friends'),
 ('f8fe0000-0000-0000-0000-0000000000c6', 'f8fe0000-0000-0000-0000-00000000000e', 'f8fe0000-0000-0000-0000-0000000000a2', 'danang', now() - interval '2 hours', 'Elsewhere.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c7', 'f8fe0000-0000-0000-0000-00000000000f', 'f8fe0000-0000-0000-0000-0000000000a1', 'hanoi',  now() - interval '1 minute', 'Blocked.', 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c8', 'f8fe0000-0000-0000-0000-000000000011', 'f8fe0000-0000-0000-0000-0000000000a3', 'hanoi',  now() - interval '25 hours', null, 'public'),
 ('f8fe0000-0000-0000-0000-0000000000c9', 'f8fe0000-0000-0000-0000-000000000011', 'f8fe0000-0000-0000-0000-0000000000a4', 'hanoi',  now() - interval '50 hours', 'Bun.', 'public');

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
    (8, 'f8fe0000-0000-0000-0000-0000000000c8', 'f8fe0000-0000-0000-0000-000000000011'),
    (9, 'f8fe0000-0000-0000-0000-0000000000c9', 'f8fe0000-0000-0000-0000-000000000011')
  ) as t(n, c, u);
insert into public.checkin_likes (checkin_id, user_id) values
 ('f8fe0000-0000-0000-0000-0000000000c1', 'f8fe0000-0000-0000-0000-000000000010');

-- One reader's shelf, as "handle:note:likes*:photo:people:faces ; …".
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
           || ':' || coalesce(right(v -> 'photo' ->> 'id', 3), 'nophoto')
           || ':' || (v ->> 'visitors')
           || ':' || (select string_agg(f ->> 'handle', '+' order by n)
                        from jsonb_array_elements(v -> 'faces') with ordinality as x(f, n)),
           ' ; ' order by ord), '')
    into out
    from jsonb_array_elements(j) with ordinality as e(v, ord);
  return out;
end $$;

-- A public visit with one photo, `ago` back.
create function public._fc_visit(n int, who text, place text, ago interval, words text) returns void
language sql set search_path = public as $$
  insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
    (('f8fe0000-0000-0000-0000-0000000000d' || n)::uuid, ('f8fe0000-0000-0000-0000-0000000000' || who)::uuid,
     ('f8fe0000-0000-0000-0000-0000000000' || place)::uuid, 'hanoi', now() - ago, words, 'public');
  insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
    (('f8fe0000-0000-0000-0000-00000000020' || n)::uuid, ('f8fe0000-0000-0000-0000-0000000000d' || n)::uuid,
     ('f8fe0000-0000-0000-0000-0000000000' || who)::uuid, 1,
     'f8fe0000-0000-0000-0000-0000000000' || who || '/f8fe0000-0000-0000-0000-0000000000d' || n
       || '/f8fe0000-0000-0000-0000-00000000020' || n || '.jpg', 10, 10, 1);
$$;

do $$
declare
  r constant text := 'f8fe0000-0000-0000-0000-000000000010';
  got text;
begin
  -- Pho first: today, and two people — Ann fronts it, hers has words.
  -- Then Bun, two days back, Gia's. Omu is three days back and its one
  -- counted visitor is Ann, who fronts Pho already: left out. Bao's is
  -- too old, Chi's has no photo, Dan's is for friends, Fay blocked the
  -- reader — none is counted among Omu's people.
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcann:Newer.:0:102:2:fcann+fcgia ; fcgia:Bun.:0:109:1:fcgia ; fcann:Hearted.:1*:101:1:fcann',
    format('a card a place, a person fronting more than one: %s', got);

  got := public._fc_read(r, 'danang');
  assert got = 'fceve:Elsewhere.:0:106:1:fceve', format('a city asks for its own: %s', got);

  -- Signed out: not the caller's to ask.
  begin
    set local role anon;
    perform public.featured_checkins('hanoi');
    reset role;
    raise exception 'anon was let in';
  exception when insufficient_privilege then
    reset role;
  end;
  -- Nor is the list under it anybody's to read directly.
  begin
    set local role rls_client;
    perform set_config('test.uid', r, true);
    perform public._featured_visits('hanoi');
    reset role;
    raise exception 'the visits were let out';
  exception when insufficient_privilege then
    reset role;
  end;

  -- The desk hides Ann's at Pho: Pho is Gia's alone and yesterday's, so
  -- Gia fronts it and cannot front Bun; Ann is free, and Omu comes back
  -- with the heart the reader gave it.
  update public.checkins set hidden_at = now() where id = 'f8fe0000-0000-0000-0000-0000000000c2';
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcgia:-:0:108:1:fcgia ; fcgia:Bun.:0:109:1:fcgia ; fcann:Hearted.:1*:101:1:fcann',
    format('hidden, the place is whoever is left; a day is before a heart: %s', got);

  -- A hidden note is not sent; the visit stays, it is the photo's shelf.
  update public.checkins set note_hidden_at = now() where id = 'f8fe0000-0000-0000-0000-0000000000c1';
  got := public._fc_read(r, 'hanoi');
  assert got like '% ; fcann:-:1*:101:1:fcann', format('the note held back: %s', got);

  -- ── the order inside a day ──
  -- Three places today, one person each: Bao at Xoi (3h), Chi at Che
  -- (4h), and Dan — the reader's friend — at Com (5h). Nothing else
  -- apart, the friend's leads and the rest are newest first.
  perform public._fc_visit(1, '0b', 'a5', interval '3 hours', null);
  perform public._fc_visit(2, '0c', 'a6', interval '4 hours', null);
  perform public._fc_visit(3, '0d', 'a7', interval '5 hours', null);
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcdan:-:0:203:1:fcdan ; fcbao:-:0:201:1:fcbao ; fcchi:-:0:202:1:fcchi ; fcgia:%',
    format('a friend''s, then newest: %s', got);

  -- Words go before a friend's silence only after it: Chi writes, and
  -- still follows Dan, but passes Bao.
  update public.checkins set note = 'Sweet.' where id = 'f8fe0000-0000-0000-0000-0000000000d2';
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcdan:%; fcchi:Sweet.:0:202:1:fcchi ; fcbao:%', format('written before unwritten: %s', got);

  -- A heart on your own visit is shown and moves nothing.
  insert into public.checkin_likes (checkin_id, user_id) values
    ('f8fe0000-0000-0000-0000-0000000000d1', 'f8fe0000-0000-0000-0000-00000000000b');
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcdan:%; fcchi:%; fcbao:-:1:201:1:fcbao ; %', format('your own heart is not a vote: %s', got);

  -- Somebody else's is, and goes before the friend's place.
  insert into public.checkin_likes (checkin_id, user_id) values
    ('f8fe0000-0000-0000-0000-0000000000d1', 'f8fe0000-0000-0000-0000-000000000011');
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcbao:-:2:201:1:fcbao ; fcdan:%; fcchi:%', format('hearts before a friend: %s', got);

  -- And people before hearts: Gia goes to Che too. Chi still fronts it —
  -- hers has the words — with Gia's face beside hers, and Gia, fronting
  -- nothing yet, keeps Pho.
  perform public._fc_visit(4, '11', 'a6', interval '6 hours', null);
  got := public._fc_read(r, 'hanoi');
  assert got like 'fcchi:Sweet.:0:202:2:fcchi+fcgia ; fcbao:%; fcdan:%; fcgia:-:0:108:1:fcgia ; fcgia:Bun.:0:109:1:fcgia ; fcann:%',
    format('two people before two hearts: %s', got);

  -- ── the card's words and faces (20261126220000) ──
  -- Eve goes to Xoi an hour ago, after Bao, and writes nothing. Bao's
  -- visit has Gia's heart, so his still fronts it, and the faces are
  -- whoever was there last first: Eve's before his.
  perform public._fc_visit(5, '0e', 'a5', interval '1 hour', null);
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcbao:-:2:201:2:fceve+fcbao ; fcchi:Sweet.:0:202:2:fcchi+fcgia ; fcdan:-:0:203:1:fcdan ; '
            || 'fcgia:-:0:108:1:fcgia ; fcgia:Bun.:0:109:1:fcgia ; fcann:-:1*:101:1:fcann',
    format('hearted over newest; faces newest first: %s', got);

  -- Gia writes about Che too, and the reader hearts it: of two written
  -- visits the hearted one fronts, though Chi's is newer. Gia fronts
  -- Che, Pho and Bun — three, under the seven. Che, written, now leads
  -- Xoi on the tie in people and hearts.
  update public.checkins set note = 'Cool.' where id = 'f8fe0000-0000-0000-0000-0000000000d4';
  insert into public.checkin_likes (checkin_id, user_id) values ('f8fe0000-0000-0000-0000-0000000000d4', r::uuid);
  got := public._fc_read(r, 'hanoi');
  assert got = 'fcgia:Cool.:1*:204:2:fcchi+fcgia ; fcbao:-:2:201:2:fceve+fcbao ; fcdan:-:0:203:1:fcdan ; '
            || 'fcgia:-:0:108:1:fcgia ; fcgia:Bun.:0:109:1:fcgia ; fcann:-:1*:101:1:fcann',
    format('of two written, the hearted one: %s', got);

  -- ── seven a person (20261127090000) ──
  -- Bao's week in Da Nang: eight places, one an hour, each his alone. He
  -- fronts the seven newest; the eighth — the oldest — is left out. Eve's,
  -- which is hers, leads them all: as old a day, as many people, but
  -- written.
  for i in 1..8 loop
    insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
      (('f8fe0000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid, 'fc-dn-' || i, 'danang', true, 'approved', 'Dn' || i, '{eats}');
    insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
      (('f8fe0000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid, 'f8fe0000-0000-0000-0000-00000000000b',
       ('f8fe0000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid, 'danang', now() - make_interval(mins => 10 * i), null, 'public');
    insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
      (('f8fe0000-0000-0000-0000-0000000005' || lpad(i::text, 2, '0'))::uuid, ('f8fe0000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid,
       'f8fe0000-0000-0000-0000-00000000000b', 1,
       'f8fe0000-0000-0000-0000-00000000000b/f8fe0000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0')
         || '/f8fe0000-0000-0000-0000-0000000005' || lpad(i::text, 2, '0') || '.jpg', 10, 10, 1);
  end loop;
  got := public._fc_read(r, 'danang');
  assert got = 'fceve:Elsewhere.:0:106:1:fceve ; fcbao:-:0:501:1:fcbao ; fcbao:-:0:502:1:fcbao ; fcbao:-:0:503:1:fcbao ; '
            || 'fcbao:-:0:504:1:fcbao ; fcbao:-:0:505:1:fcbao ; fcbao:-:0:506:1:fcbao ; fcbao:-:0:507:1:fcbao',
    format('seven a person, the eighth left out: %s', got);
end $$;

drop function public._fc_visit(int, text, text, interval, text);
drop function public._fc_read(text, text);
