-- The mark a person wears on their page (`20261116200000_role_of`).
--
-- The cast: Ed, on the desk's list; Gia, a guide of one city; Gus, a
-- guide of every city; Both, an editor who is also a guide; Rae, a
-- reader with neither; Blok, a guide who has blocked Rae; and Shun, a
-- guide Rae has blocked.

grant usage on schema public to rls_client, anon;

insert into public.cities (id) values ('hanoi') on conflict do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f9000000-0000-0000-0000-00000000000e', 'Ro-Ed@x.com',   '{"handle":"roed"}'),
 ('f9000000-0000-0000-0000-00000000000a', 'ro-gia@x.com',  '{"handle":"rogia"}'),
 ('f9000000-0000-0000-0000-00000000000b', 'ro-gus@x.com',  '{"handle":"rogus"}'),
 ('f9000000-0000-0000-0000-00000000000c', 'ro-both@x.com', '{"handle":"roboth"}'),
 ('f9000000-0000-0000-0000-00000000000d', 'ro-rae@x.com',  '{"handle":"rorae"}'),
 ('f9000000-0000-0000-0000-000000000001', 'ro-blok@x.com', '{"handle":"roblok"}'),
 ('f9000000-0000-0000-0000-000000000002', 'ro-shun@x.com', '{"handle":"roshun"}');

-- The desk's list is lower case; Ed's account was made with capitals.
insert into public.editors (email) values ('ro-ed@x.com'), ('ro-both@x.com');

insert into public.local_guides (user_id, city_id) values
 ('f9000000-0000-0000-0000-00000000000a', 'hanoi'),
 ('f9000000-0000-0000-0000-00000000000c', 'hanoi'),
 ('f9000000-0000-0000-0000-000000000001', 'hanoi'),
 ('f9000000-0000-0000-0000-000000000002', 'hanoi');
insert into public.local_guides (user_id) values ('f9000000-0000-0000-0000-00000000000b');

insert into public.blocks (blocker, blocked) values
 ('f9000000-0000-0000-0000-000000000001', 'f9000000-0000-0000-0000-00000000000d'),
 ('f9000000-0000-0000-0000-00000000000d', 'f9000000-0000-0000-0000-000000000002');

-- ── a reader is told each person's mark ──
do $$
begin
  perform set_config('test.uid', 'f9000000-0000-0000-0000-00000000000d', true);
  set local role rls_client;
  assert public.role_of('f9000000-0000-0000-0000-00000000000e') = 'editor', 'an editor, whatever the case of the account''s email';
  assert public.role_of('f9000000-0000-0000-0000-00000000000a') = 'guide', 'a guide of one city';
  assert public.role_of('f9000000-0000-0000-0000-00000000000b') = 'guide', 'a guide of every city';
  assert public.role_of('f9000000-0000-0000-0000-00000000000c') = 'editor', 'editor outranks guide';
  -- A reader with neither, asked about by themselves and so about anybody.
  assert public.role_of('f9000000-0000-0000-0000-00000000000d') is null, 'a reader wears no mark';
  assert public.role_of(null) is null, 'nobody wears no mark';
  assert public.role_of('f9000000-0000-0000-0000-0000000000ff') is null, 'an account that is not there wears no mark';
  -- Nothing across a block, either way.
  assert public.role_of('f9000000-0000-0000-0000-000000000001') is null, 'a guide who blocked the reader is not vouched for to them';
  assert public.role_of('f9000000-0000-0000-0000-000000000002') is null, 'nor a guide the reader blocked';
  reset role;
end $$;

-- ── and their own, which their own page draws ──
do $$
begin
  perform set_config('test.uid', 'f9000000-0000-0000-0000-00000000000a', true);
  set local role rls_client;
  assert public.role_of('f9000000-0000-0000-0000-00000000000a') = 'guide', 'a guide asked about themselves';
  -- A block is between two people: Blok is still a guide to Gia.
  assert public.role_of('f9000000-0000-0000-0000-000000000001') = 'guide', 'a block hides the mark only from the two it is between';
  reset role;
end $$;

-- ── the word is all that leaves ──
do $$
declare shape text;
begin
  select pg_get_function_result('public.role_of(uuid)'::regprocedure) into shape;
  assert shape = 'text', format('role_of answers a word, not a row: %s', shape);
end $$;

-- ── nobody signed out is told ──
do $$
declare told boolean := true;
begin
  set local role anon;
  begin
    perform public.role_of('f9000000-0000-0000-0000-00000000000e');
  exception when insufficient_privilege then told := false;
  end;
  reset role;
  assert not told, 'anon can execute role_of';
end $$;

-- A caller with the grant and no account — the function's own guard.
do $$
begin
  perform set_config('test.uid', '', true);
  set local role rls_client;
  assert public.role_of('f9000000-0000-0000-0000-00000000000e') is null, 'no account, no answer';
  reset role;
end $$;

select 'all role-of checks passed';
