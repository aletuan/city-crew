-- Blocking — the door that stays shut.
--
-- Declining a request deletes the row, which is the kind answer to an
-- honest mistake and no answer at all to persistence: the same person
-- could ask again the moment they were declined, and the daily cap
-- bounds how often they can ask *anyone*, not how often they can ask
-- *you*. A social feature that cannot stop repeated unwanted contact is
-- also one Apple's review guidelines (1.2) will not pass. So: a block.
--
-- ── what a block does ──
--
-- Blocking cuts the friendship edge if one exists and refuses every
-- future request across the pair, in either direction — the blocker
-- cannot ask the blocked any more than the reverse, because a door only
-- one side can reopen is a prank, not a boundary. A blocked person's
-- likes also stop appearing in the blocker's applause feed. Their
-- public collections stay public: a block is about contact, not about
-- rewriting what the shelf shows everyone.
--
-- ── what a block does not do ──
--
-- Announce itself. The blocked person's next request simply fails the
-- policy; the app words that refusal neutrally, and nothing readable by
-- them says a block exists. Only the blocker can see their own list.

create table if not exists public.blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.blocks enable row level security;

-- Yours to see, yours to lift. Insertion happens through `block_user`
-- below so the edge-cutting cannot be forgotten, but a direct insert of
-- your own row is harmless and allowed for the same reason a direct
-- delete is: both touch only your own boundary.
drop policy if exists "blockers see their own blocks" on public.blocks;
create policy "blockers see their own blocks" on public.blocks
  for select using (auth.uid() = blocker);

drop policy if exists "blockers block for themselves" on public.blocks;
create policy "blockers block for themselves" on public.blocks
  for insert with check (auth.uid() = blocker);

drop policy if exists "blockers lift their own blocks" on public.blocks;
create policy "blockers lift their own blocks" on public.blocks
  for delete using (auth.uid() = blocker);

-- Whether a block stands between two accounts, in either direction.
-- Security definer because the friendships policy has to ask about rows
-- the asker is deliberately not allowed to see — and the answer is one
-- boolean, which is exactly as much as the policy needs and nothing a
-- caller could not infer from their request failing anyway.
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

-- The insert policy, re-stated with the door check. Same shape as
-- before — as yourself, as pending, under the daily cap — plus: not
-- across a block, whichever side holds it.
drop policy if exists "readers ask for themselves" on public.friendships;
create policy "readers ask for themselves" on public.friendships
  for insert with check (
    auth.uid() = requester
    and status = 'pending'
    and not public.is_blocked_pair(auth.uid(), addressee)
    and (
      select count(*) from public.friendships f
      where f.requester = auth.uid()
        and f.created_at > now() - interval '1 day'
    ) < 20
  );

-- Block as one act: the row goes in and any edge across the pair goes
-- out, atomically. Two separate calls would leave a window where the
-- friendship survives its own block.
create or replace function public.block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target is null or target = auth.uid() then
    raise exception 'cannot block that';
  end if;
  insert into public.blocks (blocker, blocked)
  values (auth.uid(), target)
  on conflict do nothing;
  delete from public.friendships
  where (requester = auth.uid() and addressee = target)
     or (requester = target and addressee = auth.uid());
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

-- Applause stops carrying a blocked person's likes. Their like row
-- stays — the count on the shelf is a public fact — but the owner's
-- feed does not relay them. Same signature, so replaced in place.
create or replace function public.likes_on_mine(since timestamptz)
returns table (collection_id uuid, liked_at timestamptz, liker_handle text, liker_name text)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at, p.handle, p.full_name
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.profiles p on p.id = l.user_id
  where c.owner_id = auth.uid()
    and c.is_public
    and l.user_id <> auth.uid()
    and l.created_at >= since
    and not exists (
      select 1 from public.blocks b
      where b.blocker = auth.uid() and b.blocked = l.user_id
    )
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_mine(timestamptz) from public;
grant execute on function public.likes_on_mine(timestamptz) to authenticated;
