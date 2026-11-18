-- A switch, on for one account: `app_flag_testers`.
--
-- `app_flags` is one row for every phone. A feature built behind a
-- switch over many merges — comments, eleven of them — has to be seen on
-- a real phone before that row is flipped, and flipping it to look is
-- flipping it for everybody. This is the same switch with a name on it:
-- a row (key, user) turns `key` on for that account and nobody else,
-- whatever `app_flags.enabled` says. The app reads it after the public
-- switches, for somebody signed in (`app/src/lib/flags.ts › load`).
--
-- It can only turn a switch on. A tester sees more than the public,
-- never less; turning something off for one account is not a thing
-- anybody has asked for, and "the credit Google asks for, hidden for one
-- reader" is not a state to make possible by accident.
--
-- ── who reads, who writes ──
--
-- A signed-in reader reads their own rows and nobody else's: who is
-- trying a feature early is not the public's to list. Nobody writes
-- through the API — a row is added in the SQL editor, as a switch is:
--
--   insert into public.app_flag_testers (key, user_id)
--   select 'comments', id from public.profiles where handle = 'trang';
--
-- and taken away the same way. Deleting the account or the switch takes
-- the row with it.
--
-- ── the key has to be a switch ──
--
-- A foreign key to `app_flags`, so a row cannot name a switch that does
-- not exist — a typo here would otherwise be a tester told "it is on
-- for you" and seeing nothing. That needs the switch to have a row, so
-- `comments` gets one below, off, which is what the app ships with
-- anyway: the row changes nothing until somebody flips it.

insert into public.app_flags (key, enabled, note) values
  ('comments', false,
   'Comments on collections. Off until the release that carries them has been reviewed — docs/comments-plan.md. For one account early: app_flag_testers.')
on conflict (key) do nothing;

create table if not exists public.app_flag_testers (
  key        text not null references public.app_flags(key) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (key, user_id)
);

-- "Which switches are mine", asked on every sign in.
create index if not exists app_flag_testers_by_user on public.app_flag_testers (user_id);

alter table public.app_flag_testers enable row level security;
revoke all on table public.app_flag_testers from anon, authenticated;
grant select on table public.app_flag_testers to authenticated;

drop policy if exists "testers read their own switches" on public.app_flag_testers;
create policy "testers read their own switches" on public.app_flag_testers
  for select to authenticated using (user_id = (select auth.uid()));
