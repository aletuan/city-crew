-- Two tables a client may not write, tried as one.
--
-- The last two of the forty with RLS on that nothing asserted (found
-- 22 Nov 2026). Each was closed in its migration by what it lacks, so a
-- test has to say what that absence is for:
--
--   `editorial_collection_origin`  desk history; RLS on and no policy at
--                                  all, so no client reads or writes it.
--   `reserved_handles`             names nobody may take; one policy,
--                                  public read, so anyone can check a
--                                  handle and nobody can free one.
--
-- The grants are Supabase's defaults for a public table, which hand every
-- privilege to anon and authenticated and leave the policies to decide.
-- Without them a refusal here would be the grant's, not the policy's, and
-- would prove nothing about production.

grant usage on schema public to rls_client, anon;
grant select, insert, update, delete on public.editorial_collection_origin, public.reserved_handles to rls_client, anon;

insert into public.reserved_handles (handle, reason) values ('ct-closed', 'test') on conflict do nothing;
insert into public.editorial_collection_origin (collection_id, previous_owner_id)
select id, '44444444-4444-4444-4444-444444444444' from public.collections order by id limit 1
on conflict do nothing;

-- ── what the catalog says ────────────────────────────────────────────
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.editorial_collection_origin'::regclass),
    'editorial_collection_origin has RLS off';
  assert (select count(*) from pg_policies where tablename = 'editorial_collection_origin') = 0,
    'editorial_collection_origin grew a policy; it is meant to have none';
  assert (select relrowsecurity from pg_class where oid = 'public.reserved_handles'::regclass),
    'reserved_handles has RLS off';
  assert (select array_agg(cmd::text) from pg_policies where tablename = 'reserved_handles') = array['SELECT'],
    'reserved_handles has a policy beyond its public read';
  assert exists (select 1 from public.editorial_collection_origin),
    'no collection to hang a desk-history row on: the read check below would prove nothing';
end $$;

-- ── a signed-in client ───────────────────────────────────────────────
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';

  assert not exists (select 1 from public.editorial_collection_origin),
    'a client can read the desk''s history of moved collections';
  begin
    insert into public.editorial_collection_origin (collection_id, previous_owner_id)
    values (gen_random_uuid(), '55555555-5555-5555-5555-555555555555');
    raise exception 'a client wrote desk history';
  exception when insufficient_privilege then null;
  end;
  update public.editorial_collection_origin set previous_curator_handle = 'me';
  get diagnostics n = row_count;
  assert n = 0, 'a client rewrote desk history';

  assert exists (select 1 from public.reserved_handles where handle = 'ct-closed'),
    'a signed-in client cannot check whether a handle is reserved';
  begin
    insert into public.reserved_handles (handle) values ('ct-mine');
    raise exception 'a client reserved a handle';
  exception when insufficient_privilege then null;
  end;
  delete from public.reserved_handles where handle = 'ct-closed';
  get diagnostics n = row_count;
  assert n = 0, 'a client freed a reserved handle';
  update public.reserved_handles set reason = 'mine' where handle = 'ct-closed';
  get diagnostics n = row_count;
  assert n = 0, 'a client rewrote a reserved handle';
end $$;

-- ── signed out ───────────────────────────────────────────────────────
do $$
declare n int;
begin
  set local role anon;
  assert exists (select 1 from public.reserved_handles where handle = 'ct-closed'),
    'a signed-out reader cannot check whether a handle is reserved';
  assert not exists (select 1 from public.editorial_collection_origin),
    'a signed-out reader can read the desk''s history';
  delete from public.reserved_handles where handle = 'ct-closed';
  get diagnostics n = row_count;
  assert n = 0, 'a signed-out reader freed a reserved handle';
end $$;

delete from public.editorial_collection_origin where previous_owner_id = '44444444-4444-4444-4444-444444444444';
delete from public.reserved_handles where handle in ('ct-closed', 'ct-mine');
