-- Whether two people have blocked each other, answerable by anybody.
--
-- `is_blocked_pair(a, b)` takes any two ids and is a security definer, so
-- it reads every row of `blocks`. It was granted to `authenticated` because
-- the friend-request policy calls it — a policy calls functions with the
-- caller's privileges — and on the live project every definer function is
-- also executable by `anon`, which Supabase's default privileges grant and
-- a `revoke ... from public` does not take back. Together that made every
-- block in the app a public fact: anybody, signed in or not, could ask
-- about any pair of accounts, and a blocked person could ask whether the
-- person they were looking for had blocked them. `blocks.sql` says the
-- person blocked is never told. This was telling them.
--
-- The policy only ever needs one question — is the caller blocked with
-- this person, either way — so that is the only question left open.
-- `blocked_with(other)` answers it about the caller alone; there is no
-- second argument with which to name somebody else's pair.
--
-- What it cannot hide is the caller's own pair: a request to somebody who
-- has blocked you has to be refused, and a refusal is information. That
-- was already so before this, and it is the smallest leak a block that
-- works can have. What goes is the rest: bystanders, crawlers, and the
-- signed-out.
--
-- `is_blocked_pair` stays, with nobody allowed to call it directly.
-- `suggested_friends()` is a definer owned by the same role, so it keeps
-- calling it.

create or replace function public.blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_blocked_pair(auth.uid(), other);
$$;

revoke all on function public.blocked_with(uuid) from public, anon;
grant execute on function public.blocked_with(uuid) to authenticated;

revoke all on function public.is_blocked_pair(uuid, uuid) from public, anon, authenticated;

-- The friend-request policy as `blocks.sql` left it, asking the narrower
-- question.
drop policy if exists "readers ask for themselves" on public.friendships;
create policy "readers ask for themselves" on public.friendships
  for insert with check (
    auth.uid() = requester
    and status = 'pending'
    and not public.blocked_with(addressee)
    and (
      select count(*) from public.friendships f
      where f.requester = auth.uid()
        and f.created_at > now() - interval '1 day'
    ) < 20
  );
