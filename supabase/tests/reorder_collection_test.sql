-- Ordering your own list, exercised from the outside.
--
-- Owners had no UPDATE policy on `collection_places`, so the app's
-- per-row updates matched nothing and reported success. The function is
-- the one way in now, and it is walked through as each kind of caller:
--
--   1111…  the owner of `ord-mine`
--   2222…  another reader, who owns nothing here
--   9999…  an editor, for the desk's own hand
--   (nobody) a guest

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.collections, public.collection_places to rls_client;
grant select on public.places to rls_client;

create or replace function pg_temp.order_of(slug text) returns text language sql as $$
  select string_agg(p.slug, ',' order by cp.sort_order)
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    join public.places p on p.id = cp.place_id
   where c.slug = order_of.slug
$$;

-- ── the ties the migration found ──
do $$
declare positions int[];
begin
  select array_agg(sort_order order by sort_order) into positions
    from public.collection_places where collection_id = 'e7000000-0000-0000-0000-0000000000c2';
  assert positions = array[0, 1, 2], format('a tied list was not settled: %s', positions);
  assert pg_temp.order_of('ord-tied') = 'ord-a,ord-b,ord-c', format('settling changed the order: %s', pg_temp.order_of('ord-tied'));
  select array_agg(sort_order order by sort_order) into positions
    from public.collection_places where collection_id = 'e7000000-0000-0000-0000-0000000000c3';
  assert positions = array[0, 5], format('a list with no tie was renumbered: %s', positions);
end $$;

-- ── the owner, whose updates used to match nothing ──
do $$
declare direct int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  -- What the app did before: a plain update, row security in the way.
  update public.collection_places set sort_order = 9
   where collection_id = 'e7000000-0000-0000-0000-0000000000c1';
  get diagnostics direct = row_count;
  perform public.reorder_collection('ord-mine', array['ord-c', 'ord-a', 'ord-b']);
  reset role;
  assert direct = 0, format('an owner updated membership rows directly (%s rows): the function is meant to be the only way', direct);
  assert pg_temp.order_of('ord-mine') = 'ord-c,ord-a,ord-b', format('owner reorder came out %s', pg_temp.order_of('ord-mine'));
end $$;

-- Positions are 0..n-1, whatever they were before.
do $$
declare positions int[];
begin
  select array_agg(sort_order order by sort_order) into positions
    from public.collection_places where collection_id = 'e7000000-0000-0000-0000-0000000000c1';
  assert positions = array[0, 1, 2], format('positions after a reorder: %s', positions);
end $$;

-- ── a member the caller did not name, a stranger slug, a repeat ──
do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  -- `ord-b` is left out (another device added it mid-arrange), `ord-d` is
  -- not a member, and `ord-a` is named twice.
  perform public.reorder_collection('ord-mine', array['ord-a', 'ord-d', 'ord-c', 'ord-a']);
  reset role;
  assert pg_temp.order_of('ord-mine') = 'ord-a,ord-c,ord-b',
    format('unnamed member, non-member and repeat came out %s', pg_temp.order_of('ord-mine'));
  assert (select count(*) from public.collection_places where collection_id = 'e7000000-0000-0000-0000-0000000000c1') = 3,
    'a reorder added or dropped a member';
end $$;

-- ── somebody else ──
do $$
declare refused boolean := false;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  begin
    perform public.reorder_collection('ord-mine', array['ord-b', 'ord-c', 'ord-a']);
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'another reader reordered a list that is not theirs';
  assert pg_temp.order_of('ord-mine') = 'ord-a,ord-c,ord-b', 'a refused reorder still changed the list';
end $$;

-- A list that does not exist is refused the same way: no hint either way.
do $$
declare refused boolean := false;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  begin
    perform public.reorder_collection('ord-nowhere', array['ord-a']);
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a missing list was not refused';
end $$;

-- ── the desk ──
insert into auth.users (id, email, raw_user_meta_data)
values ('99999999-9999-9999-9999-999999999999', 'desk@ord.test', '{}')
on conflict do nothing;
insert into public.editors (email) values ('desk@ord.test') on conflict do nothing;
do $$
begin
  set local role rls_client;
  set local test.uid = '99999999-9999-9999-9999-999999999999';
  set local test.jwt = '{"email": "desk@ord.test"}';
  perform public.reorder_collection('ord-mine', array['ord-b', 'ord-a', 'ord-c']);
  reset role;
  assert pg_temp.order_of('ord-mine') = 'ord-b,ord-a,ord-c', format('editor reorder came out %s', pg_temp.order_of('ord-mine'));
end $$;

-- ── who may call it at all ──
do $$
begin
  assert not has_function_privilege('anon', 'public.reorder_collection(text, text[])', 'execute'),
    'a guest can call reorder_collection';
  assert has_function_privilege('authenticated', 'public.reorder_collection(text, text[])', 'execute'),
    'a signed-in reader cannot call reorder_collection';
  assert exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reorder_collection'
       and 'search_path=""' = any (p.proconfig)
  ), 'reorder_collection does not pin an empty search path';
end $$;

select 'all reorder collection checks passed' as result;
