-- A public list stays public when a place in it is not live, and the
-- place is what nobody else sees (`*_lists_stay_public_around_unlive_places`).
--
-- Exercised as a client: `rls_client` as the owner, as a stranger signed
-- in, and as nobody. Everything the stranger reads goes through the same
-- policies a phone's request does.

grant usage on schema public to rls_client;
grant select on public.places, public.collections, public.collection_places to rls_client;

insert into auth.users (id, email) values
 ('e3000000-0000-0000-0000-00000000000a', 'owner@x.com'),
 ('e3000000-0000-0000-0000-00000000000b', 'stranger@x.com');

insert into public.places (id, slug, is_published, review_status, submitted_by) values
 ('e3000000-0000-0000-0000-0000000000f1', 'lp-live-one',   true,  'approved', null),
 ('e3000000-0000-0000-0000-0000000000f2', 'lp-live-two',   true,  'approved', null),
 ('e3000000-0000-0000-0000-0000000000f3', 'lp-pending',    false, 'pending',  'e3000000-0000-0000-0000-00000000000a'),
 -- Approved and still unpublished: a real state, and the one a rule
 -- written against approval alone lets through.
 ('e3000000-0000-0000-0000-0000000000f4', 'lp-approved-unpublished', false, 'approved', null);

insert into public.collections (id, slug, owner_id) values
 ('e3000000-0000-0000-0000-0000000000c1', 'lp-thirty', 'e3000000-0000-0000-0000-00000000000a');
insert into public.collection_places (collection_id, place_id, sort_order) values
 ('e3000000-0000-0000-0000-0000000000c1', 'e3000000-0000-0000-0000-0000000000f1', 0),
 ('e3000000-0000-0000-0000-0000000000c1', 'e3000000-0000-0000-0000-0000000000f2', 1);
update public.collections set is_public = true where slug = 'lp-thirty';

-- What a reader sees of the list's members, by who they are.
create or replace function pg_temp.members_seen(uid text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('test.uid', coalesce(uid, ''), true);
  set local role rls_client;
  select count(*) into n from public.collection_places
   where collection_id = 'e3000000-0000-0000-0000-0000000000c1';
  reset role;
  return n;
end $$;

-- ───────────────────────────────────── adding a place that is not live

-- The owner's case (23 Oct 2026): a public list gains a pending place and
-- stays public. It used to go private, silently, and could not be made
-- public again until the place was approved.
do $$
declare pub boolean;
begin
  insert into public.collection_places (collection_id, place_id, sort_order) values
   ('e3000000-0000-0000-0000-0000000000c1', 'e3000000-0000-0000-0000-0000000000f3', 2),
   ('e3000000-0000-0000-0000-0000000000c1', 'e3000000-0000-0000-0000-0000000000f4', 3);
  select is_public into pub from public.collections where slug = 'lp-thirty';
  assert pub, 'a public list went private when it gained a place that is not live';
end $$;

-- Nobody else sees the places that are not live; the owner sees them all.
do $$
declare stranger int; nobody int; owner int;
begin
  stranger := pg_temp.members_seen('e3000000-0000-0000-0000-00000000000b');
  nobody   := pg_temp.members_seen(null);
  owner    := pg_temp.members_seen('e3000000-0000-0000-0000-00000000000a');
  assert stranger = 2, format('a stranger saw %s members of four, two of them not live', stranger);
  assert nobody = 2, format('a signed-out reader saw %s members of four, two of them not live', nobody);
  assert owner = 4, format('the owner saw %s of their own four members', owner);
end $$;

-- ─────────────────────────────────────── making it public with them in

do $$
declare pub boolean;
begin
  update public.collections set is_public = false where slug = 'lp-thirty';
  update public.collections set is_public = true where slug = 'lp-thirty';
  select is_public into pub from public.collections where slug = 'lp-thirty';
  assert pub, 'a list holding a place that is not live could not be made public';
end $$;

-- ─────────────────────────────────────── a place approved, then pulled

-- Approved: in the list for everyone, with nothing to republish.
do $$
declare stranger int;
begin
  update public.places set is_published = true, review_status = 'approved'
   where slug = 'lp-pending';
  stranger := pg_temp.members_seen('e3000000-0000-0000-0000-00000000000b');
  assert stranger = 3, format('a place approved into a public list showed %s members, not 3', stranger);
end $$;

-- Flagged by the desk, and unpublished by it: out of the list for
-- everyone else, and the list stays public.
do $$
declare stranger int; pub boolean;
begin
  update public.places set review_status = 'flagged' where slug = 'lp-live-two';
  update public.places set is_published = false where slug = 'lp-live-one';
  select is_public into pub from public.collections where slug = 'lp-thirty';
  assert pub, 'a public list went private when the desk pulled a place in it';
  stranger := pg_temp.members_seen('e3000000-0000-0000-0000-00000000000b');
  assert stranger = 1, format('a stranger saw %s members after two were pulled, not 1', stranger);
  assert pg_temp.members_seen('e3000000-0000-0000-0000-00000000000a') = 4,
    'the owner lost sight of members the desk pulled';
end $$;

-- ─────────────────────────────────────── counts that read past RLS

-- Two owners holding the same place in public lists have it in common
-- only while it is live: a pulled place is in neither list for anyone
-- else, so it is not something they share.
insert into public.collections (id, slug, owner_id) values
 ('e3000000-0000-0000-0000-0000000000c2', 'lp-strangers', 'e3000000-0000-0000-0000-00000000000b');
insert into public.collection_places (collection_id, place_id) values
 ('e3000000-0000-0000-0000-0000000000c2', 'e3000000-0000-0000-0000-0000000000f2'),
 ('e3000000-0000-0000-0000-0000000000c2', 'e3000000-0000-0000-0000-0000000000f3');
update public.collections set is_public = true where slug = 'lp-strangers';

do $$
declare mutual int; suggested int;
begin
  perform set_config('test.uid', 'e3000000-0000-0000-0000-00000000000a', true);
  set local role rls_client;
  select m.mutual into mutual from public.mutual_saves_counts(array['e3000000-0000-0000-0000-00000000000b']::uuid[]) m;
  select s.mutual into suggested from public.suggested_friends() s where s.other = 'e3000000-0000-0000-0000-00000000000b';
  reset role;
  -- f3, approved above, is shared and live; f2 was flagged.
  assert mutual = 1, format('mutual_saves_counts counted %s places in common, not 1', mutual);
  assert suggested = 1, format('suggested_friends counted %s places in common, not 1', suggested);
end $$;

-- ─────────────────────────────────────────────── the old rule is gone

do $$
declare n int;
begin
  select count(*) into n from pg_trigger
   where tgname in ('collections_guard_publish', 'collection_places_unpublish', 'places_unpublish_collections');
  assert n = 0, format('%s of the triggers that made lists private are still there', n);
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.proname in ('guard_collection_publish', 'unpublish_on_unlive_member',
                       'unpublish_collections_of_pulled_place', 'collection_has_unlive_member');
  assert n = 0, format('%s of the functions that made lists private are still there', n);
end $$;

select 'all lists-stay-public checks passed' as result;
