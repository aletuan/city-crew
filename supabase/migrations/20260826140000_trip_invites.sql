-- Somebody else on your evening.
--
-- The trips migration ends by refusing to write this:
--
--   "Sharing a trip with other people needs a membership table, an
--    invitation and a decision about who may edit what; none of that
--    exists, and a policy written now against a design nobody has settled
--    would be the widest thing in this file."
--
-- This is that design, settled. It is deliberately the narrowest thing
-- that makes the plan editor's Invite button stop being a mock.
--
-- ── one table, not two ──
--
-- A membership and an invitation are the same row at different moments,
-- so this stores the moment rather than promoting the accepted ones into
-- a second table. `status` is 'pending' until the person answers; the
-- crew of a trip is its accepted rows.
--
-- ── why 'declined' is kept, when friendships deletes it ──
--
-- The friendships migration deletes a refusal on purpose: nobody needs a
-- table remembering who turned whom down, and a request that quietly
-- vanishes is the kindest honest answer.
--
-- A trip is not that. The person who planned it is deciding a table
-- booking and a route around who is coming, and "Minh can't make it" is
-- something they have to act on — it is not the same news as "Minh hasn't
-- answered yet". Deleting the row would collapse those two into one
-- silence. So a refusal is recorded, and the answer screen says so before
-- it is given.
--
-- What it does NOT do is keep the plan readable. A declined invitee falls
-- out of both select policies below on the same statement that records
-- the refusal: the row remembers the answer, not the access.
--
-- ── what this opens, and what it does not ──
--
-- The friendships migration promised, in as many words, that "trips and
-- private collections stay exactly as private as they were". Half of that
-- is now out of date and this file is where it changed, so it says so
-- plainly: being invited to a trip lets you READ that one trip and its
-- stops. Nothing here grants update or delete on anybody else's row, and
-- private collections are untouched.
--
-- The owner keeps the plan. That is not a UI convention — there is no
-- policy in this file that would let an invitee move a stop, and there is
-- no place for one to hide.

create table if not exists public.trip_invites (
  trip_id      uuid not null references public.trips(id) on delete cascade,
  invitee_id   uuid not null references auth.users(id) on delete cascade,
  -- Denormalised from `trips.owner_id`, and the trips migration argues
  -- against exactly this ("two copies of who owns something drift"). It
  -- earns its place here for a reason that does not apply there: this is
  -- who *asked*, at the moment they asked, which is a different fact from
  -- who owns the trip today. They are the same today because only an
  -- owner may invite; if a trip is ever handed over, the invitation still
  -- has to be able to say whose invitation it was.
  inviter_id   uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (trip_id, invitee_id),
  -- Inviting yourself is not a thing that can mean anything: the owner is
  -- already on the trip, and a row saying so would show up in their own
  -- invitations list.
  check (invitee_id <> inviter_id)
);

-- The invitee's own question — "what am I being asked to?" — asked on
-- every launch by the badge on the Trips tab. Status is in the index
-- because the badge only counts one of the three.
create index if not exists trip_invites_invitee
  on public.trip_invites (invitee_id, status);

alter table public.trip_invites enable row level security;

-- ── two functions the policies below cannot do without ───────────────
--
-- A policy that reads its own table recurses: Postgres applies the policy
-- to the subquery, which applies it again, and the insert dies with
-- "infinite recursion detected". The same happens across a pair — a
-- policy on `trips` that reads `trip_invites`, whose own policy reads
-- `trips`. Both shapes appear below, and both are cut the same way: the
-- read happens inside a security-definer function, which runs as the
-- owner and is therefore not subject to the policies it would re-enter.
--
-- Neither leaks. `on_trip` only ever asks about the caller, and
-- `trip_invite_count` answers 0 to anybody who does not own the trip —
-- so a caller who guesses a uuid learns nothing they did not supply.

create or replace function public.on_trip(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_invites i
     where i.trip_id = t
       and i.invitee_id = auth.uid()
       and i.status in ('pending', 'accepted')
  );
$$;

revoke all on function public.on_trip(uuid) from public;
grant execute on function public.on_trip(uuid) to authenticated;

create or replace function public.trip_invite_count(t uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.trips tr where tr.id = t and tr.owner_id = auth.uid())
      then (select count(*)::integer from public.trip_invites i where i.trip_id = t)
    else 0
  end;
$$;

revoke all on function public.trip_invite_count(uuid) from public;
grant execute on function public.trip_invite_count(uuid) to authenticated;

-- ── who may see an invitation ────────────────────────────────────────
--
-- The two people it is between, and nobody else. Not "everyone on the
-- trip": an invitee learning who else was asked is a separate decision,
-- and the answer screen shows a count from a function rather than the
-- rows themselves (see trip_crew_counts below).
drop policy if exists "parties see the invitation" on public.trip_invites;
create policy "parties see the invitation" on public.trip_invites
  for select using (
    auth.uid() = invitee_id
    or exists (select 1 from public.trips t
                where t.id = trip_invites.trip_id and t.owner_id = auth.uid())
  );

-- ── who may send one ─────────────────────────────────────────────────
--
-- The owner of the trip, as themselves, always as 'pending', and only to
-- somebody who has already accepted their friend request.
--
-- The friend requirement is here rather than only in the app because it
-- is the whole safety story of this feature: without it, holding the anon
-- key and a user id would be enough to put a row in a stranger's
-- invitations list. Blocking cuts the friendship edge (see the blocks
-- migration), so a blocked account fails this check without needing its
-- own clause.
--
-- The cap is twenty per trip, counted off the rows the way the friend
-- request cap and the suggestion cap are — no counter to reset, nothing
-- to drift. Twenty is not a party size, it is the point past which this
-- has stopped being an evening out.
drop policy if exists "owners invite their friends" on public.trip_invites;
create policy "owners invite their friends" on public.trip_invites
  for insert with check (
    auth.uid() = inviter_id
    and status = 'pending'
    and exists (select 1 from public.trips t
                 where t.id = trip_invites.trip_id and t.owner_id = auth.uid())
    and exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and least(f.requester, f.addressee) = least(auth.uid(), trip_invites.invitee_id)
         and greatest(f.requester, f.addressee) = greatest(auth.uid(), trip_invites.invitee_id)
    )
    and public.trip_invite_count(trip_invites.trip_id) < 20
  );

-- ── who may answer ───────────────────────────────────────────────────
--
-- The person asked, once, and only from 'pending'. Both answers are an
-- update rather than one being a delete, because the owner is entitled to
-- both of them — see the essay above.
--
-- `using` pins the row to the invitee and to the unanswered state, so an
-- accepted invitation cannot be quietly turned into a refusal a week
-- later, and `with check` refuses anything but the two real answers.
drop policy if exists "invitees answer once" on public.trip_invites;
create policy "invitees answer once" on public.trip_invites
  for update
  using (auth.uid() = invitee_id and status = 'pending')
  with check (auth.uid() = invitee_id and status in ('accepted', 'declined'));

-- ── who may withdraw one ─────────────────────────────────────────────
--
-- The owner, and only while it is unanswered. Unchecking a name in the
-- invite sheet is this delete; a mis-tap is meant to be undoable.
--
-- Deliberately not extended to answered rows. Removing somebody who has
-- already said yes is a different act with a different weight — they have
-- put the evening in their own Trips by then — and nothing in the app
-- asks for it yet.
drop policy if exists "owners withdraw an unanswered invite" on public.trip_invites;
create policy "owners withdraw an unanswered invite" on public.trip_invites
  for delete using (
    status = 'pending'
    and exists (select 1 from public.trips t
                 where t.id = trip_invites.trip_id and t.owner_id = auth.uid())
  );

-- ── and the read the whole feature exists for ────────────────────────
--
-- An invitation nobody can read the plan behind is a notification with
-- nothing under it. These are the two policies that let an invitee see
-- what they are being asked to, and they are additive: the owner policies
-- from the trips migration are untouched, and Postgres ORs permissive
-- policies together.
--
-- 'pending' is included on purpose. The answer screen shows the whole
-- itinerary before the answer is given — a plan you must accept sight
-- unseen is not an invitation — and the row falls out of this the moment
-- 'declined' is written.
drop policy if exists "invitees read the trip" on public.trips;
create policy "invitees read the trip" on public.trips
  for select using (public.on_trip(trips.id));

drop policy if exists "invitees read the trip stops" on public.trip_stops;
create policy "invitees read the trip stops" on public.trip_stops
  for select using (public.on_trip(trip_stops.trip_id));

-- ── how many are coming ──────────────────────────────────────────────
--
-- "Lan Phương and 1 other — you'd be 3 in all." An invitee needs that
-- sentence and must not have the rows it is derived from: who else was
-- asked is the owner's business, and one of them may have said no.
--
-- Security definer, and safe for the reason `mutual_saves_counts` is —
-- the return is a count, and it is scoped to trips the caller is
-- genuinely on. The `exists` at the bottom is what makes that true: a
-- caller who is neither the owner nor an invitee gets no row back at all,
-- not a zero.
create or replace function public.trip_crew_counts(trip_ids uuid[])
returns table (trip_id uuid, accepted integer, pending integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
    (select count(*)::integer from public.trip_invites i
      where i.trip_id = t.id and i.status = 'accepted'),
    (select count(*)::integer from public.trip_invites i
      where i.trip_id = t.id and i.status = 'pending')
  from public.trips t
  where t.id = any(trip_ids)
    and (
      t.owner_id = auth.uid()
      or public.on_trip(t.id)
    );
$$;

revoke all on function public.trip_crew_counts(uuid[]) from public;
grant execute on function public.trip_crew_counts(uuid[]) to authenticated;
