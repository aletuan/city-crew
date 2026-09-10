-- Likes, the desk's moderation actions, launch traces and the place-photo
-- bucket — four surfaces whose policies were only ever read off
-- pg_policy, or not checked at all. Each is exercised here as a client
-- that owns nothing: `rls_client` in the reader's seat, then the desk's.

grant usage on schema public, storage to rls_client;
grant select, insert, delete on public.collection_likes to rls_client;
grant select, insert on public.startup_traces to rls_client;
grant select, insert, update, delete on storage.objects to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d3000000-0000-0000-0000-00000000000a', 'curator3@x.com', '{"handle":"curator3","full_name":"Curator","bio":"Hello"}'),
 ('d3000000-0000-0000-0000-00000000000b', 'fan3@x.com',     '{"handle":"fan3"}');
insert into public.places (id, slug, is_published, review_status)
values ('d3000000-0000-0000-0000-0000000000f1', 'likes-place', true, 'approved');
insert into public.collections (id, slug, owner_id) values
 ('d3000000-0000-0000-0000-0000000000c1', 'likes-public',  'd3000000-0000-0000-0000-00000000000a'),
 ('d3000000-0000-0000-0000-0000000000c2', 'likes-private', 'd3000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'd3000000-0000-0000-0000-0000000000c1';

-- ════════════════════════════════════════════════════ collection likes

-- A fan likes a public list, in their own name. Not a private one, not in
-- somebody else's name, and a curator cannot applaud their own list.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  insert into public.collection_likes (collection_id, user_id)
  values ('d3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-00000000000b');
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('d3000000-0000-0000-0000-0000000000c2', 'd3000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('d3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000a';
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('d3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = '';
  begin
    insert into public.collection_likes (collection_id, user_id)
    values ('d3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege or unique_violation then refused := refused + 1;
  end;
  reset role;

  assert refused = 4, format('%s of 4 improper likes were refused', refused);
end $$;

-- A like is private to the person who gave it; the curator hears about it
-- through `likes_on_mine` and the public through a count, never the rows.
do $$
declare by_fan int; by_curator int; applause int; counted int;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  select count(*) into by_fan from public.collection_likes;
  reset role;
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000a';
  select count(*) into by_curator from public.collection_likes;
  select count(*) into applause from public.likes_on_mine(now() - interval '1 hour');
  reset role;
  set local role rls_client;
  set local test.uid = '';
  select likes into counted from public.collection_like_counts() where collection_id = 'd3000000-0000-0000-0000-0000000000c1';
  reset role;
  assert by_fan = 1, format('the fan sees %s of their 1 like', by_fan);
  assert by_curator = 0, 'the curator can read who liked their list row by row';
  assert applause = 1, format('the curator hears of %s likes, not 1', applause);
  assert counted = 1, format('the public count reads %s, not 1', counted);
end $$;

-- Taken private, the list stops being counted in public — the count
-- must not keep advertising a list nobody can open.
update public.collections set is_public = false where id = 'd3000000-0000-0000-0000-0000000000c1';
do $$
declare counted int; applause int;
begin
  set local role rls_client;
  set local test.uid = '';
  select count(*) into counted from public.collection_like_counts() where collection_id = 'd3000000-0000-0000-0000-0000000000c1';
  reset role;
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000a';
  select count(*) into applause from public.likes_on_mine(now() - interval '1 hour');
  reset role;
  assert counted = 0, 'a private list still has a public like count';
  assert applause = 0, 'a private list still collects applause';
end $$;
update public.collections set is_public = true where id = 'd3000000-0000-0000-0000-0000000000c1';

-- Only the fan can take their like back.
do $$
declare by_curator int; by_fan int;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000a';
  with d as (delete from public.collection_likes returning 1) select count(*) into by_curator from d;
  reset role;
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  with d as (delete from public.collection_likes returning 1) select count(*) into by_fan from d;
  reset role;
  assert by_curator = 0, 'the curator removed somebody else''s like';
  assert by_fan = 1, 'the fan could not take their like back';
end $$;

-- ════════════════════════════════════════════════════ moderation actions

-- The desk hides a reported list and clears a profile's fields. Definer
-- functions, so the editor check inside them is the whole gate.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  set local test.jwt = '{"email": "fan3@x.com"}';
  begin
    perform public.moderate_collection('d3000000-0000-0000-0000-0000000000c1', true);
  exception when raise_exception then refused := refused + 1;
  end;
  begin
    perform public.moderate_profile('d3000000-0000-0000-0000-00000000000a', clear_bio => true);
  exception when raise_exception then refused := refused + 1;
  end;
  reset role;
  assert refused = 2, format('%s of 2 moderation actions by a reader were refused', refused);
end $$;

do $$
declare pub bool; bio text; name text;
begin
  select is_public into pub from public.collections where id = 'd3000000-0000-0000-0000-0000000000c1';
  select p.bio, p.full_name into bio, name from public.profiles p where id = 'd3000000-0000-0000-0000-00000000000a';
  assert pub, 'a reader''s failed moderation still hid the list';
  assert bio = 'Hello' and name = 'Curator', 'a reader''s failed moderation still touched the profile';
end $$;

do $$
declare pub bool; bio text; name text;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  perform public.moderate_collection('d3000000-0000-0000-0000-0000000000c1', true);
  -- Only the bio: the name and the avatar are left as they were.
  perform public.moderate_profile('d3000000-0000-0000-0000-00000000000a', clear_bio => true);
  reset role;
  select is_public into pub from public.collections where id = 'd3000000-0000-0000-0000-0000000000c1';
  select p.bio, p.full_name into bio, name from public.profiles p where id = 'd3000000-0000-0000-0000-00000000000a';
  assert not pub, 'the desk could not hide a list';
  assert bio = '', 'the desk could not clear a bio';
  assert name = 'Curator', 'clearing the bio also cleared the name';
end $$;

-- ════════════════════════════════════════════════════ launch traces

-- Any launch may report itself, signed in or not; only the desk reads
-- them back; and the row is bounded — a trace is a few marks, not a
-- channel for arbitrary data.
do $$
declare refused int := 0; mine int; desk int;
begin
  set local role rls_client;
  set local test.uid = '';
  insert into public.startup_traces (platform, total_ms, marks) values ('ios', 812, '[]');
  begin
    insert into public.startup_traces (platform, total_ms, marks) values ('web', 812, '[]');
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.startup_traces (platform, total_ms, marks) values ('ios', 700000, '[]');
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.startup_traces (platform, total_ms, marks) values ('ios', 812, '{"not":"an array"}');
  exception when check_violation then refused := refused + 1;
  end;
  begin
    insert into public.startup_traces (platform, total_ms, marks)
    values ('ios', 812, (select jsonb_agg(md5(i::text)) from generate_series(1, 400) i));
  exception when check_violation then refused := refused + 1;
  end;
  select count(*) into mine from public.startup_traces;
  reset role;

  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  select count(*) into desk from public.startup_traces;
  reset role;

  assert refused = 4, format('%s of 4 malformed traces were refused', refused);
  assert mine = 0, 'a launch can read traces back';
  assert desk >= 1, 'the desk cannot read the traces';
end $$;

-- ════════════════════════════════════════════════════ place-photo bucket

-- Editors write into `place-photos`; a signed-in reader cannot, not even
-- into a folder named after themselves.
insert into storage.buckets (id, name, public) values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

do $$
declare refused bool := false; moved int; gone int;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  set local test.jwt = '{"email": "fan3@x.com"}';
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('place-photos', 'd3000000-0000-0000-0000-00000000000b/1.jpg', 'd3000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a reader uploaded into the place-photos bucket';
end $$;

do $$
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  insert into storage.objects (bucket_id, name) values ('place-photos', 'likes-place/1.jpg');
  reset role;
end $$;

do $$
declare by_reader_u int; by_reader_d int; by_reader_listed int; by_desk_u int; by_desk_d int;
begin
  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000b';
  set local test.jwt = '{"email": "fan3@x.com"}';
  with u as (update storage.objects set metadata = '{"x":1}' where bucket_id = 'place-photos' returning 1)
  select count(*) into by_reader_u from u;
  with d as (delete from storage.objects where bucket_id = 'place-photos' returning 1)
  select count(*) into by_reader_d from d;
  select count(*) into by_reader_listed from storage.objects where bucket_id = 'place-photos';
  reset role;

  set local role rls_client;
  set local test.uid = 'd3000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  with u as (update storage.objects set metadata = '{"x":1}' where name = 'likes-place/1.jpg' returning 1)
  select count(*) into by_desk_u from u;
  with d as (delete from storage.objects where name = 'likes-place/1.jpg' returning 1)
  select count(*) into by_desk_d from d;
  reset role;

  assert by_reader_u = 0 and by_reader_d = 0, 'a reader changed or removed a place photo';
  assert by_reader_listed = 0, 'a reader can list the place-photos bucket';
  assert by_desk_u = 1 and by_desk_d = 1, 'the desk could not replace or remove a place photo';
end $$;

-- Leave nothing behind.
delete from public.startup_traces;
delete from public.collections where id in ('d3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-0000000000c2');
delete from public.places where id = 'd3000000-0000-0000-0000-0000000000f1';
delete from auth.users where id in ('d3000000-0000-0000-0000-00000000000a', 'd3000000-0000-0000-0000-00000000000b');

select 'all like, moderation, trace and photo checks passed' as result;
