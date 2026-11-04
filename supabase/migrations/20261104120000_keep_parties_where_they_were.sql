-- A friend request stays between the two people it was sent between, and
-- an invitation stays on the trip it was sent for.
--
-- ── what was open (security review, 4 Nov 2026) ──
--
-- The update policies on `friendships` and `trip_invites` pin the row to
-- the caller and pin `status` to the answers that are theirs to give.
-- They pin nothing else, and an update can touch any column at once.
--
-- "addressee accepts" (friendships, 20260823100000) checks `addressee`
-- and `status` and never looks at `requester`. So with two accounts of
-- your own — the second sends the first a request — the first could run
--
--   update friendships set requester = <anyone>, status = 'accepted'
--
-- and be that person's accepted friend. Nobody had asked them. The block
-- check sits on the insert policy only, so a block did not stop it
-- either, and an accepted friendship is what the trip-invite insert
-- policy looks for. Profiles are public, so every id was to hand.
--
-- "invitees answer, and the answered may leave" (trip_invites,
-- 20260827000000) checks `invitee_id` and `status` and never looks at
-- `trip_id`. An invitee who sets `trip_id` to some other trip is, as far
-- as `on_trip()` can tell, invited to it — and the two read policies that
-- lean on `on_trip()` then hand over that trip and its stops. It needed
-- the trip's uuid, which nothing exposes, but a guest once invited and
-- then withdrawn still had one.
--
-- ── why a trigger and not a tighter policy ──
--
-- A policy's `with check` sees the row as it will be and nothing of the
-- row as it was: there is no `old` in RLS. Saying "this column may not
-- change" in a policy means reading the same table back inside it, which
-- is the recursion `trip_invites_test.sql` already records meeting once
-- ("infinite recursion detected"). A `before update` trigger has both
-- rows for free, runs for every role including the service one, and
-- costs one comparison. Nobody — the owner, the invitee, the desk — has
-- any business moving a relationship's ends, so there is no exemption.
--
-- One function, told which columns by its arguments, rather than one per
-- table: the rule is the same and the next table to need it should not
-- get a third copy.

create or replace function public.refuse_repointing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(old) -> col is distinct from to_jsonb(new) -> col then
      raise exception '% on % is not yours to change', col, tg_table_name
        using errcode = 'insufficient_privilege';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists friendships_keep_parties on public.friendships;
create trigger friendships_keep_parties
  before update on public.friendships
  for each row execute function public.refuse_repointing('requester', 'addressee');

drop trigger if exists trip_invites_keep_parties on public.trip_invites;
create trigger trip_invites_keep_parties
  before update on public.trip_invites
  for each row execute function public.refuse_repointing('trip_id', 'invitee_id', 'inviter_id');
