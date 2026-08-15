-- Letting a person publish a list of their own.
--
-- `20260813000000_user_collections.sql` pinned owned rows to is_public =
-- false on both insert and update, and said why: "a user cannot publish
-- into the feed every other user reads ... Publishing stays an editor
-- action." That was the right default to ship with and the wrong one to
-- keep, and this migration is deliberately undoing it. What follows is
-- what replaces the guarantee it was making.
--
-- The insert pin stays. A collection is still born private, and always;
-- publishing is a separate, deliberate second act by someone who has
-- already seen what is in the list. Nothing can arrive public.
--
-- Reading is already handled and needs no new policy: the editorial
-- policies from 20260807 select on `is_public = true` alone, for both
-- `collections` and `collection_places`, so a published list and its
-- members become visible to everyone the moment the flag flips — and
-- invisible again the moment it flips back.

-- The only change to the rules: an owner may now set the flag on a row
-- that is already theirs. `using` is unchanged, so it is still only ever
-- your own rows, and the check still refuses to hand a row to anyone
-- else.
drop policy if exists "owners update their collections" on public.collections;
create policy "owners update their collections" on public.collections
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Attribution, stamped rather than submitted.
--
-- A published list needs a name on it, and `curator_handle` is the column
-- the app already reads for that on every editorial row. The client must
-- not be the one to write it: a plain update travels through PostgREST,
-- so a handle in the request body is a handle the sender chose, and
-- nothing in an RLS check is well placed to prove it is theirs. The
-- trigger reads it from `profiles` instead, so the name on a public list
-- is the owner's or it is nothing.
--
-- It is cleared on unpublish for the same reason it is set on publish:
-- the byline belongs to the act of publishing, and a private list has no
-- byline to carry.
--
-- Editorial rows are left alone entirely. They have no owner, and their
-- handles are set by the desk in the seed migrations.
create or replace function public.stamp_curator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    if new.is_public then
      select p.handle into new.curator_handle
      from public.profiles p where p.id = new.owner_id;
    else
      new.curator_handle := null;
    end if;
  end if;
  return new;
end;
$$;

-- Not callable over the wire. It is a trigger, and a `security definer`
-- function left executable by `anon` is an endpoint at
-- /rest/v1/rpc/stamp_curator — the advisory the profiles migration
-- learned this from.
revoke execute on function public.stamp_curator() from anon, authenticated, public;

drop trigger if exists collections_stamp_curator on public.collections;
create trigger collections_stamp_curator
  before insert or update on public.collections
  for each row execute function public.stamp_curator();
