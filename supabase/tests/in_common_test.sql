-- What two people have in common (`20261116120000_in_common`).
--
-- The cast: Ana and Ben, who share two places and a liked list; Cy, who
-- shares nothing public with Ana; Dee, whom Ana has blocked; Eve, who has
-- blocked Ana; and an owner of a list who has blocked Ben.

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f8000000-0000-0000-0000-00000000000a', 'ic-ana@x.com', '{"handle":"icana"}'),
 ('f8000000-0000-0000-0000-00000000000b', 'ic-ben@x.com', '{"handle":"icben"}'),
 ('f8000000-0000-0000-0000-00000000000c', 'ic-cy@x.com',  '{"handle":"iccy"}'),
 ('f8000000-0000-0000-0000-00000000000d', 'ic-dee@x.com', '{"handle":"icdee"}'),
 ('f8000000-0000-0000-0000-00000000000e', 'ic-eve@x.com', '{"handle":"iceve"}'),
 ('f8000000-0000-0000-0000-00000000000f', 'ic-own@x.com', '{"handle":"icown"}');

-- Places: two live ones both keep in public; one only Ana keeps; one both
-- keep but that is not live; one both keep, Ben's only in a private list.
insert into public.places (id, slug, name_vi, name_en, is_published, review_status) values
 ('f8000000-0000-0000-0000-0000000000f1', 'ic-banh',    'Bánh',    'Banh',    true,  'approved'),
 ('f8000000-0000-0000-0000-0000000000f2', 'ic-an',      'An',      'An',      true,  'approved'),
 ('f8000000-0000-0000-0000-0000000000f3', 'ic-ana-only','Của Ana', 'Ana only',true,  'approved'),
 ('f8000000-0000-0000-0000-0000000000f4', 'ic-unlive',  'Chưa mở', 'Unlive',  false, 'approved'),
 ('f8000000-0000-0000-0000-0000000000f5', 'ic-private', 'Riêng',   'Private', true,  'approved');

-- Bánh has a hidden photograph, a plain one and a cover; An has one
-- photograph, and it is hidden.
insert into public.place_photos (place_id, photo_uri, sort_order, is_cover, is_hidden, source) values
 ('f8000000-0000-0000-0000-0000000000f2', 'https://p/an-hidden.jpg', 0, true, true, 'google'),
 ('f8000000-0000-0000-0000-0000000000f1', 'https://p/hidden.jpg', 0, false, true,  'google'),
 ('f8000000-0000-0000-0000-0000000000f1', 'https://p/plain.jpg',  1, false, false, 'google'),
 ('f8000000-0000-0000-0000-0000000000f1', 'https://p/cover.jpg',  2, true,  false, 'google');

insert into public.collections (id, slug, owner_id) values
 ('f8000000-0000-0000-0000-0000000000c1', 'ic-ana-public',  'f8000000-0000-0000-0000-00000000000a'),
 ('f8000000-0000-0000-0000-0000000000c2', 'ic-ben-public',  'f8000000-0000-0000-0000-00000000000b'),
 ('f8000000-0000-0000-0000-0000000000c3', 'ic-ben-private', 'f8000000-0000-0000-0000-00000000000b'),
 ('f8000000-0000-0000-0000-0000000000c4', 'ic-dee-public',  'f8000000-0000-0000-0000-00000000000d'),
 ('f8000000-0000-0000-0000-0000000000c5', 'ic-eve-public',  'f8000000-0000-0000-0000-00000000000e'),
 ('f8000000-0000-0000-0000-0000000000c6', 'ic-own-public',  'f8000000-0000-0000-0000-00000000000f'),
 ('f8000000-0000-0000-0000-0000000000c7', 'ic-own-private', 'f8000000-0000-0000-0000-00000000000f'),
 ('f8000000-0000-0000-0000-0000000000c8', 'ic-own-barred',  'f8000000-0000-0000-0000-00000000000f');
update public.collections set is_public = true
 where id in ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000c2',
              'f8000000-0000-0000-0000-0000000000c4', 'f8000000-0000-0000-0000-0000000000c5',
              'f8000000-0000-0000-0000-0000000000c6', 'f8000000-0000-0000-0000-0000000000c8');

insert into public.collection_places (collection_id, place_id) values
 -- Ana's public list: all five.
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000f1'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000f2'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000f3'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000f4'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-0000000000f5'),
 -- Ben's public list: the two shared, and the one that is not live.
 ('f8000000-0000-0000-0000-0000000000c2', 'f8000000-0000-0000-0000-0000000000f1'),
 ('f8000000-0000-0000-0000-0000000000c2', 'f8000000-0000-0000-0000-0000000000f2'),
 ('f8000000-0000-0000-0000-0000000000c2', 'f8000000-0000-0000-0000-0000000000f4'),
 -- Ben's private list: the one he keeps to himself.
 ('f8000000-0000-0000-0000-0000000000c3', 'f8000000-0000-0000-0000-0000000000f5'),
 -- Dee and Eve each keep Bánh in public too.
 ('f8000000-0000-0000-0000-0000000000c4', 'f8000000-0000-0000-0000-0000000000f1'),
 ('f8000000-0000-0000-0000-0000000000c5', 'f8000000-0000-0000-0000-0000000000f1');

-- Likes. Ana and Ben both like the owner's public list (Ben first), its
-- private one, and the barred one; Ana alone likes Ben's own; Dee and Eve
-- like the owner's public list too.
insert into public.collection_likes (collection_id, user_id, created_at) values
 ('f8000000-0000-0000-0000-0000000000c6', 'f8000000-0000-0000-0000-00000000000b', '2026-11-01 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c6', 'f8000000-0000-0000-0000-00000000000a', '2026-11-02 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c7', 'f8000000-0000-0000-0000-00000000000a', '2026-11-03 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c7', 'f8000000-0000-0000-0000-00000000000b', '2026-11-03 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c8', 'f8000000-0000-0000-0000-00000000000a', '2026-11-04 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c8', 'f8000000-0000-0000-0000-00000000000b', '2026-11-04 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c2', 'f8000000-0000-0000-0000-00000000000a', '2026-11-05 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-00000000000a', '2026-11-06 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c1', 'f8000000-0000-0000-0000-00000000000b', '2026-11-07 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c6', 'f8000000-0000-0000-0000-00000000000d', '2026-11-08 10:00+07'),
 ('f8000000-0000-0000-0000-0000000000c6', 'f8000000-0000-0000-0000-00000000000e', '2026-11-08 10:00+07');

insert into public.blocks (blocker, blocked) values
 ('f8000000-0000-0000-0000-00000000000a', 'f8000000-0000-0000-0000-00000000000d'),  -- Ana blocked Dee
 ('f8000000-0000-0000-0000-00000000000e', 'f8000000-0000-0000-0000-00000000000a');  -- Eve blocked Ana

-- ── Ana, about Ben ──
do $$
declare places text; photos text; lists text;
begin
  set local role rls_client;
  set local test.uid = 'f8000000-0000-0000-0000-00000000000a';
  select string_agg(slug, ',' order by ord), string_agg(coalesce(photo_uri, '-'), ',' order by ord)
    into places, photos
    from (select *, row_number() over () as ord from public.places_in_common('f8000000-0000-0000-0000-00000000000b')) t;
  select string_agg(slug, ',' order by ord) into lists
    from (select *, row_number() over () as ord from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000b')) t;
  reset role;
  -- The two both keep in public, by name; not Ana's alone, not the one
  -- that is not live, not the one Ben keeps private.
  assert places = 'ic-an,ic-banh', format('Ana and Ben share these places: %s', places);
  -- The cover, not the hidden one nor the plain one before it; none for a
  -- place whose only photograph is hidden.
  assert photos = '-,https://p/cover.jpg', format('with these photographs: %s', photos);
  -- The most lately liked by either first: Ana's own (Ben, 7 Nov), the
  -- owner's second list (4 Nov), the owner's first (2 Nov). Not the
  -- owner's private one, and not Ben's own, which Ben has not liked.
  assert lists = 'ic-ana-public,ic-own-barred,ic-own-public', format('Ana and Ben both liked: %s', lists);
end $$;

-- The owner bars Ben: his like on the owner's lists is no longer named.
insert into public.blocks (blocker, blocked) values
 ('f8000000-0000-0000-0000-00000000000f', 'f8000000-0000-0000-0000-00000000000b');
do $$
declare lists text;
begin
  set local role rls_client;
  set local test.uid = 'f8000000-0000-0000-0000-00000000000a';
  select string_agg(slug, ',' order by slug) into lists
    from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000b');
  reset role;
  assert lists = 'ic-ana-public', format('with Ben barred by the owner: %s', lists);
end $$;

-- ── the same two, asked the other way round ──
do $$
declare places text;
begin
  set local role rls_client;
  set local test.uid = 'f8000000-0000-0000-0000-00000000000b';
  select string_agg(slug, ',' order by slug) into places
    from public.places_in_common('f8000000-0000-0000-0000-00000000000a');
  reset role;
  assert places = 'ic-an,ic-banh', format('Ben and Ana share these places: %s', places);
end $$;

-- ── nothing with nobody in common, about yourself, or across a block ──
do $$
declare n int; m int;
begin
  set local role rls_client;
  set local test.uid = 'f8000000-0000-0000-0000-00000000000a';
  select count(*) into n from public.places_in_common('f8000000-0000-0000-0000-00000000000c');
  select count(*) into m from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000c');
  assert n = 0 and m = 0, format('Ana and Cy share nothing: %s places, %s lists', n, m);
  select count(*) into n from public.places_in_common('f8000000-0000-0000-0000-00000000000a');
  select count(*) into m from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000a');
  assert n = 0 and m = 0, format('nothing in common with yourself: %s places, %s lists', n, m);
  -- Dee, whom Ana blocked, and Eve, who blocked Ana: each keeps Bánh in
  -- public and liked the owner's list, as Ana did.
  select count(*) into n from public.places_in_common('f8000000-0000-0000-0000-00000000000d');
  select count(*) into m from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000d');
  assert n = 0 and m = 0, format('nothing with somebody you blocked: %s places, %s lists', n, m);
  select count(*) into n from public.places_in_common('f8000000-0000-0000-0000-00000000000e');
  select count(*) into m from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000e');
  assert n = 0 and m = 0, format('nothing with somebody who blocked you: %s places, %s lists', n, m);
  reset role;
end $$;

-- ── nobody signed out is told ──
do $$
declare told boolean := true;
begin
  set local role anon;
  begin
    perform * from public.places_in_common('f8000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then told := false;
  end;
  reset role;
  assert not told, 'anon can execute places_in_common';
  told := true;
  set local role anon;
  begin
    perform * from public.lists_liked_in_common('f8000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then told := false;
  end;
  reset role;
  assert not told, 'anon can execute lists_liked_in_common';
end $$;
