-- Enough of Supabase's auth schema to run a migration against a bare
-- Postgres. Not a simulation of GoTrue — just the two things our SQL
-- touches: the users table it triggers on, and the uid() the policies
-- call.
-- The roles PostgREST connects as. They exist on a real project; here
-- they matter because EXECUTE on a function is granted to PUBLIC by
-- default, so `anon` inherits it until something revokes it — which is
-- the property the exposure checks are about.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

-- Extensions live in their own schema on a real project, not in
-- `public` — which is exactly how the random_handle bug hid: a bare
-- Postgres installs pgcrypto onto the search path, a Supabase project
-- does not. Install it here the way production has it, so a function
-- pinned too tightly to find it fails on this bench too.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  -- The columns GoTrue owns and the editorial seed writes. Nullable and
  -- unchecked here: the stub's job is to let that insert run, not to be
  -- GoTrue.
  instance_id                uuid,
  aud                        text,
  role                       text,
  encrypted_password         text,
  email_confirmed_at         timestamptz,
  updated_at                 timestamptz,
  raw_app_meta_data          jsonb,
  confirmation_token         text,
  recovery_token             text,
  email_change_token_new     text,
  email_change               text,
  email_change_token_current text
);

-- Policies reference it; nothing here exercises RLS as a real client
-- would, so a stub that returns null is honest about that.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

-- The JWT the editor policies read an email out of. `is_editor()` looks
-- at `auth.jwt() ->> 'email'`, so a test that wants to be an editor sets
-- `test.jwt` to a JSON object with one; everything else leaves it unset
-- and is nobody in particular.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('test.jwt', true), '')::jsonb
$$;

-- A client that owns nothing. RLS does not apply to a table's owner, so a
-- policy exercised as the runner would pass by accident; this role is the
-- position PostgREST puts a signed-in reader in. Made a member of
-- `authenticated` because the storage policies are written `to
-- authenticated`, and a role a policy does not name is a role the policy
-- does not apply to. Each test file grants it what it needs on the tables
-- it touches, mirroring what `authenticated` holds on a real project.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rls_client') then
    create role rls_client nologin;
  end if;
end $$;
grant authenticated to rls_client;

-- Enough of Storage to attach the bucket policies to. The real schema is
-- Supabase's; these are the three columns the avatar and place-photo
-- policies read, the bucket row the avatar migration upserts, and the
-- one helper they call. Not a simulation of the storage API — an upload
-- here is an insert, which is what the policy sees either way.
create schema if not exists storage;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id            uuid primary key default gen_random_uuid(),
  bucket_id     text not null references storage.buckets(id),
  name          text not null,
  owner         uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  metadata      jsonb,
  user_metadata jsonb,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
