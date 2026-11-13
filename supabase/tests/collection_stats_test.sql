-- A list's statistics (20261113160000): opens counted as a number per
-- list per day and nothing about who; the lists a trip started from;
-- and the eight figures, to the list's owner alone, with the feeds' own
-- exclusions on likes and copies.
--
-- Exercised, not read, like `likes_kept_off_public_test`: `rls_client`
-- with `test.uid` in each reader's seat, and `anon` signed out — the
-- seat a guest's open is counted from.
--
--   e8…0a  the curator: a public list, a private list shared with a
--          friend, a private list shared with nobody, and an empty one
--   e8…0b  the friend the second list is shared with
--   e8…0c  a stranger, with a list of their own
--   e8…0d  a fan, who likes and copies the public list this week
--   e8…0e  a fan the curator has blocked, who does the same
--   e8…0f  an old fan, whose like and copy are a month old

grant usage on schema public to rls_client, anon;
-- What the test's own fixtures need the client to do, as earlier files
-- grant it. Nothing on `collection_views` or `trip_collections`: what
-- the client may do there is the migration's grant, and it is under test.
grant select, insert, update, delete on public.collections, public.collection_likes,
  public.trips to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('e8000000-0000-0000-0000-00000000000a', 'stats-curator@x.com',  '{"handle":"statscurator"}'),
 ('e8000000-0000-0000-0000-00000000000b', 'stats-friend@x.com',   '{"handle":"statsfriend"}'),
 ('e8000000-0000-0000-0000-00000000000c', 'stats-stranger@x.com', '{"handle":"statsstranger"}'),
 ('e8000000-0000-0000-0000-00000000000d', 'stats-fan@x.com',      '{"handle":"statsfan"}'),
 ('e8000000-0000-0000-0000-00000000000e', 'stats-blocked@x.com',  '{"handle":"statsblocked"}'),
 ('e8000000-0000-0000-0000-00000000000f', 'stats-old@x.com',      '{"handle":"statsold"}');

insert into public.collections (id, slug, owner_id) values
 ('e8000000-0000-0000-0000-0000000000c1', 'stats-public',  'e8000000-0000-0000-0000-00000000000a'),
 ('e8000000-0000-0000-0000-0000000000c2', 'stats-shared',  'e8000000-0000-0000-0000-00000000000a'),
 ('e8000000-0000-0000-0000-0000000000c3', 'stats-private', 'e8000000-0000-0000-0000-00000000000a'),
 ('e8000000-0000-0000-0000-0000000000c4', 'stats-empty',   'e8000000-0000-0000-0000-00000000000a'),
 ('e8000000-0000-0000-0000-0000000000c5', 'stats-theirs',  'e8000000-0000-0000-0000-00000000000c');
update public.collections set is_public = true
 where id in ('e8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000c5');

insert into public.friendships (requester, addressee, status) values
 ('e8000000-0000-0000-0000-00000000000a', 'e8000000-0000-0000-0000-00000000000b', 'accepted');
insert into public.collection_shares (collection_id, user_id) values
 ('e8000000-0000-0000-0000-0000000000c2', 'e8000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker, blocked) values
 ('e8000000-0000-0000-0000-00000000000a', 'e8000000-0000-0000-0000-00000000000e');

-- ── the shape: aggregates, and nothing that says who ──
--
-- The columns, all of them. A fourth column on the counter is the first
-- step to knowing who opened a list, and this is where it is noticed.
do $$
declare v text; t text;
begin
  select string_agg(column_name, ',' order by column_name) into v
    from information_schema.columns where table_schema = 'public' and table_name = 'collection_views';
  select string_agg(column_name, ',' order by column_name) into t
    from information_schema.columns where table_schema = 'public' and table_name = 'trip_collections';
  assert v = 'collection_id,day,views', format('collection_views has columns %s', v);
  assert t = 'collection_id,trip_id', format('trip_collections has columns %s', t);
end $$;

-- ── no client reaches the counter except through the function ──
do $$
declare reads int := 0; writes int := 0; r text;
begin
  foreach r in array array['rls_client', 'anon'] loop
    execute format('set local role %I', r);
    perform set_config('test.uid', 'e8000000-0000-0000-0000-00000000000a', true);
    begin
      perform 1 from public.collection_views;
    exception when insufficient_privilege then reads := reads + 1;
    end;
    begin
      insert into public.collection_views (collection_id, day, views)
      values ('e8000000-0000-0000-0000-0000000000c1', current_date, 1000);
    exception when insufficient_privilege then writes := writes + 1;
    end;
    reset role;
  end loop;
  assert reads = 2, format('%s of 2 seats were refused a read of the counter', reads);
  assert writes = 2, format('%s of 2 seats were refused a write to the counter', writes);
end $$;

-- ── who is counted ──
--
-- Every seat opens every list. What lands is exactly the opens of lists
-- that seat can read: a guest and a stranger the public list alone, the
-- friend the public and the shared, the owner all of theirs — twice for
-- the guest, since a second open the same day is a second view.
do $$
declare seat text; uid text; cid text;
begin
  foreach seat in array array['anon:', 'anon:', 'rls_client:e8000000-0000-0000-0000-00000000000a',
                              'rls_client:e8000000-0000-0000-0000-00000000000b',
                              'rls_client:e8000000-0000-0000-0000-00000000000c'] loop
    execute format('set local role %I', split_part(seat, ':', 1));
    uid := split_part(seat, ':', 2);
    perform set_config('test.uid', uid, true);
    foreach cid in array array['e8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000c2',
                               'e8000000-0000-0000-0000-0000000000c3',
                               -- An id nothing has: the same silence as a list you cannot read.
                               'e8000000-0000-0000-0000-0000000000ff'] loop
      perform public.record_collection_view(cid::uuid);
    end loop;
    reset role;
  end loop;
end $$;

do $$
declare got text;
begin
  select string_agg(format('%s=%s', c.slug, v.views), ',' order by c.slug) into got
    from public.collection_views v join public.collections c on c.id = v.collection_id
   where c.slug like 'stats-%';
  -- public: two guest opens, the owner, the friend, the stranger. shared:
  -- the owner and the friend. private: the owner alone.
  assert got = 'stats-private=1,stats-public=5,stats-shared=2', format('the counter holds %s', got);
end $$;

-- A private list stays unprobeable when it was public once: a guest's
-- open counts while it is public and not after.
update public.collections set is_public = false where id = 'e8000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  set local role anon;
  perform public.record_collection_view('e8000000-0000-0000-0000-0000000000c1');
  reset role;
  select views into n from public.collection_views where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  assert n = 5, format('a guest counted an open of a list gone private: %s', n);
end $$;
update public.collections set is_public = true where id = 'e8000000-0000-0000-0000-0000000000c1';

-- ── the day is Vietnam's, whatever the session's clock says ──
--
-- Two opens, one from a session on UTC+14 and one on UTC−11: twenty-five
-- hours apart, so a day read off the session's own calendar (`current_date`,
-- `now()::date`) files them under two different dates, always. The
-- function's lands both in one row, on Vietnam's date. A day read off
-- UTC's calendar would also land them together; it differs from
-- Vietnam's only between 17:00 and 24:00 UTC, so the date check below
-- catches it during those hours and the definition check after it at
-- every hour.
do $$
declare rows_ int; d date;
begin
  -- The empty list, public for the length of this block.
  update public.collections set is_public = true where id = 'e8000000-0000-0000-0000-0000000000c4';
  set local role anon;
  set local timezone = 'Pacific/Kiritimati';
  perform public.record_collection_view('e8000000-0000-0000-0000-0000000000c4');
  set local timezone = 'Pacific/Pago_Pago';
  perform public.record_collection_view('e8000000-0000-0000-0000-0000000000c4');
  reset role;
  reset timezone;
  update public.collections set is_public = false where id = 'e8000000-0000-0000-0000-0000000000c4';
  select count(*), max(day) into rows_, d from public.collection_views
   where collection_id = 'e8000000-0000-0000-0000-0000000000c4';
  assert rows_ = 1, format('two opens a session clock apart landed in %s rows', rows_);
  assert d = (now() at time zone 'Asia/Ho_Chi_Minh')::date, format('filed under %s, not Vietnam''s today', d);
  assert pg_get_functiondef('public.record_collection_view(uuid)'::regprocedure) ~ 'Asia/Ho_Chi_Minh',
    'record_collection_view no longer names Vietnam''s zone';
  assert pg_get_functiondef('public.collection_stats(uuid)'::regprocedure) ~ 'Asia/Ho_Chi_Minh',
    'collection_stats no longer names Vietnam''s zone';
  delete from public.collection_views where collection_id = 'e8000000-0000-0000-0000-0000000000c4';
end $$;

-- ── trips: who may name a list as a trip's start ──
insert into public.trips (id, owner_id, city_id, title, day, when_part, created_at) values
 ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-00000000000a', 'hanoi', 'curator''s own', current_date, 'day', now()),
 ('e8000000-0000-0000-0000-0000000000a2', 'e8000000-0000-0000-0000-00000000000c', 'hanoi', 'stranger''s',    current_date, 'day', now()),
 ('e8000000-0000-0000-0000-0000000000a3', 'e8000000-0000-0000-0000-00000000000e', 'hanoi', 'blocked fan''s', current_date, 'day', now()),
 ('e8000000-0000-0000-0000-0000000000a4', 'e8000000-0000-0000-0000-00000000000d', 'hanoi', 'last month''s',  current_date, 'day', now() - interval '30 days'),
 ('e8000000-0000-0000-0000-0000000000a5', 'e8000000-0000-0000-0000-00000000000b', 'hanoi', 'friend''s',      current_date, 'day', now());

-- The friend is on the curator's own trip too: an invitee reads the trip
-- (`on_trip`), so "the trip's owner" in the policies is a rule of its own
-- and not something the trips policy already says.
insert into public.trip_invites (trip_id, invitee_id, inviter_id, status) values
 ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-00000000000b',
  'e8000000-0000-0000-0000-00000000000a', 'accepted');

-- Each source written through the policy, in its trip owner's seat, as
-- `saveTrip` writes it.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  insert into public.trip_collections (trip_id, collection_id) values
   ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000c1'),
   ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000c3');
  set local test.uid = 'e8000000-0000-0000-0000-00000000000c';
  insert into public.trip_collections (trip_id, collection_id) values
   ('e8000000-0000-0000-0000-0000000000a2', 'e8000000-0000-0000-0000-0000000000c1');
  set local test.uid = 'e8000000-0000-0000-0000-00000000000e';
  insert into public.trip_collections (trip_id, collection_id) values
   ('e8000000-0000-0000-0000-0000000000a3', 'e8000000-0000-0000-0000-0000000000c1');
  set local test.uid = 'e8000000-0000-0000-0000-00000000000d';
  insert into public.trip_collections (trip_id, collection_id) values
   ('e8000000-0000-0000-0000-0000000000a4', 'e8000000-0000-0000-0000-0000000000c1');
  -- The friend, from the list lent to them: a list they can read.
  set local test.uid = 'e8000000-0000-0000-0000-00000000000b';
  insert into public.trip_collections (trip_id, collection_id) values
   ('e8000000-0000-0000-0000-0000000000a5', 'e8000000-0000-0000-0000-0000000000c2');

  -- Refused: a stranger naming a private list they cannot read, as the
  -- start of their own trip.
  set local test.uid = 'e8000000-0000-0000-0000-00000000000c';
  begin
    insert into public.trip_collections (trip_id, collection_id) values
     ('e8000000-0000-0000-0000-0000000000a2', 'e8000000-0000-0000-0000-0000000000c3');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- Refused: a stranger writing a source onto somebody else's trip.
  begin
    insert into public.trip_collections (trip_id, collection_id) values
     ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000c5');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- Refused, and by the policy rather than the foreign key: an id that
  -- names no list says the same as a list you cannot read.
  begin
    insert into public.trip_collections (trip_id, collection_id) values
     ('e8000000-0000-0000-0000-0000000000a2', 'e8000000-0000-0000-0000-0000000000ff');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- Refused: an invitee writing a source onto the trip they are on, for
  -- a list they can read. The trip is not theirs to say how it was made.
  set local test.uid = 'e8000000-0000-0000-0000-00000000000b';
  begin
    insert into public.trip_collections (trip_id, collection_id) values
     ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000c2');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  -- Refused: a source is how a trip was made, not an edit.
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  begin
    delete from public.trip_collections where trip_id = 'e8000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    update public.trip_collections set collection_id = 'e8000000-0000-0000-0000-0000000000c4'
     where trip_id = 'e8000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 6, format('%s of 6 source writes were refused', refused);
end $$;

-- Read back: the trip's owner sees their own trip's sources and nobody
-- else's — the curator does not see the stranger's trip on their list,
-- and the friend on the curator's trip reads the trip but not its sources.
do $$
declare mine text; friend_sees text; friend_trip int; guest_refused boolean := false;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select string_agg(trip_id::text || '>' || collection_id::text, ',' order by collection_id) into mine
    from public.trip_collections;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000b';
  select string_agg(trip_id::text || '>' || collection_id::text, ',' order by collection_id) into friend_sees
    from public.trip_collections;
  select count(*) into friend_trip from public.trips where id = 'e8000000-0000-0000-0000-0000000000a1';
  reset role;
  set local role anon;
  begin
    perform 1 from public.trip_collections;
  exception when insufficient_privilege then guest_refused := true;
  end;
  reset role;
  assert mine = 'e8000000-0000-0000-0000-0000000000a1>e8000000-0000-0000-0000-0000000000c1,'
             || 'e8000000-0000-0000-0000-0000000000a1>e8000000-0000-0000-0000-0000000000c3',
    format('the curator reads these sources: %s', mine);
  assert friend_trip = 1, 'the invitee cannot read the trip, so the next check proves nothing';
  assert friend_sees = 'e8000000-0000-0000-0000-0000000000a5>e8000000-0000-0000-0000-0000000000c2',
    format('the friend reads these sources: %s', friend_sees);
  assert guest_refused, 'a guest can read trip sources';
end $$;

-- ── likes and copies, as the feeds count them ──
--
-- The fan and the blocked fan this week, the old fan a month ago, and the
-- curator on their own list. The likes through the policy; the copies by
-- the runner, as the feeds' own tests make them.
do $$
declare uid text;
begin
  foreach uid in array array['e8000000-0000-0000-0000-00000000000d', 'e8000000-0000-0000-0000-00000000000e',
                             'e8000000-0000-0000-0000-00000000000f', 'e8000000-0000-0000-0000-00000000000a'] loop
    set local role rls_client;
    perform set_config('test.uid', uid, true);
    insert into public.collection_likes (collection_id, user_id)
    values ('e8000000-0000-0000-0000-0000000000c1', uid::uuid);
    reset role;
  end loop;
end $$;
update public.collection_likes set created_at = now() - interval '30 days'
 where user_id = 'e8000000-0000-0000-0000-00000000000f';

insert into public.collections (slug, owner_id, copied_from, created_at) values
 ('stats-copy-fan',     'e8000000-0000-0000-0000-00000000000d', 'e8000000-0000-0000-0000-0000000000c1', now()),
 ('stats-copy-blocked', 'e8000000-0000-0000-0000-00000000000e', 'e8000000-0000-0000-0000-0000000000c1', now()),
 ('stats-copy-old',     'e8000000-0000-0000-0000-00000000000f', 'e8000000-0000-0000-0000-0000000000c1', now() - interval '30 days'),
 ('stats-copy-own',     'e8000000-0000-0000-0000-00000000000a', 'e8000000-0000-0000-0000-0000000000c1', now());

-- Views from earlier days, by the runner: the last of the seven calendar
-- days (six days ago, Vietnam's calendar) is in; the day before it is not.
insert into public.collection_views (collection_id, day, views) values
 ('e8000000-0000-0000-0000-0000000000c1', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 6, 10),
 ('e8000000-0000-0000-0000-0000000000c1', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7, 100),
 ('e8000000-0000-0000-0000-0000000000c1', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 40, 1000);

-- ── the figures, to the owner ──
do $$
declare s record; n int;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select count(*) into n from public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  select * into s from public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  reset role;
  assert n = 1, format('the owner got %s rows, not one', n);
  -- Views: today's 5, six days ago 10, seven days ago 100, forty 1000.
  assert s.views_total = 1115, format('views_total %s', s.views_total);
  assert s.views_7d = 15, format('views_7d %s', s.views_7d);
  -- Likes: the fan (this week) and the old fan; not the blocked fan, not
  -- the curator's own.
  assert s.likes_total = 2, format('likes_total %s', s.likes_total);
  assert s.likes_7d = 1, format('likes_7d %s', s.likes_7d);
  -- Copies: the same two, for the same reasons.
  assert s.copies_total = 2, format('copies_total %s', s.copies_total);
  assert s.copies_7d = 1, format('copies_7d %s', s.copies_7d);
  -- Trips: the curator's own, the stranger's, the blocked fan's, and last
  -- month's. Everyone, the owner included; last month's not this week.
  assert s.trips_total = 4, format('trips_total %s', s.trips_total);
  assert s.trips_7d = 3, format('trips_7d %s', s.trips_7d);
end $$;

-- The statistics page and the Activity page cannot disagree: the figure
-- is the number of rows the feed lists for that list, all time and this
-- week, read in the same seat.
do $$
declare s record; fl int; fl7 int; fc int; fc7 int;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select * into s from public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  select count(*) into fl from public.likes_on_mine('epoch') where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  select count(*) into fl7 from public.likes_on_mine(now() - interval '7 days') where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  select count(*) into fc from public.copies_of_mine('epoch') where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  select count(*) into fc7 from public.copies_of_mine(now() - interval '7 days') where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  reset role;
  assert (s.likes_total, s.likes_7d, s.copies_total, s.copies_7d) = (fl, fl7, fc, fc7),
    format('stats say %s/%s likes and %s/%s copies; the feeds list %s/%s and %s/%s',
           s.likes_total, s.likes_7d, s.copies_total, s.copies_7d, fl, fl7, fc, fc7);
end $$;

-- A list of yours with nothing on it: one row, all zeros — an answer,
-- not an absence.
do $$
declare s record; n int;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select count(*) into n from public.collection_stats('e8000000-0000-0000-0000-0000000000c4');
  select * into s from public.collection_stats('e8000000-0000-0000-0000-0000000000c4');
  reset role;
  assert n = 1, format('the owner of an empty list got %s rows', n);
  assert (s.views_total, s.views_7d, s.likes_total, s.likes_7d, s.copies_total, s.copies_7d, s.trips_total, s.trips_7d)
       = (0, 0, 0, 0, 0, 0, 0, 0), format('an empty list reads %s', s);
end $$;

-- ── nobody else hears a figure ──
--
-- The friend the list is shared with, the stranger, and the curator about
-- somebody else's list: no row. A guest is refused the call outright.
do $$
declare friend_n int; stranger_n int; theirs_n int; none_n int; guest_refused boolean := false;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000b';
  select count(*) into friend_n from public.collection_stats('e8000000-0000-0000-0000-0000000000c2');
  set local test.uid = 'e8000000-0000-0000-0000-00000000000c';
  select count(*) into stranger_n from public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select count(*) into theirs_n from public.collection_stats('e8000000-0000-0000-0000-0000000000c5');
  select count(*) into none_n from public.collection_stats('e8000000-0000-0000-0000-0000000000ff');
  reset role;
  set local role anon;
  begin
    perform public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  exception when insufficient_privilege then guest_refused := true;
  end;
  reset role;
  assert friend_n = 0, 'the friend a list is lent to reads its statistics';
  assert stranger_n = 0, 'a stranger reads a public list''s statistics';
  assert theirs_n = 0, 'a curator reads statistics for somebody else''s list';
  assert none_n = 0, 'an id that names nothing answers a row';
  assert guest_refused, 'a guest may call collection_stats';
end $$;

-- ── what a delete takes ──
--
-- A trip deleted takes its sources, and the list counts one fewer. A list
-- deleted takes its counter and its sources, and the trips stand.
delete from public.trips where id = 'e8000000-0000-0000-0000-0000000000a2';
do $$
declare s record;
begin
  set local role rls_client;
  set local test.uid = 'e8000000-0000-0000-0000-00000000000a';
  select * into s from public.collection_stats('e8000000-0000-0000-0000-0000000000c1');
  reset role;
  assert s.trips_total = 3, format('a deleted trip still counts: %s', s.trips_total);
end $$;

delete from public.collections where id = 'e8000000-0000-0000-0000-0000000000c1';
do $$
declare v int; tc int; tr int;
begin
  select count(*) into v from public.collection_views where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  select count(*) into tc from public.trip_collections where collection_id = 'e8000000-0000-0000-0000-0000000000c1';
  select count(*) into tr from public.trips
   where id in ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000a3',
                'e8000000-0000-0000-0000-0000000000a4');
  assert v = 0, format('a deleted list left %s counter rows', v);
  assert tc = 0, format('a deleted list left %s trip sources', tc);
  assert tr = 3, format('a deleted list took trips with it: %s of 3 stand', tr);
end $$;

-- An open of a list that is gone is the same silence as any id.
do $$
begin
  set local role anon;
  perform public.record_collection_view('e8000000-0000-0000-0000-0000000000c1');
  reset role;
  assert not exists (select 1 from public.collection_views where collection_id = 'e8000000-0000-0000-0000-0000000000c1'),
    'an open of a deleted list was counted';
end $$;

-- ── grants, rights and paths ──
do $$
declare f regprocedure; acl text;
begin
  assert has_function_privilege('anon', 'public.record_collection_view(uuid)', 'execute'), 'a guest''s open cannot be counted';
  assert has_function_privilege('authenticated', 'public.record_collection_view(uuid)', 'execute'), 'a reader''s open cannot be counted';
  assert not has_function_privilege('anon', 'public.collection_stats(uuid)', 'execute'), 'collection_stats is open to anon';
  assert has_function_privilege('authenticated', 'public.collection_stats(uuid)', 'execute'), 'collection_stats is closed to readers';
  foreach f in array array['public.record_collection_view(uuid)', 'public.collection_stats(uuid)']::regprocedure[] loop
    -- Not to `public` either: an `=X` entry is every role there is.
    select proacl::text into acl from pg_proc where oid = f;
    assert acl !~ '(^|[{,])=X', format('%s is granted to public: %s', f, acl);
    assert (select prosecdef from pg_proc where oid = f), format('%s is not security definer', f);
    assert (select proconfig from pg_proc where oid = f) @> array['search_path=public'],
      format('%s does not pin its search_path', f);
  end loop;
  assert not has_table_privilege('authenticated', 'public.collection_views', 'select'), 'readers may select the counter';
  assert not has_table_privilege('anon', 'public.collection_views', 'select'), 'guests may select the counter';
  assert has_table_privilege('authenticated', 'public.trip_collections', 'insert'), 'readers cannot name a trip''s source';
  assert not has_table_privilege('authenticated', 'public.trip_collections', 'delete'), 'readers may delete a trip''s source';
  assert not has_table_privilege('authenticated', 'public.trip_collections', 'update'), 'readers may change a trip''s source';
  assert not has_table_privilege('anon', 'public.trip_collections', 'insert'), 'guests may name a trip''s source';
end $$;

-- The policies ask who you are once per query, as `rls_ask_once_test`
-- holds every policy before this block, and read the two tables they
-- guard against, not their own.
do $$
declare bare text; n int;
begin
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'trip_collections';
  assert n = 2, format('trip_collections has %s policies, not 2', n);
  select string_agg(policyname, ', ') into bare from pg_policies
   where schemaname = 'public' and tablename = 'trip_collections'
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ '(?<!SELECT )(?<![.\w])auth\.uid\(\)';
  assert bare is null, format('trip_collections policies evaluate per row: %s', bare);
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_views'),
    'collection_views has a policy; it should have none';
end $$;

-- Leave nothing behind.
delete from public.trips where id::text like 'e8000000-%';
delete from public.collections where slug like 'stats-%';
delete from public.blocks where blocker = 'e8000000-0000-0000-0000-00000000000a';
delete from public.friendships where requester = 'e8000000-0000-0000-0000-00000000000a';

select 'all collection-stats checks passed';
