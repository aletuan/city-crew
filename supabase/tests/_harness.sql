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
