-- Cover reviews: an editor answers and answers again; nobody else reads
-- or writes; the answer outlives a deleted photograph and goes with its
-- place.
--
-- Its own two accounts, so it depends on no other block's: an editor
-- (c7c7…01, cr-editor@cr.test) and a local guide (c7c7…02) who submitted
-- the place — so may set its cover from the app — and still may not
-- answer here.

grant select, insert, update, delete on public.cover_reviews to rls_client;
-- The stamp trigger names `auth.uid()` from PL/pgSQL, which looks the
-- schema up when it runs — a policy's call was resolved when the policy
-- was made, and needs no such grant. A real project grants `authenticated`
-- usage on `auth`; this mirrors it for the file, and takes it back at the
-- end so no later block passes on it.
grant usage on schema auth to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
  ('c7c7c7c7-0000-0000-0000-000000000001', 'cr-editor@cr.test', '{}'),
  ('c7c7c7c7-0000-0000-0000-000000000002', 'cr-guide@cr.test', '{}')
on conflict do nothing;
insert into public.editors (email) values ('cr-editor@cr.test') on conflict do nothing;
insert into public.local_guides (user_id) values ('c7c7c7c7-0000-0000-0000-000000000002') on conflict do nothing;

insert into public.places (id, slug, city_id, is_published, review_status, submitted_by)
values ('c7000000-0000-0000-0000-000000000001', 'cr-place', 'hue', true, 'approved',
        'c7c7c7c7-0000-0000-0000-000000000002')
on conflict (slug) do nothing;
insert into public.place_photos (id, place_id, photo_uri, sort_order, source, is_cover)
values
  ('c7000000-0000-0000-0000-0000000000a1', 'c7000000-0000-0000-0000-000000000001', 'cr/menu', 0, 'google', true),
  ('c7000000-0000-0000-0000-0000000000a2', 'c7000000-0000-0000-0000-000000000001', 'cr/front', 1, 'google', false)
on conflict do nothing;

do $$
declare refused bool;
begin
  set local role rls_client;

  -- The editor keeps the cover, then changes its mind: one row, the
  -- latest answer, stamped with who gave it.
  set local test.uid = 'c7c7c7c7-0000-0000-0000-000000000001';
  set local test.jwt = '{"email": "cr-editor@cr.test"}';
  insert into public.cover_reviews (place_id, cover_photo_id, suggested_photo_id, decision)
  values ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-0000000000a1',
          'c7000000-0000-0000-0000-0000000000a2', 'kept');
  insert into public.cover_reviews (place_id, cover_photo_id, suggested_photo_id, decision)
  values ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-0000000000a1',
          'c7000000-0000-0000-0000-0000000000a2', 'changed')
  on conflict (place_id) do update set decision = excluded.decision, decided_at = now();
  assert (select count(*) from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001') = 1,
    'answering again added a row instead of replacing the answer';
  assert (select decision from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001') = 'changed',
    'the second answer did not replace the first';
  assert (select decided_by from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001')
         = 'c7c7c7c7-0000-0000-0000-000000000001',
    'the answer is not stamped with the editor who gave it';

  -- An answer is one of the two; anything else is refused.
  refused := false;
  begin
    update public.cover_reviews set decision = 'maybe' where place_id = 'c7000000-0000-0000-0000-000000000001';
  exception when check_violation then refused := true;
  end;
  assert refused, 'a decision other than changed or kept was stored';

  -- An editor cannot sign an answer with somebody else's name: the
  -- database stamps whoever is writing.
  update public.cover_reviews set decided_by = 'c7c7c7c7-0000-0000-0000-000000000002'
  where place_id = 'c7000000-0000-0000-0000-000000000001';
  assert (select decided_by from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001')
         = 'c7c7c7c7-0000-0000-0000-000000000001',
    'an answer was put in another account''s name';

  -- A local guide — who may set this place's cover in the app — sees no
  -- answer and gives none: this is the desk's queue.
  set local test.uid = 'c7c7c7c7-0000-0000-0000-000000000002';
  set local test.jwt = '';
  assert (select count(*) from public.cover_reviews) = 0, 'a guide can read the desk''s answers';
  refused := false;
  begin
    insert into public.cover_reviews (place_id, decision)
    values ('c7000000-0000-0000-0000-000000000001', 'kept')
    on conflict (place_id) do update set decision = excluded.decision;
  exception when insufficient_privilege then refused := true;
  end;
  assert refused, 'a guide answered a cover review';

  -- Nor does anybody signed out, who holds no grant at all.
  reset role;
end $$;

-- `anon` holds nothing on the table, so a signed-out read is refused
-- before any policy is asked.
do $$
begin
  assert not has_table_privilege('anon', 'public.cover_reviews', 'select'),
    'signed-out readers were granted the desk''s answers';
  assert not has_table_privilege('authenticated', 'public.cover_reviews', 'delete'),
    'answers can be deleted from a client';
end $$;

-- A deleted photograph leaves the answer in place, with a null where it
-- was; a deleted place takes the answer with it.
delete from public.place_photos where id = 'c7000000-0000-0000-0000-0000000000a2';
do $$
begin
  assert (select suggested_photo_id from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001') is null,
    'deleting the suggested photograph did not clear it from the answer';
  assert exists (select 1 from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001'),
    'deleting a photograph took the answer with it';
end $$;
delete from public.places where slug = 'cr-place';
do $$
begin
  assert not exists (select 1 from public.cover_reviews where place_id = 'c7000000-0000-0000-0000-000000000001'),
    'deleting the place left its answer behind';
end $$;

revoke usage on schema auth from rls_client;
