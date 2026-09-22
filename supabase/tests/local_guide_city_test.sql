-- A grant names a city, and stops at its edge.
--
-- `local_guide_test.sql` pins the role itself: who may write a photograph
-- at all. This pins the line the role was given — the thing
-- `20260922100000_local_guides_per_city.sql` added — and it runs here
-- rather than beside that file because the migration it exercises is the
-- newest of the four that touch these policies. Applied in timestamp
-- order, as production applies them, it is the one that wins; applied in
-- the order `run.sh` groups them, the gallery migrations would land on
-- top and this would be testing a schema nobody ships.
--
--   5555…  a guide of Hanoi, and of nowhere else
--   6666…  a guide of everywhere — a row that predates the column

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.places, public.place_photos to rls_client;
grant select on public.local_guides to rls_client;

insert into public.cities (id) values ('hanoi'), ('danang') on conflict do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'hanoi-guide@x.com', '{"handle":"hnguide"}'),
  ('66666666-6666-6666-6666-666666666666', 'everywhere@x.com',  '{"handle":"everywhere"}')
on conflict (id) do nothing;

insert into public.local_guides (user_id, city_id)
  values ('55555555-5555-5555-5555-555555555555', 'hanoi')
on conflict do nothing;
insert into public.local_guides (user_id)
  values ('66666666-6666-6666-6666-666666666666')
on conflict do nothing;

-- One place each, in each city, submitted by the person who will try to
-- write on it. The submitter is held constant so that the only thing
-- separating the two attempts is which city the place is in.
insert into public.places (slug, city_id, is_published, review_status, submitted_by)
values ('lgc-hn-5', 'hanoi',  false, 'pending', '55555555-5555-5555-5555-555555555555'),
       ('lgc-dn-5', 'danang', false, 'pending', '55555555-5555-5555-5555-555555555555'),
       ('lgc-dn-6', 'danang', false, 'pending', '66666666-6666-6666-6666-666666666666')
on conflict (slug) do nothing;

-- ── inside the city named on the grant ───────────────────────────────
do $$
begin
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  select id, 'upload', '55555555-5555-5555-5555-555555555555', 'lgc/hn.jpg'
  from public.places where slug = 'lgc-hn-5';
  reset role;
end $$;

-- ── and outside it, on a place that is just as much theirs ───────────
do $$
declare ok boolean;
begin
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  begin
    insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
    select id, 'upload', '55555555-5555-5555-5555-555555555555', 'lgc/dn.jpg'
    from public.places where slug = 'lgc-dn-5';
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  reset role;
  assert not ok, 'a guide of Hanoi wrote a photograph on a place in Da Nang';
end $$;

-- ── an all-cities grant covers a city it never named ─────────────────
-- 6666…'s row has city_id null, which is what every grant made before
-- the column looks like. It has to keep meaning "anywhere".
do $$
begin
  set local role rls_client;
  set local test.uid = '66666666-6666-6666-6666-666666666666';
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  select id, 'upload', '66666666-6666-6666-6666-666666666666', 'lgc/dn6.jpg'
  from public.places where slug = 'lgc-dn-6';
  reset role;
end $$;

-- ── the same edge, on the way back out ───────────────────────────────
-- Deleting is a separate policy and `guide_may_manage` is a separate
-- function; both had to learn the same rule, so both are asked.
do $$
declare ok boolean; left_ int;
begin
  -- A photograph on 5555…'s Da Nang place, placed by the desk.
  insert into public.place_photos (place_id, source, uploaded_by, photo_uri)
  select id, 'upload', '55555555-5555-5555-5555-555555555555', 'lgc/dn-desk.jpg'
  from public.places where slug = 'lgc-dn-5';

  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  delete from public.place_photos where photo_uri = 'lgc/dn-desk.jpg';
  reset role;

  select count(*) into left_ from public.place_photos where photo_uri = 'lgc/dn-desk.jpg';
  assert left_ = 1, 'a guide of Hanoi deleted a photograph on a place in Da Nang';

  -- And the cover, which goes through guide_may_manage rather than a policy.
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  select public.guide_may_manage(id) into ok
  from public.place_photos where photo_uri = 'lgc/dn-desk.jpg';
  reset role;
  assert not ok, 'guide_may_manage said yes about a place outside the grant';

  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  select public.guide_may_manage(id) into ok
  from public.place_photos where photo_uri = 'lgc/hn.jpg';
  reset role;
  assert ok, 'guide_may_manage said no about a place inside the grant';
end $$;

-- ── one row per person per city, one "everywhere" row ────────────────
do $$
declare ok boolean;
begin
  begin
    insert into public.local_guides (user_id, city_id)
    values ('55555555-5555-5555-5555-555555555555', 'hanoi');
    ok := true;
  exception when unique_violation then ok := false;
  end;
  assert not ok, 'the same person was granted the same city twice';

  begin
    insert into public.local_guides (user_id)
    values ('66666666-6666-6666-6666-666666666666');
    ok := true;
  exception when unique_violation then ok := false;
  end;
  assert not ok, 'the same person was granted every city twice';

  -- A narrower row on top of an everywhere grant is allowed: the two say
  -- different things, and the wider one simply wins when both are read.
  insert into public.local_guides (user_id, city_id)
  values ('66666666-6666-6666-6666-666666666666', 'hanoi');
  delete from public.local_guides
  where user_id = '66666666-6666-6666-6666-666666666666' and city_id = 'hanoi';
end $$;

-- ── a grant cannot name a city that does not exist ───────────────────
do $$
declare ok boolean;
begin
  begin
    insert into public.local_guides (user_id, city_id)
    values ('55555555-5555-5555-5555-555555555555', 'atlantis');
    ok := true;
  exception when foreign_key_violation then ok := false;
  end;
  assert not ok, 'a grant named a city the catalog does not have';
end $$;

-- Leave the bench as it was found.
delete from public.place_photos where photo_uri like 'lgc/%';
delete from public.places where slug like 'lgc-%';
delete from public.local_guides where user_id in (
  '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666');

select 'all per-city local guide checks passed' as result;
