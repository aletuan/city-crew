-- Search synonyms are read by everyone and written by the desk alone.
--
-- `category_terms` was the one table with an editors' write policy that no
-- test had tried as a client (found 22 Nov 2026): the stub in
-- `_collections.sql` built the table without its migration, because the
-- policy calls `is_editor()`, which the harness could not run then. It can
-- now — the "rls, exercised" block applies `mobile_editor_auth` — so this
-- file applies the real migration's RLS on top of the stub (its `create
-- table if not exists` leaves the stub's columns alone; only the policies
-- and the switch land) and sits a client at it, as `editor_gallery_test`
-- does: `test.uid` for who asks, `test.jwt` for the email `is_editor()`
-- reads.
--
--   7777…  an editor
--   5555…  signed in, nobody in particular

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.category_terms to rls_client;
-- What Supabase grants every table by default; the policies decide the rest.
grant select on public.category_terms to anon;

insert into public.editors (email) values ('terms@ct.test') on conflict do nothing;
insert into public.category_terms (key, terms) values ('ct-seed', '{phở}') on conflict do nothing;

do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.category_terms'::regclass),
    'category_terms has RLS off';
end $$;

-- ── anyone reads ─────────────────────────────────────────────────────
do $$
begin
  set local role anon;
  assert exists (select 1 from public.category_terms where key = 'ct-seed'),
    'a signed-out reader cannot read the synonyms search runs on';
end $$;

-- ── somebody signed in, not on the desk, writes nothing ──────────────
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  set local test.jwt = '{"email": "someone@ct.test"}';

  assert exists (select 1 from public.category_terms where key = 'ct-seed'),
    'a signed-in reader cannot read the synonyms';

  begin
    insert into public.category_terms (key, terms) values ('ct-mine', '{x}');
    raise exception 'a non-editor added a synonym row';
  exception when insufficient_privilege then null;
  end;

  update public.category_terms set terms = '{defaced}' where key = 'ct-seed';
  get diagnostics n = row_count;
  assert n = 0, 'a non-editor rewrote a synonym row';

  delete from public.category_terms where key = 'ct-seed';
  get diagnostics n = row_count;
  assert n = 0, 'a non-editor deleted a synonym row';
end $$;

-- ── the desk writes all three ways ───────────────────────────────────
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '77777777-7777-7777-7777-777777777777';
  set local test.jwt = '{"email": "terms@ct.test"}';

  insert into public.category_terms (key, terms) values ('ct-desk', '{cinema}');
  update public.category_terms set terms = '{phở, pho}' where key = 'ct-seed';
  get diagnostics n = row_count;
  assert n = 1, 'an editor could not edit a synonym row';
  delete from public.category_terms where key = 'ct-desk';
  get diagnostics n = row_count;
  assert n = 1, 'an editor could not delete a synonym row';
end $$;

do $$
begin
  assert (select terms from public.category_terms where key = 'ct-seed') = '{phở, pho}',
    'the editor''s edit did not land';
end $$;

delete from public.category_terms where key in ('ct-seed', 'ct-desk', 'ct-mine');
delete from public.editors where email = 'terms@ct.test';
