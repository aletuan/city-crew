-- Integration test for 20260815000000_profiles.sql.
--
-- Run against a throwaway Postgres with `_harness.sql` loaded and the
-- migration applied — see run.sh. Every check raises rather than
-- reporting, so a silent pass is the only pass.
--
-- What this covers is the SQL: the trigger, the backfill, the
-- constraints, the reserved list. What it cannot cover is RLS as a real
-- client meets it, because the harness has no PostgREST and no JWT — the
-- policies are asserted to exist, not to hold.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------- backfill

do $$
declare n_users int; n_profiles int;
begin
  select count(*) into n_users from auth.users;
  select count(*) into n_profiles from public.profiles;
  assert n_users = n_profiles,
    format('every account needs a profile: %s users, %s profiles', n_users, n_profiles);
end $$;

do $$
declare p record;
begin
  select * into p from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  assert p.full_name = 'Tuan Anh Le', 'name did not carry over';
  assert p.location  = 'Hanoi',       'location did not carry over';
  assert p.bio       = 'Coffee',      'bio did not carry over';
  assert p.interests = 'Cafe',        'interests did not carry over';
end $$;

-- A generated handle has to be recognisable as one nobody chose.
do $$
declare bad int;
begin
  select count(*) into bad from public.profiles where handle !~ '^user[0-9a-f]{8}$';
  assert bad = 0, format('%s backfilled handles are not placeholders', bad);
end $$;

-- ------------------------------------------------------- metadata is gone

do $$
declare leftovers int;
begin
  select count(*) into leftovers from auth.users
   where raw_user_meta_data ?| array['handle','full_name','bio','location','interests','avatar_url'];
  assert leftovers = 0,
    format('%s accounts still carry a second copy of their profile', leftovers);
end $$;

-- --------------------------------------------------------- handle at signup

do $$
declare got text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-000000000001','new@x.com',
          '{"full_name":"Asked For It","handle":"chosen_one"}');
  select handle into got from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert got = 'chosen_one', format('a free handle should be granted, got %s', got);
end $$;

-- Losing the race must not fail the account into existence half-formed.
do $$
declare got text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-000000000002','dup@x.com','{"handle":"chosen_one"}');
  select handle into got from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert got ~ '^user[0-9a-f]{8}$', format('a taken handle should fall back, got %s', got);
end $$;

-- The whole point of the reserved list: nobody signs up as the house.
do $$
declare got text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-000000000003','imp@x.com','{"handle":"hanoicrew"}');
  select handle into got from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  assert got <> 'hanoicrew', 'an editorial handle was handed out at sign-up';
  assert got ~ '^user[0-9a-f]{8}$', format('reserved should fall back, got %s', got);
end $$;

-- A handle that could never satisfy the constraint must not reach it.
do $$
declare got text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values ('aaaaaaaa-0000-0000-0000-000000000004','bad@x.com','{"handle":"no spaces!"}');
  select handle into got from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  assert got ~ '^user[0-9a-f]{8}$', format('a malformed handle should fall back, got %s', got);
end $$;

-- ------------------------------------------------------------ constraints

-- Without lower(), impersonation costs one shift key.
do $$
begin
  begin
    update public.profiles set handle = 'CHOSEN_ONE'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    assert false, 'a handle differing only in case was allowed';
  exception when unique_violation then null;
  end;
end $$;

do $$
begin
  begin
    update public.profiles set handle = 'saigonnights'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    assert false, 'a reserved handle was allowed on update';
  exception when check_violation then null;
  end;
end $$;

do $$
begin
  begin
    update public.profiles set handle = 'ab'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    assert false, 'a two-character handle was allowed';
  exception when check_violation then null;
  end;
end $$;

do $$
begin
  begin
    update public.profiles set handle = 'has-a-dash'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    assert false, 'a handle with a dash was allowed';
  exception when check_violation then null;
  end;
end $$;

-- Stored lower case so the row and the URL agree without normalising at
-- every call site.
do $$
declare got text;
begin
  update public.profiles set handle = '  MixedCase  '
   where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  select handle into got from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert got = 'mixedcase', format('handle should be normalised, got "%s"', got);
end $$;

-- ------------------------------------------------------------------ RLS

do $$
declare on_ boolean; n_policies int;
begin
  select relrowsecurity into on_ from pg_class where oid = 'public.profiles'::regclass;
  assert on_, 'row level security is off on profiles';
  select count(*) into n_policies from pg_policies
   where schemaname = 'public' and tablename = 'profiles';
  assert n_policies = 2, format('expected a read and a write policy, found %s', n_policies);
end $$;

-- Deleting the account takes the profile with it; an orphan profile is a
-- name with nobody behind it.
do $$
declare left_ int;
begin
  delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  select count(*) into left_ from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  assert left_ = 0, 'a profile outlived its account';
end $$;

select 'all profile migration checks passed' as result;
