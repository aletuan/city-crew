-- A list made public from the start (20 Nov 2026): allowed now, stamped
-- with its owner's handle on that first row, and still only ever made as
-- yourself. `collections_rls_test` asserts the refusal this replaces; it
-- runs before this migration and keeps the history of it.

grant usage on schema public to rls_client;
grant select, insert on public.collections to rls_client;
grant execute on function public.own_collections_today() to rls_client;

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'born-public@example.com')
on conflict (id) do nothing;
update public.profiles set handle = 'bornpublic'
  where id = '55555555-5555-5555-5555-555555555555';
insert into public.profiles (id, handle)
  select '55555555-5555-5555-5555-555555555555', 'bornpublic'
  where not exists (select 1 from public.profiles where id = '55555555-5555-5555-5555-555555555555');

do $$
declare refused_owner bool := false; pub bool; handle text; nobody int;
begin
  set local role rls_client;
  set local test.uid = '55555555-5555-5555-5555-555555555555';
  insert into public.collections (slug, city_id, owner_id, is_public)
  values ('born-public', 'hanoi', '55555555-5555-5555-5555-555555555555', true);
  begin
    insert into public.collections (slug, city_id, owner_id, is_public)
    values ('born-public-forged', 'hanoi', '22222222-2222-2222-2222-222222222222', true);
  exception when insufficient_privilege then refused_owner := true;
  end;
  reset role;

  select c.is_public, c.curator_handle into pub, handle
  from public.collections c where c.slug = 'born-public';
  -- A signed-out reader sees it: public is public from the first row.
  set local role rls_client;
  set local test.uid = '';
  select count(*) into nobody from public.collections where slug = 'born-public';
  reset role;

  assert pub, 'a list could not be made public from the start';
  assert handle = 'bornpublic', format('a list born public was stamped %L, not its owner''s handle', handle);
  assert nobody = 1, 'a list born public is not readable by everyone';
  assert refused_owner, 'a client made a list owned by somebody else';
end $$;

-- The daily cap survived the rewrite: the policy still counts.
do $$
declare chk text;
begin
  select pg_get_expr(polwithcheck, polrelid) into chk
  from pg_policy where polname = 'owners insert their collections';
  assert chk like '%own_collections_today()%' and chk like '%< 20%',
    'the insert policy lost its daily cap';
  assert chk not like '%is_public%', 'the insert policy still pins is_public';
end $$;

delete from public.collections where slug = 'born-public';
