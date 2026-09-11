-- `profiles` is the only home for a person's public identity: sign-up's
-- metadata hands it over and is cleaned, and a later write of the user row
-- — the one GoTrue makes after its insert — cannot put it back.

insert into auth.users (id, email, raw_user_meta_data) values
 ('d6000000-0000-0000-0000-00000000000a', 'meta6@x.com',
  '{"handle":"meta6","full_name":"Meta Six","bio":"Hi","email":"meta6@x.com","email_verified":true}');

do $$
declare m jsonb; p record;
begin
  select raw_user_meta_data into m from auth.users where id = 'd6000000-0000-0000-0000-00000000000a';
  select handle, full_name, bio into p from public.profiles where id = 'd6000000-0000-0000-0000-00000000000a';
  assert p.handle = 'meta6' and p.full_name = 'Meta Six' and p.bio = 'Hi', 'the profile did not get the sign-up values';
  assert not (m ?| array['handle', 'full_name', 'bio', 'location', 'interests', 'avatar_url']),
    format('profile keys left in the metadata after sign-up: %s', m);
  assert m->>'email' = 'meta6@x.com' and (m->>'email_verified')::boolean, 'other metadata was removed with them';
end $$;

-- GoTrue writing its in-memory copy back, the write that undid the strip —
-- as a plain role with UPDATE on the table and nothing else, the way
-- GoTrue's own role writes on a real project. A superuser would pass even
-- if the trigger could not call its helper, and every sign-in on
-- production would fail.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'auth_writer') then
    create role auth_writer nologin;
  end if;
end $$;
grant usage on schema auth to auth_writer;
grant select, update on auth.users to auth_writer;
set role auth_writer;
update auth.users
   set raw_user_meta_data = '{"handle":"meta6","full_name":"Meta Six","email":"meta6@x.com","email_verified":true}'
 where id = 'd6000000-0000-0000-0000-00000000000a';
reset role;

do $$
declare m jsonb;
begin
  select raw_user_meta_data into m from auth.users where id = 'd6000000-0000-0000-0000-00000000000a';
  assert not (m ?| array['handle', 'full_name']), format('a later write put the name back: %s', m);
  assert m->>'email' = 'meta6@x.com', 'a later write lost the rest of the metadata';
end $$;

-- A write with nothing to strip goes through as written.
update auth.users set raw_user_meta_data = '{"email":"meta6@x.com","locale":"vi"}'
 where id = 'd6000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select raw_user_meta_data from auth.users where id = 'd6000000-0000-0000-0000-00000000000a')
    = '{"email":"meta6@x.com","locale":"vi"}'::jsonb, 'unrelated metadata was changed';
end $$;

do $$
begin
  assert to_regclass('public._metadata_backup') is null, 'the metadata backup table is still there';
  assert not has_function_privilege('anon', 'public.strip_profile_metadata(jsonb)', 'execute'), 'anon can call the strip helper';
end $$;

delete from auth.users where id = 'd6000000-0000-0000-0000-00000000000a';

select 'all profile metadata checks passed' as result;
