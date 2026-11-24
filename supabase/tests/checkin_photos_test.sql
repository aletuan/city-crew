-- Photos on a check-in (`20261124230000_checkin_photos.sql`): where the
-- next one goes and when it may not; the rows' shape and owner; that no
-- client writes the bucket; who may read an object; and what a person's
-- page is sent.
--
--   f2…0a  the visitor     f2…0b  a friend     f2…0c  a stranger
--   f2…a1  a place
--   f2…c1  a visit shared with friends    f2…c2  a visit kept private

grant usage on schema public, storage to rls_client, anon;
grant select, insert, update, delete on storage.objects to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f2ec0000-0000-0000-0000-00000000000a', 'cp-a@x.com', '{"handle":"cpa"}'),
 ('f2ec0000-0000-0000-0000-00000000000b', 'cp-b@x.com', '{"handle":"cpb"}'),
 ('f2ec0000-0000-0000-0000-00000000000c', 'cp-c@x.com', '{"handle":"cpc"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f2ec0000-0000-0000-0000-0000000000a1', 'cp-cong', 'hanoi', true, 'approved', 'Cong', '{cafes}');
insert into public.friendships (requester, addressee, status) values
 ('f2ec0000-0000-0000-0000-00000000000a', 'f2ec0000-0000-0000-0000-00000000000b', 'accepted');
insert into public.checkins (id, user_id, place_id, city_id, audience) values
 ('f2ec0000-0000-0000-0000-0000000000c1', 'f2ec0000-0000-0000-0000-00000000000a', 'f2ec0000-0000-0000-0000-0000000000a1', 'hanoi', 'friends'),
 ('f2ec0000-0000-0000-0000-0000000000c2', 'f2ec0000-0000-0000-0000-00000000000a', 'f2ec0000-0000-0000-0000-0000000000a1', 'hanoi', 'private');

-- A photo as the Edge Function writes it: the row with its own id in the
-- path, and the object at that path.
create function public._cp_add(owner_id text, visit text, pos int) returns text
language plpgsql set search_path = public as $$
declare pid uuid := gen_random_uuid(); p text;
begin
  p := owner_id || '/' || visit || '/' || pid::text || '.jpg';
  insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes)
  values (pid, visit::uuid, owner_id::uuid, pos, p, 1200, 900, 150000);
  insert into storage.objects (bucket_id, name, owner) values ('checkin-photos', p, owner_id::uuid);
  return p;
end $$;

create function public._cp_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._cp_why(text) to rls_client, anon;

-- How many of the given paths a reader may read in the bucket.
create function public._cp_sees(as_user text, paths text[]) returns int
language plpgsql set search_path = public as $$
declare n int;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select count(*) into n from storage.objects where bucket_id = 'checkin-photos' and name = any (paths);
  reset role;
  return n;
exception when others then
  reset role;
  return -1;
end $$;

do $$
declare
  a constant text := 'f2ec0000-0000-0000-0000-00000000000a';
  b constant text := 'f2ec0000-0000-0000-0000-00000000000b';
  c constant text := 'f2ec0000-0000-0000-0000-00000000000c';
  shared constant text := 'f2ec0000-0000-0000-0000-0000000000c1';
  mine constant text := 'f2ec0000-0000-0000-0000-0000000000c2';
  p1 text; p2 text; p3 text; pm text; why text; n int; slot int; got jsonb; pub boolean;
begin
  -- ── the bucket ──
  select public into pub from storage.buckets where id = 'checkin-photos';
  assert pub = false, 'the bucket is private';

  -- ── where the next photo goes ──
  assert public.checkin_photo_slot(a::uuid, shared::uuid) = 1, 'an empty visit takes its first';
  p1 := public._cp_add(a, shared, 1);
  p2 := public._cp_add(a, shared, 2);
  assert public.checkin_photo_slot(a::uuid, shared::uuid) = 3, 'the third after two';
  p3 := public._cp_add(a, shared, 3);
  why := public._cp_why(format('select public.checkin_photo_slot(%L, %L)', a, shared));
  assert why = 'photo:full', format('a fourth is refused: %s', why);
  -- A gap is filled first.
  delete from public.checkin_photos where path = p2;
  delete from storage.objects where name = p2;
  assert public.checkin_photo_slot(a::uuid, shared::uuid) = 2, 'the gap left by a deleted photo is filled first';
  p2 := public._cp_add(a, shared, 2);

  -- Not another account's visit.
  why := public._cp_why(format('select public.checkin_photo_slot(%L, %L)', b, shared));
  assert why = 'photo:not_yours', format('a slot on somebody else''s visit: %s', why);

  -- No client may ask.
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._cp_why(format('select public.checkin_photo_slot(%L, %L)', a, shared));
  reset role;
  assert why like 'permission denied%', format('the caps are not a client''s to ask: %s', why);

  -- ── the rows' shape and owner ──
  why := public._cp_why(format(
    'insert into public.checkin_photos (checkin_id, user_id, position, path, width, height, bytes) values (%L, %L, 1, %L, 10, 10, 10)',
    mine, a, a || '/' || mine || '/chosen.jpg'));
  assert why like '%checkin_photos_path_shape%', format('a path that is not the row''s own is refused: %s', why);
  why := public._cp_why(format(
    'insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values (%L, %L, %L, 1, %L, 10, 10, 10)',
    'f2ec0000-0000-0000-0000-0000000000f1', mine, b, b || '/' || mine || '/f2ec0000-0000-0000-0000-0000000000f1.jpg'));
  assert why = 'photo:not_yours', format('a photo on a visit that is not the writer''s is refused: %s', why);
  why := public._cp_why(format(
    'insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values (%L, %L, %L, 1, %L, 4000, 10, 10)',
    'f2ec0000-0000-0000-0000-0000000000f2', mine, a, a || '/' || mine || '/f2ec0000-0000-0000-0000-0000000000f2.jpg'));
  assert why like '%checkin_photos_width_check%', format('an edge over 1600 is refused: %s', why);

  -- ── no client writes the bucket, or the table ──
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._cp_why(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)',
    'checkin-photos', a || '/' || shared || '/own.jpg', a));
  reset role;
  assert why like '%row-level security%' or why like 'permission denied%', format('the owner cannot write the bucket: %s', why);
  set local role rls_client;
  perform set_config('test.uid', a, true);
  with d as (delete from storage.objects where bucket_id = 'checkin-photos' and name = p1 returning 1) select count(*) into n from d;
  reset role;
  assert n = 0, 'the owner cannot delete an object directly';
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._cp_why(format('delete from public.checkin_photos where path = %L', p1));
  reset role;
  assert why like 'permission denied%', format('the owner cannot delete a row directly: %s', why);

  -- ── who reads an object ──
  pm := public._cp_add(a, mine, 1);
  assert public._cp_sees(a, array[p1, p2, p3, pm]) = 4, 'the owner reads every photo of theirs';
  assert public._cp_sees(b, array[p1, p2, p3]) = 3, 'a friend reads the photos of a shared visit';
  assert public._cp_sees(b, array[pm]) = 0, 'a friend does not read a private visit''s photo';
  assert public._cp_sees(c, array[p1, pm]) = 0, 'a stranger reads nothing';
  assert public._cp_sees('', array[p1]) <= 0, 'nobody signed in reads nothing';

  -- Hidden by the desk: nobody, the owner included.
  update public.checkin_photos set hidden_at = now() where path = p3;
  assert public._cp_sees(a, array[p3]) = 0, 'a hidden photo is read by nobody, its owner included';
  assert public._cp_sees(b, array[p3]) = 0, 'nor a friend';

  -- The visit made private: its photos go with it.
  update public.checkins set audience = 'private' where id = shared::uuid;
  assert public._cp_sees(b, array[p1, p2]) = 0, 'a visit made private takes its photos from friends';
  update public.checkins set audience = 'friends' where id = shared::uuid;

  -- ── the owner's own rows, and only some columns ──
  set local role rls_client;
  perform set_config('test.uid', a, true);
  select count(*) into n from public.checkin_photos;
  reset role;
  assert n = 4, format('the owner reads their four rows, saw %s', n);
  set local role rls_client;
  perform set_config('test.uid', b, true);
  select count(*) into n from public.checkin_photos;
  reset role;
  assert n = 0, 'a friend reads no row of the table';
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._cp_why('select hidden_by from public.checkin_photos');
  reset role;
  assert why like 'permission denied%', format('who hid a photo is not its owner''s to read: %s', why);

  -- ── what a person's page is sent ──
  set local role rls_client;
  perform set_config('test.uid', b, true);
  select r.photos into got from public.person_checkins(a::uuid) r;
  reset role;
  assert jsonb_array_length(got) = 2, format('a friend is sent the two photos not hidden: %s', got);
  assert got->0->>'path' = p1 and got->1->>'path' = p2, format('in order: %s', got);
  assert got->0->>'width' = '1200', 'with their size';

  -- ── a day's fifteen, an account's three hundred ──
  -- Fifteen in the last day, on visits made for the purpose.
  insert into public.checkins (id, user_id, place_id, city_id)
  select ('f2ec0000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, a::uuid, 'f2ec0000-0000-0000-0000-0000000000a1', 'hanoi'
    from generate_series(0, 11) i;
  for n in 0..11 loop
    exit when (select count(*) from public.checkin_photos where user_id = a::uuid) >= 15;
    perform public._cp_add(a, 'f2ec0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'), 1);
  end loop;
  select count(*) into n from public.checkin_photos where user_id = a::uuid;
  assert n = 15, format('fifteen made today, saw %s', n);
  why := public._cp_why(format('select public.checkin_photo_slot(%L, %L)', a, 'f2ec0000-0000-0000-0000-000000000111'));
  assert why = 'photo:day', format('the sixteenth in a day is refused: %s', why);
  -- A day on, the day's cap is free again.
  update public.checkin_photos set created_at = now() - interval '2 days' where user_id = a::uuid;
  slot := public.checkin_photo_slot(a::uuid, 'f2ec0000-0000-0000-0000-000000000111');
  assert slot = 1, 'yesterday''s photos do not count against today';
  -- Three hundred in all, of any age.
  insert into public.checkins (id, user_id, place_id, city_id)
  select gen_random_uuid(), a::uuid, 'f2ec0000-0000-0000-0000-0000000000a1', 'hanoi' from generate_series(1, 95);
  perform public._cp_add(a, c2.id::text, pos)
    from public.checkins c2, generate_series(1, 3) pos
   where c2.user_id = a::uuid and c2.id::text not like 'f2ec0000%';
  update public.checkin_photos set created_at = now() - interval '2 days' where user_id = a::uuid;
  select count(*) into n from public.checkin_photos where user_id = a::uuid;
  assert n >= 300, format('three hundred made, saw %s', n);
  why := public._cp_why(format('select public.checkin_photo_slot(%L, %L)', a, 'f2ec0000-0000-0000-0000-000000000111'));
  assert why = 'photo:account', format('past three hundred in all is refused: %s', why);

  -- ── gone with the visit ──
  delete from public.checkins where id = shared::uuid;
  select count(*) into n from public.checkin_photos where checkin_id = shared::uuid;
  assert n = 0, 'a removed visit takes its photo rows';
end $$;

drop function public._cp_add(text, text, int);
drop function public._cp_why(text);
drop function public._cp_sees(text, text[]);
