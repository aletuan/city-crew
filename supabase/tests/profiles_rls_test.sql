-- profiles, as a client sees them: everyone reads, only you write yours,
-- and nobody makes one by hand. Then the avatar bucket, which is the
-- profile's picture: your folder, sixty seconds apart.
--
-- Exercised, not read off pg_policy. `profiles_test.sql` checks the
-- policies exist; this checks they hold, by sitting `rls_client` at the
-- table as one person and then another.

grant usage on schema public, storage to rls_client;
grant select, insert, update, delete on public.profiles to rls_client;
grant select, insert, update, delete on storage.objects to rls_client;

-- ── reading ──────────────────────────────────────────────────────────
-- A profile is public: the byline on a published list, the face in a
-- crew. Signed in or not, all of them are readable.
do $$
declare seen int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  select count(*) into seen from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  reset role;
  assert seen = 2, format('a signed-in reader sees %s of 2 profiles', seen);
end $$;

do $$
declare seen int;
begin
  set local role rls_client;
  set local test.uid = '';
  select count(*) into seen from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  reset role;
  assert seen = 2, format('a signed-out reader sees %s of 2 profiles', seen);
end $$;

-- ── writing ──────────────────────────────────────────────────────────
-- Yours to change. An update to somebody else's row is not refused, it
-- simply finds no row — which is what RLS does with a select-side miss,
-- and is why the assertion is on the count.
do $$
declare mine int; theirs int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (
    update public.profiles set bio = 'Coffee, still' where id = '11111111-1111-1111-1111-111111111111' returning 1
  ) select count(*) into mine from u;
  with u as (
    update public.profiles set bio = 'not yours' where id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into theirs from u;
  reset role;
  assert mine = 1, 'a person could not edit their own profile';
  assert theirs = 0, 'a person edited somebody else''s profile';
end $$;

-- The row was never touched.
do $$
declare b text;
begin
  select bio into b from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  assert b <> 'not yours', 'the other profile carries the stranger''s words';
end $$;

-- No insert policy, on purpose: rows come from the sign-up trigger, so
-- the only way to get a profile is to have an account.
do $$
declare refused bool := false;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  begin
    insert into public.profiles (id, handle) values ('11111111-1111-1111-1111-111111111111', 'byhand');
  exception when insufficient_privilege or unique_violation then refused := true;
  end;
  reset role;
  assert refused, 'a client inserted a profile row by hand';
end $$;

-- Signed out, nothing writes.
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '';
  with u as (
    update public.profiles set bio = 'anon' where id = '11111111-1111-1111-1111-111111111111' returning 1
  ) select count(*) into n from u;
  reset role;
  assert n = 0, 'a signed-out client edited a profile';
end $$;

-- ── the avatar ───────────────────────────────────────────────────────
-- One object per person, in a folder named after them. Your folder is
-- yours to write; anybody else's is a wall.
do $$
declare refused bool := false;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.jpg', '11111111-1111-1111-1111-111111111111');
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.jpg', '11111111-1111-1111-1111-111111111111');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a person wrote into somebody else''s avatar folder';
end $$;

-- A second face inside a minute is refused; after a minute it is fine;
-- somebody else's face is never yours to replace.
do $$
declare soon int; later int; theirs int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (
    update storage.objects set metadata = '{"try": 1}'
     where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg' returning 1
  ) select count(*) into soon from u;
  reset role;

  update storage.objects set updated_at = now() - interval '2 minutes'
   where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg';

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with u as (
    update storage.objects set metadata = '{"try": 2}'
     where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg' returning 1
  ) select count(*) into later from u;
  reset role;

  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (
    update storage.objects set metadata = '{"try": 3}'
     where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg' returning 1
  ) select count(*) into theirs from u;
  reset role;

  assert soon = 0, 'a second avatar inside a minute went through; the cooldown is not holding';
  assert later = 1, 'an avatar could not be changed after the minute passed';
  assert theirs = 0, 'somebody replaced another person''s avatar';
end $$;

-- Anyone may look; only the owner may take it down.
do $$
declare seen int; gone_by_other int; gone int;
begin
  set local role rls_client;
  set local test.uid = '';
  select count(*) into seen from storage.objects where bucket_id = 'avatars';
  reset role;

  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with d as (
    delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/avatar.jpg' returning 1
  ) select count(*) into gone_by_other from d;
  reset role;

  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with d as (
    delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/avatar.jpg' returning 1
  ) select count(*) into gone from d;
  reset role;

  assert seen >= 1, 'an avatar is not publicly readable';
  assert gone_by_other = 0, 'somebody deleted another person''s avatar';
  assert gone = 1, 'a person could not delete their own avatar';
end $$;

-- Two names a person, no more (`avatars_two_names.sql`): the face and
-- the wall go in; any other name, a subfolder, or a rename out of one of
-- the two is refused, in the person's own folder too.
do $$
declare
  me constant text := '11111111-1111-1111-1111-111111111111';
  why text; wrote int; renamed int; refused int := 0; mime text[];
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into storage.objects (bucket_id, name, owner) values ('avatars', me || '/avatar.jpg', me::uuid);
  insert into storage.objects (bucket_id, name, owner) values ('avatars', me || '/wall.jpg', me::uuid);
  get diagnostics wrote = row_count;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', me || '/movie.jpg', me::uuid);
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', me || '/x/avatar.jpg', me::uuid);
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', me || '/avatar.png', me::uuid);
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;
  assert wrote = 1, 'the wall could not be written';
  assert refused = 3, format('a third name, a subfolder and another extension are refused, %s were', refused);

  -- A minute on, the face may be replaced, but not renamed into a third file.
  update storage.objects set updated_at = now() - interval '2 minutes' where bucket_id = 'avatars' and name like me || '/%';
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  begin
    with u as (
      update storage.objects set name = me || '/hosted.jpg'
       where bucket_id = 'avatars' and name = me || '/avatar.jpg' returning 1
    ) select count(*) into renamed from u;
  exception when insufficient_privilege then renamed := -1;
  end;
  reset role;
  assert renamed <> 1, 'an avatar was renamed into a third file';

  select allowed_mime_types into mime from storage.buckets where id = 'avatars';
  assert mime = array['image/jpeg'], format('the bucket takes JPEG alone, took %s', mime);

  delete from storage.objects where bucket_id = 'avatars' and name like me || '/%';
end $$;

update public.profiles set bio = 'Coffee' where id = '11111111-1111-1111-1111-111111111111';

select 'all profile RLS checks passed' as result;
