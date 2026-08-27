-- The door out of an accepted invitation.
--
-- "Invitees answer once" pinned the update to the unanswered state, on
-- the reasoning that an accepted invitation should not quietly become a
-- refusal a week later. The owner's device found who that pin forgets: a
-- guest who said yes and now wants out has no move at all. The app's
-- delete button reached for the trip row instead, RLS matched nothing,
-- returned success, and the evening "came back" on the next refetch — it
-- had never left.
--
-- Leaving is declining late. The update now covers both states that are
-- still the invitee's to change — pending and accepted — and still lands
-- only on the two real answers. What does not move: a refusal is final
-- (a declined row matches no update), the row is kept for the owner to
-- re-plan around, and declining still ends access — `on_trip` only
-- counts pending and accepted.

drop policy "invitees answer once" on public.trip_invites;

create policy "invitees answer, and the answered may leave" on public.trip_invites
  for update
  using (auth.uid() = invitee_id and status in ('pending', 'accepted'))
  with check (auth.uid() = invitee_id and status in ('accepted', 'declined'));
