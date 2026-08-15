-- What publishing a collection is allowed to do, and what it still is not.
--
-- The migration deliberately removes a guard an earlier one wrote on
-- purpose. These checks are the replacement for the comment that used to
-- be the only thing holding it: they pin the shape of the permission so a
-- later edit cannot quietly widen it back past what was intended.
--
-- The handles here come from the profiles the runner has already made.

-- --------------------------------------------------------------- policy

-- The one that changed. An owner may set the flag on a row that is
-- already theirs — but `using` still limits it to their own rows, and the
-- check still refuses to hand one to somebody else.
do $$
declare qual text; chk text;
begin
  select pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    into qual, chk
    from pg_policy where polname = 'owners update their collections'
     and polrelid = 'public.collections'::regclass;
  assert qual is not null, 'the owner update policy is missing';
  assert qual like '%auth.uid()%', format('update policy stopped scoping to the caller: %s', qual);
  assert chk like '%auth.uid()%', format('update check stopped scoping to the caller: %s', chk);
  assert chk not like '%is_public%',
    format('update check still pins is_public, so publishing cannot work: %s', chk);
end $$;

-- The one that did NOT change, and must not. A collection is born
-- private, always; publishing is a second, deliberate act. If this ever
-- relaxes, a client could create a row that is public before anyone has
-- looked at what is in it.
do $$
declare chk text;
begin
  select pg_get_expr(polwithcheck, polrelid) into chk
    from pg_policy where polname = 'owners insert their collections'
     and polrelid = 'public.collections'::regclass;
  assert chk is not null, 'the owner insert policy is missing';
  assert chk like '%is_public%',
    format('a collection can now be created already public: %s', chk);
end $$;

-- ------------------------------------------------------------ the stamp

insert into public.collections (slug, owner_id, is_public)
values ('date-night', 'aaaaaaaa-0000-0000-0000-000000000001', false);

-- Private, so no byline.
do $$
declare h text;
begin
  select curator_handle into h from public.collections where slug = 'date-night';
  assert h is null, format('a private list is carrying a byline: %s', h);
end $$;

-- Published: the handle is read from the profile, not from the request.
do $$
declare h text; expected text;
begin
  update public.collections set is_public = true where slug = 'date-night';
  select curator_handle into h from public.collections where slug = 'date-night';
  select handle into expected from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert h = expected, format('published as %s, profile says %s', h, expected);
end $$;

-- The attribution cannot be dictated. This is the whole reason the stamp
-- is a trigger and not a column the client writes: an update travels
-- through PostgREST as a body the sender composed.
do $$
declare h text; expected text;
begin
  update public.collections
     set curator_handle = 'citycrew', is_public = true
   where slug = 'date-night';
  select curator_handle into h from public.collections where slug = 'date-night';
  select handle into expected from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert h = expected, format('a client claimed the handle %s', h);
end $$;

-- And it cannot be smuggled in at insert either.
do $$
declare h text;
begin
  insert into public.collections (slug, owner_id, is_public, curator_handle)
  values ('smuggled', 'aaaaaaaa-0000-0000-0000-000000000002', false, 'citycrew');
  select curator_handle into h from public.collections where slug = 'smuggled';
  assert h is null, format('a byline survived on a private list: %s', h);
end $$;

-- Unpublished: the byline goes with it. A list nobody else can see has
-- nobody to be credited to.
do $$
declare h text;
begin
  update public.collections set is_public = false where slug = 'date-night';
  select curator_handle into h from public.collections where slug = 'date-night';
  assert h is null, format('an unpublished list kept its byline: %s', h);
end $$;

-- Editorial rows have no owner and their handles are set by the desk in
-- the seed migrations. The trigger runs on every row, so this is the
-- check that it keeps its hands off them.
do $$
declare h text;
begin
  insert into public.collections (slug, owner_id, is_public, curator_handle)
  values ('hanoi-coffee', null, true, 'hanoicrew');
  select curator_handle into h from public.collections where slug = 'hanoi-coffee';
  assert h = 'hanoicrew', format('the trigger rewrote an editorial byline to %s', h);

  update public.collections set sort_order = 3 where slug = 'hanoi-coffee';
  select curator_handle into h from public.collections where slug = 'hanoi-coffee';
  assert h = 'hanoicrew', format('an editorial byline was lost on update: %s', h);
end $$;

-- A published list belonging to someone with no profile row gets no
-- byline rather than failing the publish. Losing the name is a smaller
-- thing than a person being unable to publish at all.
do $$
declare h text; u uuid := 'aaaaaaaa-0000-0000-0000-0000000000f0';
begin
  -- An account with the profile taken away, rather than a uuid with no
  -- account: owner_id carries a foreign key, so the row has to exist for
  -- the case to be reachable at all.
  insert into auth.users (id, email) values (u, 'noprofile@x.com');
  delete from public.profiles where id = u;

  insert into public.collections (slug, owner_id, is_public) values ('orphan', u, false);
  update public.collections set is_public = true where slug = 'orphan';
  select curator_handle into h from public.collections where slug = 'orphan';
  assert h is null, format('a byline appeared from nowhere: %s', h);
end $$;

-- ------------------------------------------------------------- exposure

-- Same shape as the profiles migration's trigger functions: anything
-- SECURITY DEFINER left executable in `public` is an endpoint at
-- /rest/v1/rpc/.
do $$
declare granted boolean; pinned int;
begin
  select has_function_privilege('anon', 'public.stamp_curator()', 'execute') into granted;
  assert not granted, 'anon can execute the curator stamp';
  select has_function_privilege('public', 'public.stamp_curator()', 'execute') into granted;
  assert not granted, 'public can execute the curator stamp';

  select count(*) into pinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'stamp_curator'
     and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert pinned = 1, 'stamp_curator has a mutable search_path';
end $$;

select 'all publish migration checks passed' as result;
