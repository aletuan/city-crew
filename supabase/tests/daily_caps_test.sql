-- One account, one day: the caps hold, and hold at the number they say.
--
-- Exercised, not just read off pg_policy: `rls_client` inserts as a
-- signed-in person until the policy says no, and the assertion is on
-- which row is refused. The count in each policy has to see the rows
-- written before it, so the inserts go one statement at a time — a
-- single multi-row insert cannot see its own rows and would sail past
-- any cap.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rls_client') then
    create role rls_client nologin;
  end if;
end $$;
grant usage on schema public to rls_client;
grant select, insert, update, delete on public.collections, public.collection_places,
  public.place_events, public.preferences to rls_client;
grant select on public.places to rls_client;
-- What `authenticated` holds on a real project; see trip_invites_test.
grant execute on function public.own_collection_places_today() to rls_client;

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'capped@example.com')
on conflict (id) do nothing;
insert into public.preferences (owner_id, history_on)
  values ('44444444-4444-4444-4444-444444444444', true)
on conflict (owner_id) do update set history_on = true;

-- Enough places to fill a list past the cap.
insert into public.places (slug)
  select 'cap-place-' || g from generate_series(1, 301) g
on conflict (slug) do nothing;

-- ── collections: 20 a day ────────────────────────────────────────────
do $$
declare i int; refused bool := false;
begin
  set local role rls_client;
  set local test.uid = '44444444-4444-4444-4444-444444444444';
  for i in 1..20 loop
    insert into public.collections (owner_id, is_public, slug)
    values ('44444444-4444-4444-4444-444444444444', false, 'cap-c-' || i);
  end loop;
  begin
    insert into public.collections (owner_id, is_public, slug)
    values ('44444444-4444-4444-4444-444444444444', false, 'cap-c-21');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a 21st collection in a day went through; the collections cap is not holding';
end $$;

-- ── collection_places: 300 a day, across all of one person's lists ───
-- The place ids are read as the runner before the role changes: the
-- fixture places are unpublished, so a signed-in reader cannot see them,
-- and a select-insert that matched nothing would pass every cap by
-- writing nothing.
do $$
declare i int; refused bool := false; cid uuid; pids uuid[];
begin
  select array_agg(id order by slug) into pids from public.places where slug like 'cap-place-%';
  assert cardinality(pids) = 301, format('%s fixture places, expected 301', cardinality(pids));
  set local role rls_client;
  set local test.uid = '44444444-4444-4444-4444-444444444444';
  select id into cid from public.collections where slug = 'cap-c-1';
  for i in 1..300 loop
    insert into public.collection_places (collection_id, place_id, sort_order)
    values (cid, pids[i], i);
  end loop;
  begin
    insert into public.collection_places (collection_id, place_id, sort_order)
    values (cid, pids[301], 301);
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a 301st place into one''s own lists in a day went through; the collection_places cap is not holding';
end $$;

-- ── place_events: 1000 a day ─────────────────────────────────────────
do $$
declare i int; refused bool := false; pid uuid;
begin
  select id into pid from public.places where slug = 'cap-place-1';
  set local role rls_client;
  set local test.uid = '44444444-4444-4444-4444-444444444444';
  for i in 1..1000 loop
    insert into public.place_events (user_id, place_id, kind)
    values ('44444444-4444-4444-4444-444444444444', pid, 'open');
  end loop;
  begin
    insert into public.place_events (user_id, place_id, kind)
    values ('44444444-4444-4444-4444-444444444444', pid, 'open');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a 1001st event in a day went through; the place_events cap is not holding';
end $$;

-- ── and yesterday does not count ─────────────────────────────────────
-- Age the collections past the window and the same person may make
-- another. This is the property that makes it a daily cap rather than a
-- lifetime one.
update public.collections set created_at = now() - interval '25 hours'
 where owner_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  set local role rls_client;
  set local test.uid = '44444444-4444-4444-4444-444444444444';
  insert into public.collections (owner_id, is_public, slug)
  values ('44444444-4444-4444-4444-444444444444', false, 'cap-c-tomorrow');
  reset role;
end $$;

-- Leave nothing behind for the blocks after this one.
delete from public.collections where owner_id = '44444444-4444-4444-4444-444444444444';
delete from public.place_events where user_id = '44444444-4444-4444-4444-444444444444';
delete from public.preferences where owner_id = '44444444-4444-4444-4444-444444444444';
delete from public.places where slug like 'cap-place-%';
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';

select 'all daily cap checks passed' as result;
