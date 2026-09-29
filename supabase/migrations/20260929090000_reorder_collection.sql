-- Putting your own list in order, for real.
--
-- ── what was broken ──
--
-- The app has let an owner reorder their list since the arrange mode
-- shipped, and for an owner it never did anything. `collection_places`
-- has policies for an owner to read, add and remove — and none to update.
-- Row security does not refuse an UPDATE it has no policy for; it filters
-- the rows down to none, and the statement succeeds having changed
-- nothing. So the app sent one update per place, every one of them came
-- back without an error, and the order on the server stayed where it was.
-- It looked like it worked for the one account it was tried on because
-- that account is an editor, and `editors manage collection members` is a
-- policy for all commands.
--
-- It was also not one write. The app sent the positions one row at a
-- time, so a connection dropped halfway left a list half in the new order
-- and half in the old — which its own comment promised could not happen.
--
-- ── why a function and not an update policy ──
--
-- A policy that let an owner UPDATE their membership rows would let them
-- update every column of those rows, and `place_id` is one: changing it
-- is adding a place without an INSERT, which is the one thing the daily
-- cap on `owners add to their collections` counts. A definer function
-- touches `sort_order` and nothing else, answers the ownership question
-- itself, and does the whole sequence in one statement — so the order
-- lands whole or not at all.
--
-- ── what it takes and what it does ──
--
-- The list's slug and its places' slugs in the order wanted, which is what
-- the app holds. Positions are written 0..n-1 in that order. A member the
-- caller did not mention — added from another device while this one was
-- arranging — is kept, after the ones it did, in the order it had. A slug
-- that is not a member is ignored, and one named twice counts at its first
-- position. Asked by anyone but the owner or an editor, it refuses out
-- loud rather than doing nothing quietly, which is how this went unseen.

create or replace function public.reorder_collection(collection_slug text, place_slugs text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select c.id into target
    from public.collections c
   where c.slug = collection_slug
     and (c.owner_id = (select auth.uid()) or (select public.is_editor()));
  if target is null then
    raise exception 'not yours to reorder' using errcode = 'insufficient_privilege';
  end if;

  update public.collection_places cp
     set sort_order = ranked.pos
    from (
      select m.place_id,
             (row_number() over (order by wanted.ord nulls last, m.sort_order, m.place_id) - 1)::int as pos
        from public.collection_places m
        left join (
          select p.id, min(o.ord) as ord
            from unnest(place_slugs) with ordinality as o(slug, ord)
            join public.places p on p.slug = o.slug
           group by p.id
        ) wanted on wanted.id = m.place_id
       where m.collection_id = target
    ) ranked
   where cp.collection_id = target
     and cp.place_id = ranked.place_id
     and cp.sort_order is distinct from ranked.pos;
end;
$$;

comment on function public.reorder_collection(text, text[]) is
  'Put a list''s places in the order given, in one statement. The owner or an editor only; members not named keep their order after the named ones.';

-- Signed-in only. Supabase grants EXECUTE to anon on every new function;
-- a guest has no list to order. See function_grants_test.
revoke execute on function public.reorder_collection(text, text[]) from public, anon;
grant execute on function public.reorder_collection(text, text[]) to authenticated;

-- ── the ties already written ──
--
-- A place saved into a list was put at `sort_order = <how many members>`,
-- which collides with the last member as soon as anything earlier has
-- been removed: 0, 2 after removing 1, and the next save lands on 2 again.
-- Two members sharing a position come back in whatever order the database
-- happens to return them, so the list — and the cover picked from its
-- first place — could change between two reads. The app now appends after
-- the highest position instead; this settles the lists that already have
-- a tie, keeping every other member's relative order and breaking each
-- tie the same way every time. Lists without a tie are left alone.
update public.collection_places cp
   set sort_order = renum.pos
  from (
    select m.collection_id, m.place_id,
           (row_number() over (partition by m.collection_id order by m.sort_order, m.place_id) - 1)::int as pos
      from public.collection_places m
     where m.collection_id in (
       select collection_id from public.collection_places
        group by collection_id
       having count(*) <> count(distinct sort_order)
     )
  ) renum
 where cp.collection_id = renum.collection_id
   and cp.place_id = renum.place_id
   and cp.sort_order is distinct from renum.pos;
