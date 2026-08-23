-- Friends, at last — the card on Profile has said "Coming soon" since the
-- day it shipped.
--
-- ── the shape of a friendship ──
--
-- One row per pair, whoever asked. `requester → addressee` records who
-- held the door; `status` is 'pending' until the addressee says yes.
-- Declining DELETES the row rather than recording a refusal: the
-- requester sees their request quietly absent, which is the kindest
-- honest answer, and no table remembers who turned whom down.
--
-- The pair index is on (least, greatest) so the two directions cannot
-- coexist: once A has asked B, B asking A is the same edge and the
-- insert refuses. The app reads the pending row in both directions, so
-- B's screen shows A's request to accept rather than a dead insert.
--
-- ── what a friendship unlocks ──
--
-- Attribution, and nothing else. Trips and private collections stay
-- exactly as private as they were; being friends only lets the things
-- that were already public say who they belong to — the mutual-saves
-- count below is computed over public collections alone, and the
-- applause feed names a liker only when they are already your friend.

create table if not exists public.friendships (
  requester   uuid not null references auth.users(id) on delete cascade,
  addressee   uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- One edge per pair, regardless of who asked first.
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- Both ends read their own edges; the addressee's list is the requests
-- screen, the accepted rows are the crew.
create index if not exists friendships_addressee on public.friendships (addressee, status);

alter table public.friendships enable row level security;

-- Only the two people on an edge can see it exists. A friendship is a
-- fact about two accounts and nobody else's business — including the
-- question of who is friends with whom, which a public graph would answer
-- for anyone holding the anon key.
drop policy if exists "parties see their own edges" on public.friendships;
create policy "parties see their own edges" on public.friendships
  for select using (auth.uid() in (requester, addressee));

-- Ask as yourself, always as 'pending', and not endlessly: twenty open
-- or answered requests started in a day is a person filling their crew,
-- more is a script. Counted off the rows themselves like the suggestion
-- cap — no counter to reset, nothing to drift.
drop policy if exists "readers ask for themselves" on public.friendships;
create policy "readers ask for themselves" on public.friendships
  for insert with check (
    auth.uid() = requester
    and status = 'pending'
    and (
      select count(*) from public.friendships f
      where f.requester = auth.uid()
        and f.created_at > now() - interval '1 day'
    ) < 20
  );

-- Only the person asked can answer, and the only answer an update can
-- give is yes. No is a delete, below.
drop policy if exists "addressee accepts" on public.friendships;
create policy "addressee accepts" on public.friendships
  for update
  using (auth.uid() = addressee and status = 'pending')
  with check (auth.uid() = addressee and status = 'accepted');

-- Either end can cut the edge: the requester cancelling, the addressee
-- declining, or either party unfriending later. All three are the same
-- delete, which is why none of them needs its own state.
drop policy if exists "parties remove their edge" on public.friendships;
create policy "parties remove their edge" on public.friendships
  for delete using (auth.uid() in (requester, addressee));

-- ── mutual saves ──
--
-- The number on each crew row: how many places you have both put in
-- *public* collections. Security definer so it can read collections
-- wholesale, and safe for the same reason collection_like_counts is —
-- the return type is ids you already knew and integers, derived entirely
-- from data that is public anyway. Private collections never enter the
-- count, so the number can never leak a list nobody was shown.
create or replace function public.mutual_saves_counts(others uuid[])
returns table (other uuid, mutual integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct cp.place_id
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    where c.owner_id = auth.uid() and c.is_public
  )
  select o.other,
    (
      select count(distinct cp.place_id)::integer
      from public.collection_places cp
      join public.collections c on c.id = cp.collection_id
      where c.owner_id = o.other and c.is_public
        and cp.place_id in (select place_id from mine)
    )
  from unnest(others) as o(other);
$$;

revoke all on function public.mutual_saves_counts(uuid[]) from public;
grant execute on function public.mutual_saves_counts(uuid[]) to authenticated;

-- ── applause on your lists ──
--
-- The likes table is readable only by its own author, and the essay on
-- that migration promised "a caller cannot learn that you are one of
-- them". This function keeps the promise while giving a curator what
-- they had no way to see: that their list was liked at all.
--
-- Who liked it stays private — unless the liker is already your
-- accepted friend, in which case the row carries their handle. That is
-- the one thing friendship unlocks here: your friends' applause for
-- *your* work stops being anonymous, and a stranger's never does.
create or replace function public.likes_on_mine(since timestamptz)
returns table (collection_id uuid, liked_at timestamptz, friend_handle text, friend_name text)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at,
    case when f.requester is not null then p.handle end,
    case when f.requester is not null then p.full_name end
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.friendships f on f.status = 'accepted'
    and least(f.requester, f.addressee) = least(auth.uid(), l.user_id)
    and greatest(f.requester, f.addressee) = greatest(auth.uid(), l.user_id)
  left join public.profiles p on p.id = l.user_id
  where c.owner_id = auth.uid()
    and c.is_public
    and l.user_id <> auth.uid()
    and l.created_at >= since
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_mine(timestamptz) from public;
grant execute on function public.likes_on_mine(timestamptz) to authenticated;
