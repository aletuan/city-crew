-- A suggested place is its submitter's until the desk says otherwise,
-- and a collection may not publish what nobody else can see.
--
-- The rules under test are worth restating, because the interesting ones
-- are about *two* flags rather than one:
--
--   live  ==  is_published AND review_status = 'approved'
--
-- Anything short of that is invisible to everyone but its submitter, and
-- keeps the collections holding it private.

-- ─────────────────────────────────────────────────── the vocabulary

do $$
declare ok boolean;
begin
  begin
    insert into public.places (slug, review_status) values ('bad-status', 'rejected');
    ok := false;
  exception when check_violation then
    ok := true;
  end;
  assert ok, 'review_status accepted a value outside pending/approved/flagged';
end $$;

do $$
begin
  insert into public.places (slug, review_status) values ('s-pending', 'pending');
  insert into public.places (slug, review_status) values ('s-approved', 'approved');
  insert into public.places (slug, review_status) values ('s-flagged', 'flagged');
end $$;

-- The three the dashboard already speaks all survive; the guess this
-- work started with ("rejected") does not.

-- ──────────────────────────────────────────────────────── the policies

do $$
declare qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
    from pg_policy where polname = 'submitters read their own places'
     and polrelid = 'public.places'::regclass;
  assert qual is not null, 'submitters cannot read their own places';
  assert qual like '%submitted_by%' and qual like '%auth.uid()%',
    format('the submitter policy is not scoped to the submitter: %s', qual);
end $$;

-- A place with no photograph is a name in an empty frame, which is the
-- state the whole design exists to avoid — so the photos come too.
do $$
declare qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
    from pg_policy where polname = 'submitters read their own place photos'
     and polrelid = 'public.place_photos'::regclass;
  assert qual is not null, 'a submitter cannot see their own place''s photos';
  assert qual like '%is_hidden%',
    format('a photo the desk pulled would still show: %s', qual);
end $$;

-- ─────────────────────────────────────────────── deleting an account

-- The credit is personal; the café is not. A place that has been
-- approved belongs to the catalog, and losing an account should not take
-- it out of the city.
do $$
declare u uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1';
  still int; owner_ uuid;
begin
  insert into auth.users (id, email) values (u, 'leaver@x.com');
  insert into public.places (slug, submitted_by, is_published, review_status)
  values ('survives-its-author', u, true, 'approved');

  delete from auth.users where id = u;

  select count(*) into still from public.places where slug = 'survives-its-author';
  assert still = 1, 'deleting an account deleted a place from the catalog';

  select submitted_by into owner_ from public.places where slug = 'survives-its-author';
  assert owner_ is null, 'the credit outlived the account it belonged to';
end $$;

-- ──────────────────────────────────────────────────── the publish gate

-- Fixtures: one live place, one pending, one approved-but-unpublished.
-- The third is the one that matters — it is a real state in production
-- today, and a gate written against `approved` alone would let it pass.
do $$
declare u uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  insert into public.places (slug, is_published, review_status) values
    ('live-one',    true,  'approved'),
    ('live-two',    true,  'approved'),
    ('pending-one', false, 'pending'),
    ('approved-unpublished', false, 'approved');

  insert into public.collections (slug, owner_id, is_public) values
    ('all-live',      u, false),
    ('has-pending',   u, false),
    ('has-unpub',     u, false);

  insert into public.collection_places (collection_id, place_id)
  select c.id, p.id from public.collections c, public.places p
   where (c.slug, p.slug) in (
     ('all-live','live-one'), ('all-live','live-two'),
     ('has-pending','live-one'), ('has-pending','pending-one'),
     ('has-unpub','live-one'), ('has-unpub','approved-unpublished')
   );
end $$;

do $$
declare pub boolean;
begin
  update public.collections set is_public = true where slug = 'all-live';
  select is_public into pub from public.collections where slug = 'all-live';
  assert pub, 'a collection of live places was refused';
end $$;

do $$
declare ok boolean;
begin
  begin
    update public.collections set is_public = true where slug = 'has-pending';
    ok := false;
  exception when check_violation then
    ok := true;
  end;
  assert ok, 'a collection holding a pending place was published';
end $$;

-- The two-flag case, stated on its own because it is the one a careless
-- implementation gets wrong.
do $$
declare ok boolean;
begin
  begin
    update public.collections set is_public = true where slug = 'has-unpub';
    ok := false;
  exception when check_violation then
    ok := true;
  end;
  assert ok, 'an approved-but-unpublished place passed the gate';
end $$;

-- Editorial rows have no owner and are published by seed migrations.
-- The gate must not reach them, or a migration would fail on data the
-- desk controls.
do $$
declare pub boolean;
begin
  insert into public.places (slug, is_published, review_status)
  values ('desk-pending', false, 'pending');
  insert into public.collections (slug, owner_id, is_public) values ('desk-list', null, false);
  insert into public.collection_places (collection_id, place_id)
  select c.id, p.id from public.collections c, public.places p
   where c.slug = 'desk-list' and p.slug = 'desk-pending';

  update public.collections set is_public = true where slug = 'desk-list';
  select is_public into pub from public.collections where slug = 'desk-list';
  assert pub, 'the gate blocked an editorial collection';
end $$;

-- Already public, and edited for some other reason: the gate is about
-- the transition, not about every write.
do $$
declare pub boolean;
begin
  update public.collections set sort_order = 9 where slug = 'all-live';
  select is_public into pub from public.collections where slug = 'all-live';
  assert pub, 'editing a published collection unpublished it';
end $$;

-- ───────────────────────────────────────────── falling back to private

-- Adding a pending place to a list that is already public.
do $$
declare pub boolean;
begin
  insert into public.collection_places (collection_id, place_id)
  select c.id, p.id from public.collections c, public.places p
   where c.slug = 'all-live' and p.slug = 'pending-one';

  select is_public into pub from public.collections where slug = 'all-live';
  assert not pub, 'a public collection kept a pending place and stayed public';
end $$;

-- The desk flags a place that is inside somebody's published list. The
-- owner is not the one making the change, and their own update policy
-- would refuse it — which is why the trigger is SECURITY DEFINER.
do $$
declare u uuid := 'aaaaaaaa-0000-0000-0000-000000000002'; pub boolean;
begin
  insert into public.collections (slug, owner_id, is_public) values ('someone-elses', u, false);
  insert into public.collection_places (collection_id, place_id)
  select c.id, p.id from public.collections c, public.places p
   where c.slug = 'someone-elses' and p.slug = 'live-two';
  update public.collections set is_public = true where slug = 'someone-elses';

  update public.places set review_status = 'flagged' where slug = 'live-two';

  select is_public into pub from public.collections where slug = 'someone-elses';
  assert not pub, 'flagging a place left the collection holding it public';
end $$;

-- Unpublishing a place does the same as flagging it: two flags, one
-- meaning.
do $$
declare u uuid := 'aaaaaaaa-0000-0000-0000-000000000003'; pub boolean;
begin
  insert into public.places (slug, is_published, review_status)
  values ('live-three', true, 'approved');
  insert into public.collections (slug, owner_id, is_public) values ('by-unpublish', u, false);
  insert into public.collection_places (collection_id, place_id)
  select c.id, p.id from public.collections c, public.places p
   where c.slug = 'by-unpublish' and p.slug = 'live-three';
  update public.collections set is_public = true where slug = 'by-unpublish';

  update public.places set is_published = false where slug = 'live-three';

  select is_public into pub from public.collections where slug = 'by-unpublish';
  assert not pub, 'unpublishing a place left the collection holding it public';
end $$;

-- Approving a place must not disturb anything. The triggers fire on
-- every update to a place row, so the direction has to be checked.
do $$
declare pub boolean;
begin
  update public.places set review_status = 'approved', is_published = true
   where slug = 'live-three';
  select is_public into pub from public.collections where slug = 'by-unpublish';
  assert not pub, 'a collection republished itself when its place was approved';

  update public.collections set is_public = true where slug = 'by-unpublish';
  select is_public into pub from public.collections where slug = 'by-unpublish';
  assert pub, 'a collection could not be republished once its place went live';
end $$;

-- ─────────────────────────────────────────────── the guard sees it all

-- The point of SECURITY DEFINER on the check, stated as a test. Under
-- the caller's own RLS a place submitted by somebody else is invisible,
-- and a guard that could not see it would wave the collection through.
do $$
declare unlive boolean;
begin
  select public.collection_has_unlive_member(id) into unlive
    from public.collections where slug = 'has-pending';
  assert unlive, 'the guard could not see a member it is meant to catch';

  select public.collection_has_unlive_member(id) into unlive
    from public.collections where slug = 'desk-list';
  assert unlive, 'the guard missed a pending place in an editorial list';
end $$;

-- ───────────────────────────────────────────────────────── exposure

do $$
declare granted boolean; fn text; unpinned int;
begin
  foreach fn in array array[
    'public.collection_has_unlive_member(uuid)',
    'public.guard_collection_publish()',
    'public.unpublish_on_unlive_member()',
    'public.unpublish_collections_of_pulled_place()'
  ] loop
    select has_function_privilege('anon', fn, 'execute') into granted;
    assert not granted, format('anon can execute %s', fn);
    select has_function_privilege('authenticated', fn, 'execute') into granted;
    assert not granted, format('authenticated can execute %s', fn);
  end loop;

  select count(*) into unpinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('collection_has_unlive_member', 'guard_collection_publish',
                       'unpublish_on_unlive_member', 'unpublish_collections_of_pulled_place')
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
     );
  assert unpinned = 0, format('%s submission functions have a mutable search_path', unpinned);
end $$;

select 'all submission migration checks passed' as result;
