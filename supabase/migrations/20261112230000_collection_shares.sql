-- A collection shared with chosen friends (owner, 12 Nov 2026).
--
-- ── what it is ──
--
-- A third answer to "who can see this list", between Public and Private:
-- the owner names friends one by one, and those friends can read the list
-- and its places. Nobody else can, and the list does not appear in
-- Explore, in search or on the shelf: those read `is_public`, which this
-- leaves exactly as it was. A shared list is a private list with a
-- guest list.
--
-- So `is_public` is not touched, and no policy that reads it changes.
-- Explore, search, likes, copies' applause, moderation: every rule keyed
-- on a list being public stays a rule about public lists. A list that is
-- public and also shared is simply public; its shares wait, and apply
-- again if it goes back to private.
--
-- It widens what a friendship unlocks. `friendships` said, on 23 Aug,
-- "attribution, and nothing else: trips and private collections stay
-- exactly as private as they were". That stays true by default — nothing
-- is shared until the owner names a friend — but a friendship is now what
-- makes a private list shareable at all. `legal.ts` says so in the same
-- change.
--
-- ── who may be on the list ──
--
-- Accepted friends only, as a trip invitation has it (`trip_invites`):
-- the crew screen is where people are found, and sharing is not a way to
-- reach a stranger. Never yourself, and never someone blocked either way.
-- The owner adds and removes; the friend can see the row that names them
-- and take themselves off it, which is how a reader says "not for me".
--
-- ── what a friend can do with it ──
--
-- Read it, and read its places — the same places a public list shows:
-- published and approved. A place still waiting on the desk stays the
-- owner's alone, as on a public list. Not like it (likes are public-only,
-- `collection_likes`), and the app offers them no copy of the whole list
-- (owner's call, the same day). That last is a matter of what the app
-- offers, not of what can be read: a friend can read the places, and a
-- reader who can read a thing can write it down.
--
-- ── when a share ends by itself ──
--
-- When the friendship ends — unfriended, declined, or by a block, which
-- deletes it (`block_user`) — every share between the two goes, both ways,
-- in the same transaction. A block made by a bare insert into `blocks`
-- does the same. An account deleted takes its shares with it, either end,
-- by the foreign keys; a list deleted takes its own.
--
-- ── why the helpers are definer functions ──
--
-- The list's read policy has to ask "is this shared with me", and the
-- share table's policy has to ask "is this list mine". Written as plain
-- subqueries, each policy would run the other's and Postgres refuses the
-- loop (infinite recursion in policy). Definer functions read past RLS,
-- once, and say yes or no. They are granted to the signed-in alone, and
-- the policies that call them are written `to authenticated`: a policy
-- `to public` is evaluated for a guest too, and a guest without EXECUTE
-- would get an error where it should get no rows.

create table if not exists public.collection_shares (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, user_id)
);

comment on table public.collection_shares is
  'A private list shared with one accepted friend. is_public is untouched: a shared list stays out of Explore and search.';

-- "Shared with me" is read by the friend, newest first.
create index if not exists collection_shares_user on public.collection_shares (user_id, created_at desc);

alter table public.collection_shares enable row level security;

-- ── the helpers ──

/** Whether the caller owns the list. */
create or replace function public.owns_collection(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collections c
    where c.id = cid and c.owner_id = auth.uid()
  );
$$;

/** Whether the list has been shared with the caller. */
create or replace function public.shared_with_me(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collection_shares s
    where s.collection_id = cid and s.user_id = auth.uid()
  );
$$;

/** Whether the caller and `other` are accepted friends. */
create or replace function public.friends_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(auth.uid(), other)
      and greatest(f.requester, f.addressee) = greatest(auth.uid(), other)
  );
$$;

revoke all on function public.owns_collection(uuid) from public, anon;
revoke all on function public.shared_with_me(uuid) from public, anon;
revoke all on function public.friends_with(uuid) from public, anon;
grant execute on function public.owns_collection(uuid) to authenticated;
grant execute on function public.shared_with_me(uuid) to authenticated;
grant execute on function public.friends_with(uuid) to authenticated;

-- ── the share table ──

drop policy if exists "owners and friends see shares" on public.collection_shares;
create policy "owners and friends see shares" on public.collection_shares
  for select to authenticated
  using (user_id = (select auth.uid()) or public.owns_collection(collection_id));

drop policy if exists "owners share with friends" on public.collection_shares;
create policy "owners share with friends" on public.collection_shares
  for insert to authenticated
  with check (
    public.owns_collection(collection_id)
    and user_id <> (select auth.uid())
    and public.friends_with(user_id)
    and not public.blocked_with(user_id)
  );

-- The owner unshares; the friend takes themselves off.
drop policy if exists "owners and friends end shares" on public.collection_shares;
create policy "owners and friends end shares" on public.collection_shares
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.owns_collection(collection_id));

-- No update: a share is a fact or it is not.

-- ── the list and its places, for a friend ──

drop policy if exists "friends read lists shared with them" on public.collections;
create policy "friends read lists shared with them" on public.collections
  for select to authenticated
  using (public.shared_with_me(id));

-- The same places a public list shows, and no others. `places`' own read
-- policy already hides a place still waiting on the desk from everyone
-- but its submitter; this says it again, as the public policy beside it
-- does, so the rule is read here rather than inferred from another table.
drop policy if exists "friends read members of lists shared with them" on public.collection_places;
create policy "friends read members of lists shared with them" on public.collection_places
  for select to authenticated
  using (
    public.shared_with_me(collection_id)
    and exists (
      select 1 from public.places p
      where p.id = collection_places.place_id
        and p.is_published = true
        and p.review_status = 'approved'
    )
  );

-- ── a friendship ended, a block made: the shares between the two go ──

create or replace function public.unshare_pair(a uuid, b uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.collection_shares s
  using public.collections c
  where s.collection_id = c.id
    and ((c.owner_id = a and s.user_id = b) or (c.owner_id = b and s.user_id = a));
$$;

revoke all on function public.unshare_pair(uuid, uuid) from public, anon, authenticated;

create or replace function public.unshare_unfriended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.unshare_pair(old.requester, old.addressee);
  return old;
end;
$$;

create or replace function public.unshare_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.unshare_pair(new.blocker, new.blocked);
  return new;
end;
$$;

revoke all on function public.unshare_unfriended() from public, anon, authenticated;
revoke all on function public.unshare_blocked() from public, anon, authenticated;

drop trigger if exists friendships_unshare on public.friendships;
create trigger friendships_unshare
  after delete on public.friendships
  for each row execute function public.unshare_unfriended();

drop trigger if exists blocks_unshare on public.blocks;
create trigger blocks_unshare
  after insert on public.blocks
  for each row execute function public.unshare_blocked();

grant select, insert, delete on public.collection_shares to authenticated;
