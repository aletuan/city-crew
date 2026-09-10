-- A suggested place, as the database shows it: to its submitter at once,
-- to everybody once the desk says so, to nobody in between — and never
-- for a client to move along on its own.
--
-- Exercised as `rls_client`. `submissions_test.sql` checks the publish
-- gate and the policies' text; this checks who sees what.

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.places, public.place_photos to rls_client;

-- Three places: one pending and 1111…'s, one live, one approved but not
-- yet published — the state a gate written against approval alone would
-- leak. A visible and a hidden photo on the pending one.
insert into public.places (slug, city_id, is_published, review_status, submitted_by)
values ('sub-pending', 'hanoi', false, 'pending', '11111111-1111-1111-1111-111111111111'),
       ('sub-live', 'hanoi', true, 'approved', null),
       ('sub-approved-unpublished', 'hanoi', false, 'approved', null)
on conflict (slug) do nothing;
insert into public.place_photos (place_id, photo_uri, is_hidden)
select id, 'http://x/p1.jpg', false from public.places where slug = 'sub-pending';
insert into public.place_photos (place_id, photo_uri, is_hidden)
select id, 'http://x/p2.jpg', true from public.places where slug = 'sub-pending';
insert into public.place_photos (place_id, photo_uri, is_hidden)
select id, 'http://x/p3.jpg', false from public.places where slug = 'sub-live';

-- ── who sees which place ─────────────────────────────────────────────
do $$
declare mine text; theirs text; anon_ text;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select string_agg(slug, ',' order by slug) into mine from public.places where slug like 'sub-%';
  reset role;
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select string_agg(slug, ',' order by slug) into theirs from public.places where slug like 'sub-%';
  reset role;
  set local role rls_client;
  set local test.uid = '';
  select string_agg(slug, ',' order by slug) into anon_ from public.places where slug like 'sub-%';
  reset role;
  assert mine = 'sub-live,sub-pending', format('the submitter sees: %s', mine);
  assert theirs = 'sub-live', format('another person sees: %s', theirs);
  assert anon_ = 'sub-live', format('a signed-out reader sees: %s', anon_);
end $$;

-- ── and which photos ─────────────────────────────────────────────────
-- The submitter sees their pending place's photos, minus the one the
-- desk hid; everybody else sees only the live place's.
do $$
declare mine text; theirs text;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select string_agg(photo_uri, ',' order by photo_uri) into mine from public.place_photos where photo_uri like 'http://x/p%';
  reset role;
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select string_agg(photo_uri, ',' order by photo_uri) into theirs from public.place_photos where photo_uri like 'http://x/p%';
  reset role;
  assert mine = 'http://x/p1.jpg,http://x/p3.jpg', format('the submitter sees photos: %s', mine);
  assert theirs = 'http://x/p3.jpg', format('another person sees photos: %s', theirs);
end $$;

-- ── a client does not move a place along ─────────────────────────────
-- Seeing your own pending place is not the same as approving it. There
-- is no update policy for a submitter, so the write finds no row; and no
-- insert policy at all, so a place made by hand is refused outright.
do $$
declare moved int; refused bool := false;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (
    update public.places set is_published = true, review_status = 'approved'
     where slug = 'sub-pending' returning 1
  ) select count(*) into moved from u;
  begin
    insert into public.places (slug, city_id, submitted_by)
    values ('sub-by-hand', 'hanoi', '11111111-1111-1111-1111-111111111111');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert moved = 0, 'a submitter approved their own place';
  assert refused, 'a client inserted a place directly';
end $$;

-- ── the desk does ────────────────────────────────────────────────────
do $$
declare by_editor int; live_now text;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  with u as (
    update public.places set is_published = true, review_status = 'approved'
     where slug = 'sub-pending' returning 1
  ) select count(*) into by_editor from u;
  reset role;

  -- `set local` lasts the statement, and this block is one statement:
  -- the editor's token has to be put down before the next reader picks
  -- the table up, or the signed-out read below is the desk's.
  set local test.jwt = '';
  set local role rls_client;
  set local test.uid = '';
  select string_agg(slug, ',' order by slug) into live_now from public.places where slug like 'sub-%';
  reset role;

  assert by_editor = 1, 'an editor could not approve a submission';
  assert live_now = 'sub-live,sub-pending', format('after approval a signed-out reader sees: %s', live_now);
end $$;

delete from public.places where slug like 'sub-%';

select 'all submission RLS checks passed' as result;
