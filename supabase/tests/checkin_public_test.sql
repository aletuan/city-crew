-- A visit anybody signed in can see (`20261125200000_checkin_public.sql`):
-- that the answer is taken and nothing else new is; that a public visit
-- reaches a stranger, a friend and its owner, and nobody signed out or
-- blocked; that the read says 'public' to a reader who is not the owner
-- and still says nothing about 'friends'; who may heart it; and that its
-- photos are readable to whoever may read the visit.
--
--   f5…0a  the visitor   f5…0b  a friend   f5…0c  a stranger   f5…0d  blocked by a
--   f5…a1 / a2 / a3  three places
--   c1  Cong, public, noted        c2  Pho, friends        c3  Bun, never answered

grant usage on schema public, storage to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f5ec0000-0000-0000-0000-00000000000a', 'pu-a@x.com', '{"handle":"pua"}'),
 ('f5ec0000-0000-0000-0000-00000000000b', 'pu-b@x.com', '{"handle":"pub"}'),
 ('f5ec0000-0000-0000-0000-00000000000c', 'pu-c@x.com', '{"handle":"puc"}'),
 ('f5ec0000-0000-0000-0000-00000000000d', 'pu-d@x.com', '{"handle":"pud"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f5ec0000-0000-0000-0000-0000000000a1', 'pu-cong', 'hanoi', true, 'approved', 'Cong', '{cafes}'),
 ('f5ec0000-0000-0000-0000-0000000000a2', 'pu-pho',  'hanoi', true, 'approved', 'Pho',  '{eats}'),
 ('f5ec0000-0000-0000-0000-0000000000a3', 'pu-bun',  'hanoi', true, 'approved', 'Bun',  '{eats}');
insert into public.friendships (requester, addressee, status) values
 ('f5ec0000-0000-0000-0000-00000000000a', 'f5ec0000-0000-0000-0000-00000000000b', 'accepted');
insert into public.blocks (blocker, blocked) values
 ('f5ec0000-0000-0000-0000-00000000000a', 'f5ec0000-0000-0000-0000-00000000000d');
insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
 ('f5ec0000-0000-0000-0000-0000000000c1', 'f5ec0000-0000-0000-0000-00000000000a', 'f5ec0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-24 03:00+00', 'For everyone.', 'public'),
 ('f5ec0000-0000-0000-0000-0000000000c2', 'f5ec0000-0000-0000-0000-00000000000a', 'f5ec0000-0000-0000-0000-0000000000a2', 'hanoi', '2026-11-23 03:00+00', null, 'friends'),
 ('f5ec0000-0000-0000-0000-0000000000c3', 'f5ec0000-0000-0000-0000-00000000000a', 'f5ec0000-0000-0000-0000-0000000000a3', 'hanoi', '2026-11-22 03:00+00', null, null);
insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
 ('f5ec0000-0000-0000-0000-0000000000f1', 'f5ec0000-0000-0000-0000-0000000000c1', 'f5ec0000-0000-0000-0000-00000000000a', 1,
  'f5ec0000-0000-0000-0000-00000000000a/f5ec0000-0000-0000-0000-0000000000c1/f5ec0000-0000-0000-0000-0000000000f1.jpg', 10, 10, 10),
 ('f5ec0000-0000-0000-0000-0000000000f2', 'f5ec0000-0000-0000-0000-0000000000c2', 'f5ec0000-0000-0000-0000-00000000000a', 1,
  'f5ec0000-0000-0000-0000-00000000000a/f5ec0000-0000-0000-0000-0000000000c2/f5ec0000-0000-0000-0000-0000000000f2.jpg', 10, 10, 10);

create function public._pu_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._pu_why(text) to rls_client, anon;

-- A person's page as one reader gets it: "slug|note|audience|likes*".
create function public._pu_reads(as_user text, person text) returns text
language plpgsql set search_path = public as $$
declare out text;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select coalesce(string_agg(
           r.place_slug || '|' || coalesce(r.note, '-') || '|' || coalesce(r.audience, '-')
           || '|' || r.likes || (case when r.liked then '*' else '' end), ' ; '), '')
    into out
    from public.person_checkins(person::uuid) r;
  reset role;
  return out;
exception when others then
  reset role;
  return 'refused: ' || sqlerrm;
end $$;

-- Whether one reader may read one photo object, as Storage asks.
create function public._pu_photo(as_user text, path text) returns boolean
language plpgsql set search_path = public as $$
declare ok boolean;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  ok := public.checkin_photo_readable(path);
  reset role;
  return ok;
end $$;

do $$
declare
  a constant text := 'f5ec0000-0000-0000-0000-00000000000a';
  b constant text := 'f5ec0000-0000-0000-0000-00000000000b';
  c constant text := 'f5ec0000-0000-0000-0000-00000000000c';
  d constant text := 'f5ec0000-0000-0000-0000-00000000000d';
  k1 constant text := 'f5ec0000-0000-0000-0000-0000000000c1';
  k2 constant text := 'f5ec0000-0000-0000-0000-0000000000c2';
  p1 constant text := a || '/' || k1 || '/f5ec0000-0000-0000-0000-0000000000f1.jpg';
  p2 constant text := a || '/' || k2 || '/f5ec0000-0000-0000-0000-0000000000f2.jpg';
  got text; why text;
begin
  -- ── the answer ──
  why := public._pu_why(format('update public.checkins set audience = %L where id = %L', 'everyone', k2));
  assert why like '%checkins_audience_known%', format('an answer that is not one of the three is refused: %s', why);

  -- ── who reads ──
  got := public._pu_reads(a, a);
  assert got = 'pu-cong|For everyone.|public|0 ; pu-pho|-|friends|0 ; pu-bun|-|-|0',
    format('the owner reads every visit, each with its answer: %s', got);

  got := public._pu_reads(c, a);
  assert got = 'pu-cong|For everyone.|public|0',
    format('a stranger reads the public visit alone, told it is public: %s', got);

  got := public._pu_reads(b, a);
  assert got = 'pu-cong|For everyone.|public|0 ; pu-pho|-|-|0',
    format('a friend reads both shared visits, told nothing about the friends one: %s', got);

  got := public._pu_reads(d, a);
  assert got = '', format('a reader the owner blocked reads nothing, public or not: %s', got);

  got := public._pu_reads('', a);
  assert got like 'refused:%', format('signed out, the read is still not theirs: %s', got);

  -- ── the photos follow the visit ──
  assert public._pu_photo(c, p1), 'a stranger may read a photo on a public visit';
  assert not public._pu_photo(c, p2), 'a stranger may not read a photo on a friends visit';
  assert not public._pu_photo(d, p1), 'a blocked reader may not read a photo on a public visit';

  -- ── the heart ──
  set local role rls_client;
  perform set_config('test.uid', c, true);
  perform public.like_checkin(k1::uuid, true);
  why := public._pu_why(format('select public.like_checkin(%L, true)', k2));
  reset role;
  assert why = 'checkin:unseen', format('a stranger hearts no friends visit: %s', why);
  got := public._pu_reads(a, a);
  assert got like 'pu-cong|For everyone.|public|1 ;%', format('the stranger''s heart is counted: %s', got);

  set local role rls_client;
  perform set_config('test.uid', d, true);
  why := public._pu_why(format('select public.like_checkin(%L, true)', k1));
  reset role;
  assert why = 'checkin:unseen', format('a blocked reader hearts nothing: %s', why);

  -- A private visit takes no heart, even its owner's: widening the
  -- answers that may be hearted must not have widened them to all.
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._pu_why(format('select public.like_checkin(%L, true)', 'f5ec0000-0000-0000-0000-0000000000c3'));
  reset role;
  assert why = 'checkin:unseen', format('the owner hearts no unanswered visit: %s', why);
  update public.checkins set audience = 'private' where id = 'f5ec0000-0000-0000-0000-0000000000c3'::uuid;
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._pu_why(format('select public.like_checkin(%L, true)', 'f5ec0000-0000-0000-0000-0000000000c3'));
  reset role;
  assert why = 'checkin:unseen', format('nor a private one: %s', why);

  -- ── taken back ──
  -- Public → private: the stranger reads nothing, the heart stays where
  -- it is (as Friends → private leaves it), the photo is closed.
  update public.checkins set audience = 'private' where id = k1::uuid;
  got := public._pu_reads(c, a);
  assert got = '', format('made private, the stranger reads nothing: %s', got);
  assert not public._pu_photo(c, p1), 'and the photo is closed to them';
end $$;

drop function public._pu_reads(text, text);
drop function public._pu_why(text);
drop function public._pu_photo(text, text);
