-- Enough of Supabase's auth schema to run a migration against a bare
-- Postgres. Not a simulation of GoTrue — just the two things our SQL
-- touches: the users table it triggers on, and the uid() the policies
-- call.
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Policies reference it; nothing here exercises RLS as a real client
-- would, so a stub that returns null is honest about that.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
