-- People worth asking — the crew screen's third section.
--
-- Adding by exact handle is the private door and stays the only way to
-- reach a *particular* person: nobody is browsable, and no query here
-- answers "who is on this app". What this answers is narrower and
-- earned: *of the people whose public lists overlap mine, who is not
-- already in my crew* — the same shared-taste number the crew rows wear,
-- turned into an introduction.
--
-- ── why this leaks nothing ──
--
-- Every place it counts sits in a **public** collection, readable by
-- anyone with the anon key, and every profile it names is public too.
-- The function invents no visibility; it saves the reader from paging
-- through public shelves by hand. Private collections never enter the
-- sum, so a list nobody was shown cannot introduce anybody.
--
-- What it does refuse to return: yourself, anyone you are already tied
-- to in either direction (friend or pending request), and anyone either
-- side of a block. A suggestion you cannot act on is a dead row, and a
-- blocked person surfacing as a suggestion would be the app forgetting
-- a boundary on your behalf.

create or replace function public.suggested_friends()
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
  ),
  theirs as (
    select c.owner_id as other, count(distinct cp.place_id)::integer as mutual
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    where c.is_public
      and c.owner_id is not null
      and c.owner_id <> auth.uid()
      and cp.place_id in (select place_id from mine)
    group by c.owner_id
  )
  select t.other, t.mutual
  from theirs t
  where not exists (
    select 1 from public.friendships f
    where least(f.requester, f.addressee) = least(auth.uid(), t.other)
      and greatest(f.requester, f.addressee) = greatest(auth.uid(), t.other)
  )
    and not public.is_blocked_pair(auth.uid(), t.other)
  -- Strongest overlap first; the id breaks ties so the same shelf
  -- produces the same order twice, which a list you scroll must do.
  order by t.mutual desc, t.other
  limit 10;
$$;

revoke all on function public.suggested_friends() from public;
grant execute on function public.suggested_friends() to authenticated;
