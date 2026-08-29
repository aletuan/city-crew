-- Recording is on when the account is made, and off when the person says so.
--
-- ── why this reverses a decision this schema argued for ──
--
-- `20260817120000_preferences.sql` made `history_on` default false and said
-- why: "a default of true would make the opt-in a lie told once at signup".
-- That argument was about a *hidden* default. It is answered rather than
-- ignored — the sign-up screen now says, in the reader's own language and
-- before anything is recorded, that the app remembers what they open and
-- where to turn it off. A stated default is a different thing from a silent
-- one.
--
-- What the old default produced, measured before this ran: thirteen
-- accounts, six preference rows, one of them opted in — and **zero rows in
-- `place_events`, ever**. Not a slow start; nothing at all. The signal
-- `taste.ts` calls its strongest, the only one about a place rather than a
-- category, has never once fired for anybody. An opt-in nobody opts into is
-- not a privacy protection, it is a feature that does not exist.
--
-- ── what does not change ──
--
-- The insert policy still requires `history_on`, still by `exists` on a real
-- row: the database refuses to record for a person who has turned it off,
-- and no amount of client code can talk it round. The delete policy still
-- does not consult it, so "off" and "erase what you have" stay separate
-- verbs. The switch in Edit profile is untouched. Only the starting position
-- moves.

-- 1. New accounts start on.
alter table public.preferences alter column history_on set default true;

-- 2. Every account gets a row, at the moment it is made.
--
-- Seven of the thirteen had none — the sign-up screen only writes one when
-- the reader picks a taste, and "Bỏ qua" is a real answer. A missing row is
-- indistinguishable from a refusal to the insert policy above, so those
-- seven could never have recorded anything whatever the default said. A
-- trigger is the only place this can be guaranteed: the client write is a
-- `.catch(() => {})` on purpose, because a failed preference must not look
-- like a failed sign-up.
--
-- Its own trigger rather than a line inside `handle_new_user`, which would
-- mean restating that whole function to add one insert.
create or replace function public.handle_new_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `on conflict do nothing`, not an upsert: if a row somehow exists
  -- already it is the person's, and this must never overwrite it.
  insert into public.preferences (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_preferences on auth.users;
create trigger on_auth_user_created_preferences
  after insert on auth.users
  for each row execute function public.handle_new_user_preferences();

-- Reachable at /rest/v1/rpc/ otherwise, and a SECURITY DEFINER function
-- anyone may call is a shape to avoid even where calling it does nothing.
-- The same rule `handle_new_user` follows.
revoke execute on function public.handle_new_user_preferences() from anon, authenticated, public;

-- 3. The accounts that already exist.
--
-- Both halves of the backfill, and they are different facts. The first is
-- an account with no row: it never had a setting, so it gets the new
-- default like any account made from now on. The second is a row saying
-- false — which, with the old default, is what "never touched the switch"
-- looks like. The database cannot tell that from a deliberate no, so the
-- claim rests on the count above: exactly one account has ever held true,
-- and turning a switch off that was already off writes nothing. Nobody's
-- stated choice is being reversed here, because only one person ever
-- stated one, and theirs is already on.
insert into public.preferences (owner_id, history_on)
select u.id, true from auth.users u
on conflict (owner_id) do nothing;

update public.preferences set history_on = true, updated_at = now()
 where not history_on;
