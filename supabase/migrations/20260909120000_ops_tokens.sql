-- A token the database can hand to an Edge Function, for work the
-- database itself sets in motion.
--
-- ── the door this opens ──
--
-- Every function so far is called by a person: the phone with a session,
-- the dashboard with an editor's login. Nothing here can call one of
-- them — a `pg_net` request from a SQL loop or a `pg_cron` schedule
-- carries no session to check — and the first job that needed to was
-- the photo rehost: two and a half thousand Google links to replace, a
-- few hundred already dead, driven from SQL rather than from a button
-- somebody has to hold.
--
-- So the function accepts one more credential besides an editor's JWT:
-- a header carrying a token that matches a live row here. The row is the
-- whole authority — created for a job, given an expiry, deleted when the
-- job is done — and the table is readable by nobody but the service role,
-- which is what the function connects as. No policy is the policy: RLS
-- on and nothing granted means PostgREST returns nothing to anon or
-- authenticated, and the checks in ops_tokens_test.sql pin that.
create table if not exists public.ops_tokens (
  name       text primary key,
  token      text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.ops_tokens enable row level security;
revoke all on table public.ops_tokens from anon, authenticated;
