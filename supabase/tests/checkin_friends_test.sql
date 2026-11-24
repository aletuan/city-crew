-- A visit a friend can see, and a heart on it
-- (`20261124150000_checkin_friends.sql`): what `person_checkins` answers
-- to the owner, a friend, a stranger, a blocked friend and nobody; that
-- it gives the day and never the hour; one row a place; and who may
-- heart what.
--
--   f1…0a  the visitor
--   f1…0b  a friend
--   f1…0c  a stranger
--   f1…0d  a friend the visitor then blocks
--   f1…a1 / a2 / a3  three places; a3 is not published

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f1ec0000-0000-0000-0000-00000000000a', 'cf-a@x.com', '{"handle":"cfa"}'),
 ('f1ec0000-0000-0000-0000-00000000000b', 'cf-b@x.com', '{"handle":"cfb"}'),
 ('f1ec0000-0000-0000-0000-00000000000c', 'cf-c@x.com', '{"handle":"cfc"}'),
 ('f1ec0000-0000-0000-0000-00000000000d', 'cf-d@x.com', '{"handle":"cfd"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f1ec0000-0000-0000-0000-0000000000a1', 'cf-cong',  'hanoi', true,  'approved', 'Cong',  '{cafes}'),
 ('f1ec0000-0000-0000-0000-0000000000a2', 'cf-pho',   'hanoi', true,  'approved', 'Pho',   '{eats}'),
 ('f1ec0000-0000-0000-0000-0000000000a3', 'cf-gone',  'hanoi', false, 'approved', 'Gone',  '{eats}');
insert into public.place_photos (place_id, photo_uri, sort_order, is_cover, is_hidden) values
 ('f1ec0000-0000-0000-0000-0000000000a1', 'https://x/second.jpg', 0, false, false),
 ('f1ec0000-0000-0000-0000-0000000000a1', 'https://x/hidden.jpg', 0, true,  true),
 ('f1ec0000-0000-0000-0000-0000000000a1', 'https://x/cover.jpg',  5, true,  false);
insert into public.friendships (requester, addressee, status) values
 ('f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-00000000000b', 'accepted'),
 ('f1ec0000-0000-0000-0000-00000000000d', 'f1ec0000-0000-0000-0000-00000000000a', 'accepted'),
 ('f1ec0000-0000-0000-0000-00000000000c', 'f1ec0000-0000-0000-0000-00000000000a', 'pending');

-- The visits, written as the table's owner so their instants can be set.
--   k1  Cong, 23 Nov 18:30 UTC — which is the 24th in Hà Nội — friends, noted
--   k2  Cong, a week before, friends      (older, same place)
--   k3  Pho,  22 Nov, private, noted
--   k4  Pho,  20 Nov, friends             (older than the private one)
--   k5  Gone, 21 Nov, friends             (a place nobody can open)
--   k6  Cong by the friend (b), never answered
insert into public.checkins (id, user_id, place_id, city_id, at, note, audience) values
 ('f1ec0000-0000-0000-0000-0000000000c1', 'f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-23 18:30+00', 'Crisp sourdough.', 'friends'),
 ('f1ec0000-0000-0000-0000-0000000000c2', 'f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-16 03:00+00', null, 'friends'),
 ('f1ec0000-0000-0000-0000-0000000000c3', 'f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-0000000000a2', 'hanoi', '2026-11-22 03:00+00', 'Mine alone.', 'private'),
 ('f1ec0000-0000-0000-0000-0000000000c4', 'f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-0000000000a2', null,    '2026-11-20 03:00+00', null, 'friends'),
 ('f1ec0000-0000-0000-0000-0000000000c5', 'f1ec0000-0000-0000-0000-00000000000a', 'f1ec0000-0000-0000-0000-0000000000a3', 'hanoi', '2026-11-21 03:00+00', null, 'friends'),
 ('f1ec0000-0000-0000-0000-0000000000c6', 'f1ec0000-0000-0000-0000-00000000000b', 'f1ec0000-0000-0000-0000-0000000000a1', 'hanoi', '2026-11-19 03:00+00', 'Never asked.', null);

create function public._cf_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._cf_why(text) to rls_client, anon;

-- A person's page as one reader gets it: "slug|day|note|audience|likes*"
-- per row, in the order returned.
create function public._cf_reads(as_user text, person text) returns text
language plpgsql set search_path = public as $$
declare out text;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select coalesce(string_agg(
           r.place_slug || '|' || r.day || '|' || coalesce(r.note, '-') || '|' || coalesce(r.audience, '-')
           || '|' || r.likes || (case when r.liked then '*' else '' end), ' ; '), '')
    into out
    from public.person_checkins(person::uuid) r;
  reset role;
  return out;
exception when others then
  reset role;
  return 'refused: ' || sqlerrm;
end $$;

do $$
declare
  a constant text := 'f1ec0000-0000-0000-0000-00000000000a';
  b constant text := 'f1ec0000-0000-0000-0000-00000000000b';
  c constant text := 'f1ec0000-0000-0000-0000-00000000000c';
  d constant text := 'f1ec0000-0000-0000-0000-00000000000d';
  k1 constant text := 'f1ec0000-0000-0000-0000-0000000000c1';
  got text; why text; n int; cols text;
begin
  -- The owner's own page: the newest at each place, private ones too,
  -- each with its answer; the unpublished place is not a card.
  got := public._cf_reads(a, a);
  assert got = 'cf-cong|2026-11-24|Crisp sourdough.|friends|0 ; cf-pho|2026-11-22|Mine alone.|private|0',
    format('the owner reads the newest at each place, with its answer: %s', got);

  -- A friend: only what was answered 'friends' — so at Pho the older,
  -- shared visit, not the private one above it — the cover that is not
  -- hidden, the day on Hà Nội's clock (and Vietnam's where the city is
  -- not known), and no answer handed over.
  got := public._cf_reads(b, a);
  assert got = 'cf-cong|2026-11-24|Crisp sourdough.|-|0 ; cf-pho|2026-11-20|-|-|0',
    format('a friend reads the shared visits, by day: %s', got);

  -- Nothing in what comes back is an instant.
  select string_agg(a2.attname || ':' || format_type(a2.atttypid, null), ',') into cols
    from pg_proc p, unnest(p.proargnames, p.proallargtypes, p.proargmodes) as a2(attname, atttypid, mode)
   where p.proname = 'person_checkins' and a2.mode = 't'
     and format_type(a2.atttypid, null) like 'timestamp%';
  assert cols is null, format('the read hands back no instant, saw %s', cols);

  set local role rls_client;
  perform set_config('test.uid', b, true);
  select r.cover into got from public.person_checkins(a::uuid) r where r.place_slug = 'cf-cong';
  reset role;
  assert got = 'https://x/cover.jpg', format('the cover is the shown cover, not the hidden one: %s', got);

  -- A stranger (a pending request is not a friendship), and nobody.
  got := public._cf_reads(c, a);
  assert got = '', format('a stranger reads nothing: %s', got);
  got := public._cf_reads('', a);
  assert got like 'refused:%', format('signed out, the read is not theirs to call: %s', got);

  -- A visit never answered is private: the friend's own page has it,
  -- the visitor looking at the friend's page does not.
  got := public._cf_reads(b, b);
  assert got = 'cf-cong|2026-11-19|Never asked.|-|0', format('your own unanswered visit is yours: %s', got);
  got := public._cf_reads(a, b);
  assert got = '', format('an unanswered visit is shown to no friend: %s', got);

  -- The table itself is still the owner's: no policy let a friend in.
  set local role rls_client;
  perform set_config('test.uid', b, true);
  select count(*) into n from public.checkins where user_id = a::uuid;
  reset role;
  assert n = 0, format('a friend reads no row of the table, saw %s', n);

  -- ── hearts ──
  -- A friend hearts a shared visit; twice is once; the count and the
  -- mark come back on the read, to them and to the owner.
  set local role rls_client;
  perform set_config('test.uid', b, true);
  perform public.like_checkin(k1::uuid, true);
  perform public.like_checkin(k1::uuid, true);
  reset role;
  got := public._cf_reads(b, a);
  assert got like 'cf-cong|2026-11-24|Crisp sourdough.|-|1*%', format('the friend sees their heart: %s', got);
  got := public._cf_reads(a, a);
  assert got like 'cf-cong|2026-11-24|Crisp sourdough.|friends|1 ;%', format('the owner sees the count, not marked theirs: %s', got);

  -- The owner may heart their own shared visit.
  set local role rls_client;
  perform set_config('test.uid', a, true);
  perform public.like_checkin(k1::uuid, true);
  reset role;
  got := public._cf_reads(a, a);
  assert got like 'cf-cong|%|friends|2*%', format('the owner hearts their own: %s', got);

  -- Refused, in one voice: a stranger; a private visit, even by a
  -- friend, even by its owner; a visit that does not exist; nobody.
  set local role rls_client;
  perform set_config('test.uid', c, true);
  why := public._cf_why(format('select public.like_checkin(%L, true)', k1));
  reset role;
  assert why = 'checkin:unseen', format('a stranger''s heart is refused: %s', why);
  set local role rls_client;
  perform set_config('test.uid', b, true);
  why := public._cf_why('select public.like_checkin(''f1ec0000-0000-0000-0000-0000000000c3'', true)');
  reset role;
  assert why = 'checkin:unseen', format('a private visit takes no heart from a friend: %s', why);
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._cf_why('select public.like_checkin(''f1ec0000-0000-0000-0000-0000000000c3'', true)');
  reset role;
  assert why = 'checkin:unseen', format('nor from its owner: %s', why);
  set local role rls_client;
  perform set_config('test.uid', b, true);
  why := public._cf_why('select public.like_checkin(''f1ec0000-0000-0000-0000-0000000000ff'', true)');
  reset role;
  assert why = 'checkin:unseen', format('a visit that is not there: %s', why);

  -- The likes table is closed: read, written and emptied by nobody.
  set local role rls_client;
  perform set_config('test.uid', b, true);
  why := public._cf_why('select count(*) from public.checkin_likes');
  reset role;
  assert why like 'permission denied%', format('the likes are not a client''s to read: %s', why);

  -- The export: this account's hearts, as place and instant.
  set local role rls_client;
  perform set_config('test.uid', b, true);
  select string_agg(t.place_slug, ',') into got from public.checkin_hearts_takeout() t;
  reset role;
  assert got = 'cf-cong', format('the friend''s export lists their heart: %s', got);
  set local role rls_client;
  perform set_config('test.uid', c, true);
  select count(*) into n from public.checkin_hearts_takeout();
  reset role;
  assert n = 0, 'somebody who gave no heart exports none';

  -- Taken back.
  set local role rls_client;
  perform set_config('test.uid', b, true);
  perform public.like_checkin(k1::uuid, false);
  reset role;
  got := public._cf_reads(b, a);
  assert got like 'cf-cong|%|-|1 ;%', format('the friend''s heart is gone, the owner''s stays: %s', got);

  -- ── a block ──
  -- d was a friend and read the page; blocked, d reads nothing and can
  -- heart nothing, whichever side the block is on.
  got := public._cf_reads(d, a);
  assert got like 'cf-cong|%', format('d reads the page while a friend: %s', got);
  insert into public.blocks (blocker, blocked) values (a::uuid, d::uuid);
  got := public._cf_reads(d, a);
  assert got = '', format('blocked, d reads nothing though the friendship row stands: %s', got);
  set local role rls_client;
  perform set_config('test.uid', d, true);
  why := public._cf_why(format('select public.like_checkin(%L, true)', k1));
  reset role;
  assert why = 'checkin:unseen', format('and hearts nothing: %s', why);

  -- ── gone with the visit ──
  delete from public.checkins where id = k1::uuid;
  select count(*) into n from public.checkin_likes where checkin_id = k1::uuid;
  assert n = 0, 'a removed visit takes its hearts';
  got := public._cf_reads(b, a);
  assert got like '%cf-cong|2026-11-16|%', format('and the next newest shared visit stands in its place: %s', got);
end $$;

drop function public._cf_reads(text, text);
drop function public._cf_why(text);
