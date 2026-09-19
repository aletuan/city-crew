-- The one new write path, driven rather than read.
--
-- `place_photos` had exactly one writer — an editor — and this opens a
-- second. A policy that opens a door is worth exercising from the
-- outside: the text of it can look right and still admit the wrong
-- person, and nothing above this line would have said so.
--
-- Everything runs as `rls_client`, the role PostgREST puts a signed-in
-- reader in, with `test.uid` for who is asking.
--
--   1111…  a local guide, and the submitter of `lg-mine` and `lg-live`
--   2222…  signed in, no grant
--   3333…  a local guide who submitted nothing

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.places, public.place_photos to rls_client;
grant select on public.local_guides to rls_client;

insert into public.local_guides (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- One place still at the desk, one already live — both 1111…'s — and one
-- that belongs to nobody in the app.
insert into public.places (slug, city_id, is_published, review_status, submitted_by)
values ('lg-mine', 'hanoi', false, 'pending', '11111111-1111-1111-1111-111111111111'),
       ('lg-live', 'hanoi', true,  'approved', '11111111-1111-1111-1111-111111111111'),
       ('lg-theirs', 'hanoi', true, 'approved', null)
on conflict (slug) do nothing;

-- ── the grant is the gate ────────────────────────────────────────────
-- A signed-in person who was never given this cannot write, even about a
-- place that is their own. That is the whole point of rolling it out by
-- hand, so it is the first thing pinned.
do $$
declare ok boolean;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    select id, 'upload', '22222222-2222-2222-2222-222222222222', 'x/a.jpg'
    from public.places where slug = 'lg-theirs';
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  reset role;
  assert not ok, 'somebody without the grant wrote a photograph';
end $$;

-- ── and the place must be theirs ─────────────────────────────────────
-- A guide is not an editor. The grant says "you may add photographs",
-- not "you may add them anywhere".
do $$
declare ok boolean;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    select id, 'upload', '33333333-3333-3333-3333-333333333333', 'x/b.jpg'
    from public.places where slug = 'lg-theirs';
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  reset role;
  assert not ok, 'a guide wrote onto a place that was not theirs';
end $$;

-- ── a guide writes to their own, published or not ────────────────────
-- The second half is the requirement that shaped this migration: a place
-- still waiting at the desk takes photographs too, because the person
-- who has just imported a café is exactly who has the better picture of
-- it, and being made to wait is being made to forget.
do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  select id, 'upload', '11111111-1111-1111-1111-111111111111', 'lg/live-1.jpg'
  from public.places where slug = 'lg-live';
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  select id, 'upload', '11111111-1111-1111-1111-111111111111', 'lg/mine-1.jpg'
  from public.places where slug = 'lg-mine';
  reset role;
end $$;

-- ── the clauses that are not about who ───────────────────────────────
-- Four refusals, each one a way the write could have been bent: filing a
-- photograph under somebody else's name, borrowing the importer's word
-- for where it came from, claiming the cover, or arriving already hidden
-- — which would have been a way past the per-place count below.
do $$
declare uid uuid := '11111111-1111-1111-1111-111111111111'; pid uuid; ok boolean;
begin
  select id into pid from public.places where slug = 'lg-live';

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';

  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    values (pid, 'upload', '22222222-2222-2222-2222-222222222222', 'lg/x.jpg');
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, 'a photograph was filed under another account';

  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    values (pid, 'google', uid, 'lg/x.jpg');
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, 'a guide claimed the importer''s source';

  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri, is_cover)
    values (pid, 'upload', uid, 'lg/x.jpg', true);
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, 'a guide took the cover';

  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri, is_hidden)
    values (pid, 'upload', uid, 'lg/x.jpg', true);
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, 'a photograph arrived already hidden';

  reset role;
end $$;

-- ── five to a place ──────────────────────────────────────────────────
-- One is already there from the block above, so four more land and the
-- sixth does not. This is the cap that matters: a hundred pictures of
-- one café is not a contribution, and it would bury the one the desk
-- chose.
do $$
declare uid uuid := '11111111-1111-1111-1111-111111111111'; pid uuid; ok boolean;
begin
  select id into pid from public.places where slug = 'lg-live';
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  values (pid, 'upload', uid, 'lg/live-2.jpg'), (pid, 'upload', uid, 'lg/live-3.jpg'),
         (pid, 'upload', uid, 'lg/live-4.jpg'), (pid, 'upload', uid, 'lg/live-5.jpg');
  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    values (pid, 'upload', uid, 'lg/live-6.jpg');
    ok := true;
  exception when insufficient_privilege then ok := false; end;
  reset role;
  assert not ok, 'a sixth photograph landed on one place';
end $$;

-- ── what the two read policies already did ───────────────────────────
-- Not new behaviour, and that is the point of pinning it: the visibility
-- rule this feature was asked for is the rule `place_submissions` wrote.
-- A photograph on a live place is public at once; the same photograph on
-- a place still at the desk is the submitter's alone. If either of those
-- policies is ever narrowed, this feature quietly changes meaning and
-- this assert is what says so.
do $$
declare mine text; theirs text; anon_ text;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select string_agg(photo_uri, ',' order by photo_uri) into mine
  from public.place_photos where photo_uri like 'lg/%';
  reset role;

  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select string_agg(photo_uri, ',' order by photo_uri) into theirs
  from public.place_photos where photo_uri like 'lg/%';
  reset role;

  set local role rls_client;
  set local test.uid = '';
  select string_agg(photo_uri, ',' order by photo_uri) into anon_
  from public.place_photos where photo_uri like 'lg/%';
  reset role;

  assert mine like '%lg/mine-1.jpg%', format('the submitter cannot see their own pending photo: %s', mine);
  assert theirs not like '%lg/mine-1.jpg%', format('a stranger saw a pending place''s photo: %s', theirs);
  assert theirs like '%lg/live-1.jpg%', format('a stranger cannot see a live photo: %s', theirs);
  assert anon_ not like '%lg/mine-1.jpg%', format('a signed-out reader saw a pending photo: %s', anon_);
end $$;

-- ── taking one back ──────────────────────────────────────────────────
-- An undo that works the same way the write did, and reaches no further
-- than the rows it made: the editor's photograph beside it stays.
do $$
declare pid uuid; left_ int; ok boolean;
begin
  select id into pid from public.places where slug = 'lg-live';
  insert into public.place_photos (place_id, source, photo_uri)
  values (pid, 'upload', 'lg/desk.jpg');

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  delete from public.place_photos where photo_uri = 'lg/live-5.jpg';
  select count(*) into left_ from public.place_photos where photo_uri = 'lg/live-5.jpg';
  -- The desk's row is not theirs to remove. RLS answers a delete it does
  -- not allow with silence rather than an error, so the count is the
  -- assertion.
  delete from public.place_photos where photo_uri = 'lg/desk.jpg';
  reset role;

  assert left_ = 0, 'a guide could not remove their own photograph';
  select count(*) into left_ from public.place_photos where photo_uri = 'lg/desk.jpg';
  assert left_ = 1, 'a guide removed a photograph the desk had placed';
end $$;

-- ── and a person with no grant reads nothing about the grants ────────
do $$
declare seen int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select count(*) into seen from public.local_guides;
  reset role;
  assert seen = 0, format('someone without a grant saw %s of them', seen);

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select count(*) into seen from public.local_guides;
  reset role;
  assert seen = 1, format('a guide should see one row, their own; saw %s', seen);
end $$;

-- Leave the bench as it was found: the blocks after this one read the
-- places stub and do not expect these rows.
delete from public.place_photos where photo_uri like 'lg/%';
delete from public.places where slug like 'lg-%';
delete from public.local_guides where user_id in (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

select 'all local guide checks passed' as result;
