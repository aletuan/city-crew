-- A public list stays public when a place in it is not live. The place
-- is what goes unseen, not the list.
--
-- ── what this replaces ──
--
-- `20260815180000_place_submissions.sql` kept anything not live out of
-- other people's sight by keeping the whole list out of it:
--
-- - adding a pending place to a public list made the list private
--   (`collection_places_unpublish`);
-- - the desk flagging or unpublishing a place made every public list
--   holding it private (`places_unpublish_collections`);
-- - and a list holding one could not be made public again
--   (`collections_guard_publish`) until the place went live — at which
--   point nothing put it back, and nothing had told its owner it had gone.
--
-- The owner, 23 Oct 2026: a list of thirty places disappears from
-- everyone because of one, and comes back only if its owner notices.
-- With places about to be added to lists straight from a search,
-- suggestions included, that would become the ordinary case rather than
-- the rare one: 654 of the 655 places readers have suggested so far were
-- approved, and every one of them was pending first.
--
-- ── what does the hiding instead ──
--
-- The member rows. A public list's members are read by everyone through
-- "public read public collection members"; from here that policy also
-- needs the member place to be live. The place itself, its photographs
-- and a cover chosen from them were already unreadable to anyone but the
-- submitter (`public read published places`, `public read photos of
-- published places`); what leaked was the row saying a list held
-- *something*, and the count every client takes from those rows. The
-- owner still reads all of their own members through "owners read their
-- collection members", and editors through theirs.
--
-- A place approved later appears in the list for everyone at once, with
-- nothing to republish. One flagged or unpublished by the desk drops out
-- of it the same way.
--
-- ── two counts that read past RLS ──
--
-- `mutual_saves_counts` and `suggested_friends` count places two people
-- both hold in public lists, as SECURITY DEFINER. They counted every
-- member while a public list could only hold live ones; they count live
-- ones now, so the figure is of places either person could see.

-- ───────────────────────────────────────────── the old rule, removed

drop trigger if exists collections_guard_publish on public.collections;
drop trigger if exists collection_places_unpublish on public.collection_places;
drop trigger if exists places_unpublish_collections on public.places;

drop function if exists public.guard_collection_publish();
drop function if exists public.unpublish_on_unlive_member();
drop function if exists public.unpublish_collections_of_pulled_place();
drop function if exists public.collection_has_unlive_member(uuid);

-- ─────────────────────────────────── a public list's members, if live

drop policy if exists "public read public collection members" on public.collection_places;
create policy "public read public collection members" on public.collection_places
  for select using (
    exists (
      select 1 from public.collections c
       where c.id = collection_places.collection_id and c.is_public = true
    )
    and exists (
      select 1 from public.places p
       where p.id = collection_places.place_id
         and p.is_published = true and p.review_status = 'approved'
    )
  );

-- ───────────────────────────────── counts of places held in common

create or replace function public.mutual_saves_counts(others uuid[])
returns table(other uuid, mutual integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct cp.place_id
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    join public.places p on p.id = cp.place_id
    where c.owner_id = auth.uid() and c.is_public
      and p.is_published and p.review_status = 'approved'
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

create or replace function public.suggested_friends()
returns table(other uuid, mutual integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct cp.place_id
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    join public.places p on p.id = cp.place_id
    where c.owner_id = auth.uid() and c.is_public
      and p.is_published and p.review_status = 'approved'
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
  order by t.mutual desc, t.other
  limit 10;
$$;
