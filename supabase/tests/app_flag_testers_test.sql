-- app_flag_testers (20261118120000): a switch on for one account. A
-- tester reads their own rows and nobody else's; a guest reads none;
-- nobody writes through the API; a row cannot name a switch that is not
-- one; and it goes with the account or with the switch.

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f1a90000-0000-0000-0000-00000000000a', 'ft-tester@x.com', '{"handle":"fttester"}'),
 ('f1a90000-0000-0000-0000-00000000000b', 'ft-other@x.com',  '{"handle":"ftother"}'),
 ('f1a90000-0000-0000-0000-00000000000c', 'ft-plain@x.com',  '{"handle":"ftplain"}');

-- The switch the table was made for has its row, and ships off.
do $$
declare seeded bool;
begin
  select enabled into seeded from public.app_flags where key = 'comments';
  assert seeded is false, format('comments must be seeded off, found %s', seeded);
end $$;

-- Added as the desk adds them: in SQL, not through the API.
insert into public.app_flags (key, enabled) values ('_ft_probe', false);
insert into public.app_flag_testers (key, user_id) values
 ('comments',  'f1a90000-0000-0000-0000-00000000000a'),
 ('_ft_probe', 'f1a90000-0000-0000-0000-00000000000a'),
 ('comments',  'f1a90000-0000-0000-0000-00000000000b');

-- ── a tester reads their own, and only their own ──
do $$
declare mine text; n int;
begin
  set local role rls_client;
  set local test.uid = 'f1a90000-0000-0000-0000-00000000000a';
  select string_agg(key, ',' order by key), count(*) into mine, n from public.app_flag_testers;
  assert mine = '_ft_probe,comments', format('the tester reads: %s', mine);
  set local test.uid = 'f1a90000-0000-0000-0000-00000000000b';
  select string_agg(key, ',' order by key) into mine from public.app_flag_testers;
  assert mine = 'comments', format('the other tester reads: %s', mine);
  set local test.uid = 'f1a90000-0000-0000-0000-00000000000c';
  select count(*) into n from public.app_flag_testers;
  assert n = 0, format('somebody who tests nothing reads %s rows', n);
  reset role;
end $$;

-- ── a guest reads none, and is told so rather than shown an empty list ──
do $$
declare refused boolean := false;
begin
  set local role anon;
  set local test.uid = '';
  begin
    perform 1 from public.app_flag_testers;
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a guest read the testers';
end $$;

-- ── nobody writes through the API: not a row for themselves, not a change, not a removal ──
do $$
declare refused int := 0; n int;
begin
  set local role rls_client;
  set local test.uid = 'f1a90000-0000-0000-0000-00000000000c';
  begin
    insert into public.app_flag_testers (key, user_id) values ('comments', 'f1a90000-0000-0000-0000-00000000000c');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  set local test.uid = 'f1a90000-0000-0000-0000-00000000000a';
  begin
    update public.app_flag_testers set key = 'photo_attribution' where user_id = 'f1a90000-0000-0000-0000-00000000000a';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    delete from public.app_flag_testers where user_id = 'f1a90000-0000-0000-0000-00000000000a';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert refused = 3, format('%s of 3 writes through the API were refused', refused);
  select count(*) into n from public.app_flag_testers;
  assert n = 3, format('%s rows stand after the refused writes, 3 were there', n);
end $$;

-- ── a row cannot name a switch that is not one, nor one account twice ──
do $$
declare refused int := 0;
begin
  begin
    insert into public.app_flag_testers (key, user_id) values ('comets', 'f1a90000-0000-0000-0000-00000000000c');
  exception when foreign_key_violation then refused := refused + 1;
  end;
  begin
    insert into public.app_flag_testers (key, user_id) values ('comments', 'f1a90000-0000-0000-0000-00000000000a');
  exception when unique_violation then refused := refused + 1;
  end;
  assert refused = 2, format('%s of 2 bad rows were refused', refused);
end $$;

-- ── it goes with the switch, and with the account ──
delete from public.app_flags where key = '_ft_probe';
delete from auth.users where id = 'f1a90000-0000-0000-0000-00000000000b';
do $$
declare left_ text;
begin
  select string_agg(key || ':' || right(user_id::text, 1), ',' order by key) into left_ from public.app_flag_testers;
  assert left_ = 'comments:a', format('after the switch and the account went: %s', left_);
end $$;

delete from auth.users where email in ('ft-tester@x.com', 'ft-plain@x.com');
do $$
begin
  assert (select count(*) from public.app_flag_testers) = 0, 'a tester row outlived every account';
end $$;

select 'all flag tester checks passed' as result;
