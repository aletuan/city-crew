-- Which photograph stands for a place, once a reader has added one.
--
-- The rule is narrow on purpose and the narrowness is the part worth
-- testing: a reader's upload takes the cover, and nothing else does. The
-- desk files its photographs through the same `source = 'upload'` and
-- keeps its own cover control beside them, so a test that only proved the
-- promotion would pass just as well on a trigger that trampled the desk.

insert into public.places (id, slug, is_published, review_status)
values ('e1000000-0000-0000-0000-000000000001', 'cover-place', true, 'approved');

-- Where it starts: an imported photograph holding the flag.
insert into public.place_photos (id, place_id, photo_uri, sort_order, is_cover, source)
values ('e1000000-0000-0000-0000-0000000000a1',
        'e1000000-0000-0000-0000-000000000001', 'google-1', 0, true, 'google');

-- ── a reader's upload takes it ──
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, uploaded_by, is_cover)
values ('e1000000-0000-0000-0000-0000000000a2',
        'e1000000-0000-0000-0000-000000000001', 'reader-1', 9, 'upload',
        '00000000-0000-0000-0000-00000000beef', false);

do $$
declare c int; flag boolean;
begin
  select count(*) into c from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert c = 1, format('a place should hold exactly one cover, found %s', c);
  select is_cover into flag from public.place_photos
   where id = 'e1000000-0000-0000-0000-0000000000a2';
  assert flag, 'the reader''s upload did not become the cover';
end $$;

-- ── the desk's upload does not ──
--
-- Same source, no uploader. This is the assertion the trigger's condition
-- exists for: the dashboard has a cover button of its own, and a rule that
-- moved the flag on every insert would fight the editor pressing it.
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values ('e1000000-0000-0000-0000-0000000000a3',
        'e1000000-0000-0000-0000-000000000001', 'desk-1', 10, 'upload', false);

do $$
declare holder uuid;
begin
  select id into holder from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert holder = 'e1000000-0000-0000-0000-0000000000a2',
    format('a desk upload moved the cover to %s', holder);
end $$;

-- ── nor does another import ──
insert into public.place_photos (id, place_id, photo_uri, sort_order, source)
values ('e1000000-0000-0000-0000-0000000000a4',
        'e1000000-0000-0000-0000-000000000001', 'google-2', 11, 'google');

do $$
declare holder uuid;
begin
  select id into holder from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert holder = 'e1000000-0000-0000-0000-0000000000a2',
    format('an imported photo moved the cover to %s', holder);
end $$;

-- ── a second reader upload moves it again ──
--
-- The newest is the one that stands, which is what "by default the photo
-- you just added" means when somebody adds two.
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, uploaded_by, is_cover)
values ('e1000000-0000-0000-0000-0000000000a5',
        'e1000000-0000-0000-0000-000000000001', 'reader-2', 12, 'upload',
        '00000000-0000-0000-0000-00000000beef', false);

do $$
declare c int; holder uuid;
begin
  select count(*) into c from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert c = 1, format('two uploads left %s covers', c);
  select id into holder from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert holder = 'e1000000-0000-0000-0000-0000000000a5',
    format('the cover stayed on %s rather than the newer upload', holder);
end $$;

-- ── a hidden row is not a cover ──
--
-- The insert policy refuses one, so this can only arrive from a writer
-- that does not go through it — and a hidden cover is a place with no
-- picture at all, since `photosOf` filters before it sorts.
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, uploaded_by, is_cover, is_hidden)
values ('e1000000-0000-0000-0000-0000000000a6',
        'e1000000-0000-0000-0000-000000000001', 'reader-hidden', 13, 'upload',
        '00000000-0000-0000-0000-00000000beef', false, true);

do $$
declare holder uuid;
begin
  select id into holder from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  assert holder = 'e1000000-0000-0000-0000-0000000000a5',
    format('a hidden upload took the cover: %s', holder);
end $$;

-- ── one place's upload does not reach another's cover ──
insert into public.places (id, slug, is_published, review_status)
values ('e1000000-0000-0000-0000-000000000002', 'cover-other', true, 'approved');
insert into public.place_photos (id, place_id, photo_uri, sort_order, is_cover, source)
values ('e1000000-0000-0000-0000-0000000000b1',
        'e1000000-0000-0000-0000-000000000002', 'other-google', 0, true, 'google');
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, uploaded_by, is_cover)
values ('e1000000-0000-0000-0000-0000000000b2',
        'e1000000-0000-0000-0000-000000000002', 'other-reader', 1, 'upload',
        '00000000-0000-0000-0000-00000000beef', false);

do $$
declare here uuid; there uuid;
begin
  select id into here from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000001' and is_cover;
  select id into there from public.place_photos
   where place_id = 'e1000000-0000-0000-0000-000000000002' and is_cover;
  assert here = 'e1000000-0000-0000-0000-0000000000a5',
    format('the first place lost its cover to another place''s upload: %s', here);
  assert there = 'e1000000-0000-0000-0000-0000000000b2',
    format('the second place''s upload did not take its own cover: %s', there);
end $$;

delete from public.places
 where id in ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002');

select 'all upload cover checks passed' as result;
