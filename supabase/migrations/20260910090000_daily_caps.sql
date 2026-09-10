-- How much one account may write in a day, said in the policies.
--
-- ── the gap ──
--
-- Every write policy in this schema answers "may this person write this
-- row" and none of them answered "how many". A signed-in account could
-- make a thousand collections in a minute, put every place in the
-- catalog into each of them, and log an event per millisecond — not to
-- any purpose, but nothing stood in the way, and a shelf or a taste
-- profile fed that way is a shelf nobody else can use. The same account
-- asking for friends, filing reports or inviting to a trip was already
-- capped; these three tables were the ones left open.
--
-- ── the shape, which is the shape everything else here already has ──
--
-- The cap is counted off the rows themselves, over the last 24 hours,
-- inside the insert policy's `with check` — exactly as `friendships`,
-- `reports` and `trip_invites` do it, and as `fetch-place` counts its
-- suggestions. No counter to reset, no window to keep, nothing that can
-- drift from what was actually written. A refused insert surfaces as
-- the same RLS refusal any other policy gives, which the app maps to
-- "you have reached today's limit" (issue #485, step 2).
--
-- ── the numbers ──
--
-- Twenty collections a day is a person building out a city; more is a
-- script. Three hundred places into one's own lists a day is a whole
-- afternoon of saving with room to spare — the catalog is five hundred
-- places across four cities. A thousand events a day is a person who
-- opened every place in the app twice; the taste profile reads ninety
-- days of these, so the cap bounds what it ever has to read.
--
-- `collection_places` had no `created_at` — the membership row was a
-- pair of ids and a sort order — so it gets one, defaulted, with the
-- existing rows stamped now. Counting needs a clock.

alter table public.collection_places
  add column if not exists created_at timestamptz not null default now();

drop policy if exists "owners insert their collections" on public.collections;
create policy "owners insert their collections" on public.collections
  for insert with check (
    owner_id = auth.uid()
    and is_public = false
    and (
      select count(*) from public.collections c
      where c.owner_id = auth.uid()
        and c.created_at > now() - interval '1 day'
    ) < 20
  );

-- The membership count is read through a definer function rather than
-- inline, for the reason `trip_invite_count` exists: a policy on
-- `collection_places` that selects from `collection_places` is evaluated
-- under that table's own read policies, which reach back through
-- `collections`, and Postgres refuses the loop. The function reads as
-- its owner, answers one number, and answers it only about the caller.
create or replace function public.own_collection_places_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
   where c.owner_id = auth.uid()
     and cp.created_at > now() - interval '1 day';
$$;

revoke all on function public.own_collection_places_today() from public;
grant execute on function public.own_collection_places_today() to authenticated;

drop policy if exists "owners add to their collections" on public.collection_places;
create policy "owners add to their collections" on public.collection_places
  for insert with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
    and public.own_collection_places_today() < 300
  );

drop policy if exists "owners insert their events" on public.place_events;
create policy "owners insert their events" on public.place_events
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.preferences p
      where p.owner_id = auth.uid() and p.history_on
    )
    and (
      select count(*) from public.place_events e
      where e.user_id = auth.uid()
        and e.created_at > now() - interval '1 day'
    ) < 1000
  );
