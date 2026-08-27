-- Who can see somebody else's evening, and who cannot.
--
-- Every other file in this directory asserts policies by reading their
-- expressions back out of `pg_policy`. That is a real check — it catches a
-- policy that stopped naming the caller — but it proves nothing about what
-- a client actually gets, and this migration is the first one in the schema
-- that deliberately widens a read. `_harness.sql` says as much: "nothing
-- here exercises RLS as a real client would".
--
-- So this file does. It creates a role that is not the table owner and not
-- a superuser — the position PostgREST puts a signed-in reader in — and
-- then asks the questions a client would ask, as three different people.
-- The static checks are still here at the bottom; they guard the shape.
-- These guard the behaviour.
--
-- It earned its keep on the first run: the insert policy counted its own
-- table to enforce the cap, which Postgres answers with "infinite
-- recursion detected", and `trips` reading `trip_invites` while
-- `trip_invites` read `trips` was the same fault wearing a second face.
-- Neither is visible in the policy text, which is all the other files
-- here read.
--
-- Accounts, from the ones the runner already made:
--   1111… owner      plans the trip
--   2222… friend     an accepted friend of the owner — invited
--   3333… stranger   no friendship, no invitation

-- ── a client that is not the owner of the tables ─────────────────────
--
-- A separate role is what makes this mean anything. RLS does not apply to
-- the table owner, so every assertion below would pass by accident if it
-- ran as the user the runner connects with. `rls_client` owns nothing and
-- is not a superuser, which is exactly the position PostgREST puts a
-- signed-in reader in; the grants mirror what `authenticated` carries on a
-- real project.
--
-- Deliberately NOT `force row level security`. Forcing would subject the
-- table owner to the policies too — including the owner of the
-- security-definer functions the policies call to break their own
-- recursion — so the reads those functions exist to make would start
-- failing here and nowhere else. A test that is stricter than production
-- in a way production can never be is a test that fails for the wrong
-- reason.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rls_client') then
    create role rls_client nologin;
  end if;
end $$;

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.trips, public.trip_stops,
  public.trip_invites, public.friendships to rls_client;
grant select on public.places, public.cities to rls_client;
grant execute on function public.trip_crew_counts(uuid[]) to rls_client;
-- The two the policies call to break their own recursion. On a real
-- project `authenticated` holds these; here the client role has to be
-- given them explicitly or every policy that calls one denies the read.
grant execute on function public.on_trip(uuid) to rls_client;
grant execute on function public.trip_invite_count(uuid) to rls_client;

-- ── the evening in question ──────────────────────────────────────────

insert into public.places (slug, city_id, is_published, review_status, categories)
values ('invite-cafe', 'hanoi', true, 'approved', '{cafes}')
on conflict (slug) do nothing;

insert into public.trips (id, owner_id, city_id, title, company, categories, day, when_part)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'hanoi', 'Cà phê rồi hẻm',
        'friends', '{cafes}', date '2026-08-28', 'evening');

insert into public.trip_stops (trip_id, place_id, sort_order, arrive_min, dwell_min)
select 'bbbbbbbb-0000-0000-0000-000000000001', id, 0, 17 * 60, 60
  from public.places where slug = 'invite-cafe';

-- The owner and 2222… are friends. 3333… is nobody to anybody.
insert into public.friendships (requester, addressee, status)
values ('11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'accepted')
on conflict do nothing;

-- ── sending ──────────────────────────────────────────────────────────

-- A stranger is not invitable, and the refusal comes from the database
-- rather than from the screen that chose not to list them. This is the
-- whole safety story: without it, an anon key and a user id would be
-- enough to put a row in somebody's invitations.
do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  begin
    insert into public.trip_invites (trip_id, invitee_id, inviter_id)
    values ('bbbbbbbb-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111');
    assert false, 'a stranger could be invited; the friend check is not holding';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Nor may somebody who is not the owner invite into the owner's trip,
-- even to a friend of their own.
do $$
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  begin
    insert into public.trip_invites (trip_id, invitee_id, inviter_id)
    values ('bbbbbbbb-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222');
    assert false, 'a non-owner added somebody to a trip they do not own';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- The real one. An owner, a friend, as themselves.
do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.trip_invites (trip_id, invitee_id, inviter_id)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

-- ── reading, while it is unanswered ──────────────────────────────────
--
-- The answer screen prints the whole itinerary before the answer is
-- given. A plan you must accept sight unseen is not an invitation.
do $$
declare trips_seen int; stops_seen int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select count(*) into trips_seen from public.trips
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  select count(*) into stops_seen from public.trip_stops
   where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  reset role;
  assert trips_seen = 1, 'a pending invitee cannot read the trip they are being asked to';
  assert stops_seen = 1, 'a pending invitee cannot read the stops';
end $$;

-- Nobody else, though. A trip is private and an invitation is the only
-- door this migration cut into it.
do $$
declare trips_seen int; stops_seen int; invites_seen int;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  select count(*) into trips_seen from public.trips;
  select count(*) into stops_seen from public.trip_stops;
  select count(*) into invites_seen from public.trip_invites;
  reset role;
  assert trips_seen = 0, format('an uninvited account can read %s trips', trips_seen);
  assert stops_seen = 0, format('an uninvited account can read %s stops', stops_seen);
  assert invites_seen = 0, format('an uninvited account can read %s invitations', invites_seen);
end $$;

-- ── the plan stays the owner's ───────────────────────────────────────
--
-- The screens say "Times and stops stay yours to edit". This is the
-- sentence being true rather than being copy: there is no update policy
-- for an invitee, so the statement reaches no rows.
do $$
declare moved int; dropped int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (
    update public.trips set title = 'mine now'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1
  ) select count(*) into moved from u;
  with u as (
    update public.trip_stops set arrive_min = 0
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1
  ) select count(*) into dropped from u;
  reset role;
  assert moved = 0, 'an invitee edited the trip';
  assert dropped = 0, 'an invitee moved a stop';
end $$;

do $$
declare gone int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with d as (
    delete from public.trips
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1
  ) select count(*) into gone from d;
  reset role;
  assert gone = 0, 'an invitee deleted somebody else''s trip';
end $$;

-- ── answering ────────────────────────────────────────────────────────

-- Not on somebody else's behalf.
do $$
declare answered int;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  with u as (
    update public.trip_invites set status = 'accepted'
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1
  ) select count(*) into answered from u;
  reset role;
  assert answered = 0, 'a third party answered an invitation';
end $$;

-- And not with a word that is not an answer.
do $$
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  begin
    update public.trip_invites set status = 'maybe'
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       and invitee_id = '22222222-2222-2222-2222-222222222222';
    assert false, 'status took a value that is not one of the two answers';
  exception when check_violation or insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Yes.
do $$
declare answered int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (
    update public.trip_invites set status = 'accepted', responded_at = now()
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       and invitee_id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into answered from u;
  reset role;
  assert answered = 1, 'the invitee could not accept';
end $$;

-- An accepted invitee still reads the plan — this is the row that puts
-- the evening in their own Trips.
do $$
declare trips_seen int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select count(*) into trips_seen from public.trips
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  reset role;
  assert trips_seen = 1, 'accepting lost the invitee their view of the trip';
end $$;

-- ── withdrawing ──────────────────────────────────────────────────────
--
-- Only while unanswered. Somebody who has already said yes has put the
-- evening in their own Trips; taking it back is a different act with a
-- different weight, and nothing asks for it yet.
do $$
declare gone int;
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  with d as (
    delete from public.trip_invites
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       and invitee_id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into gone from d;
  reset role;
  assert gone = 0, 'an accepted invitation was withdrawn';
end $$;

-- ── the refusal ──────────────────────────────────────────────────────
--
-- The row remembers the answer; it does not keep the access. Set up a
-- second invitee by hand (as the owner would), decline it, and check both.
insert into public.friendships (requester, addressee, status)
values ('11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333', 'accepted')
on conflict do nothing;

do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.trip_invites (trip_id, invitee_id, inviter_id)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

do $$
declare trips_seen int; row_kept int;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  update public.trip_invites set status = 'declined', responded_at = now()
   where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     and invitee_id = '33333333-3333-3333-3333-333333333333';
  select count(*) into trips_seen from public.trips
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  reset role;
  assert trips_seen = 0, 'declining left the plan readable';

  -- The owner still learns the answer. This is why a refusal is a status
  -- and not a delete, unlike a declined friend request.
  select count(*) into row_kept from public.trip_invites
   where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     and invitee_id = '33333333-3333-3333-3333-333333333333'
     and status = 'declined';
  assert row_kept = 1, 'the refusal was not recorded for the owner to see';
end $$;

-- ── the count an invitee is allowed ──────────────────────────────────
--
-- "Lan Phương and 1 other — you'd be 3 in all." The number without the
-- rows behind it.
do $$
declare acc int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  select accepted into acc from public.trip_crew_counts(
    array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);
  reset role;
  assert acc = 1, format('the crew count came back %s', acc);
end $$;

-- And nothing for somebody who is on neither side of it. No row, rather
-- than a zero: a zero would confirm the trip exists.
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = '33333333-3333-3333-3333-333333333333';
  select count(*) into n from public.trip_crew_counts(
    array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);
  reset role;
  assert n = 0, 'a declined invitee still gets a headcount for the trip';
end $$;

-- ── leaving ──────────────────────────────────────────────────────────
--
-- This file used to assert the opposite here: "an answered invitation
-- could be answered again" was required to count zero. The owner's device
-- found who that pin forgets — a guest who said yes and wants out had no
-- move, so the app's delete button reached for the trip row, matched
-- nothing, and the evening "came back". Leaving is declining late, and
-- the update policy now says so. A fresh trip, so the crew arithmetic
-- above keeps its numbers.
insert into public.trips (id, owner_id, city_id, title, company, categories, day, when_part)
values ('bbbbbbbb-0000-0000-0000-000000000009',
        '11111111-1111-1111-1111-111111111111', 'hanoi', 'Tối thử rời đi',
        'friends', '{cafes}', date '2026-08-29', 'evening');

do $$
begin
  set local role rls_client;
  set local test.uid = '11111111-1111-1111-1111-111111111111';
  insert into public.trip_invites (trip_id, invitee_id, inviter_id)
  values ('bbbbbbbb-0000-0000-0000-000000000009',
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

-- Say yes, then step out. Both moves are the invitee's own, and stepping
-- out ends the view the yes had opened.
do $$
declare answered int; stepped_out int; trips_seen int; row_kept int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (
    update public.trip_invites set status = 'accepted', responded_at = now()
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000009'
       and invitee_id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into answered from u;
  with u as (
    update public.trip_invites set status = 'declined', responded_at = now()
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000009'
       and invitee_id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into stepped_out from u;
  select count(*) into trips_seen from public.trips
   where id = 'bbbbbbbb-0000-0000-0000-000000000009';
  reset role;
  assert answered = 1, 'the invitee could not accept the leaving-test trip';
  assert stepped_out = 1, 'an accepted invitee could not leave';
  assert trips_seen = 0, 'leaving left the plan readable';

  -- The owner keeps the answer — re-planning around a refusal needs it.
  select count(*) into row_kept from public.trip_invites
   where trip_id = 'bbbbbbbb-0000-0000-0000-000000000009'
     and invitee_id = '22222222-2222-2222-2222-222222222222'
     and status = 'declined';
  assert row_kept = 1, 'leaving erased the row instead of answering it';
end $$;

-- And the door does not swing back: a refusal is still final, whether it
-- was the first answer or the late one.
do $$
declare again int;
begin
  set local role rls_client;
  set local test.uid = '22222222-2222-2222-2222-222222222222';
  with u as (
    update public.trip_invites set status = 'accepted'
     where trip_id = 'bbbbbbbb-0000-0000-0000-000000000009'
       and invitee_id = '22222222-2222-2222-2222-222222222222' returning 1
  ) select count(*) into again from u;
  reset role;
  assert again = 0, 'a declined invitation could be re-answered';
end $$;

-- ── shape ────────────────────────────────────────────────────────────

-- One row per (trip, person). Inviting the same friend twice is the same
-- invitation, not a second one.
do $$
declare cols text;
begin
  select string_agg(a.attname, ',' order by a.attname) into cols
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.trip_invites'::regclass and i.indisprimary;
  assert cols = 'invitee_id,trip_id', format('trip_invites key is (%s)', cols);
end $$;

-- An invitation goes when its trip goes.
do $$
declare left_over int;
begin
  delete from public.trips where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  select count(*) into left_over from public.trip_invites
   where trip_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  assert left_over = 0, format('%s invitations outlived their trip', left_over);
end $$;

-- ── policy shape, the static half ────────────────────────────────────

-- Every policy on the three tables is scoped to the caller. The trips test
-- makes this assertion too, and it still holds there because it runs
-- before this migration widens anything.
--
-- Two of the policies here reach the caller through `on_trip` rather than
-- naming `auth.uid()` themselves, so the literal text check the other
-- files use would fail on them — and loosening it to let any function
-- through would be a hole the size of the next function somebody writes.
-- Instead the indirection is named: a policy may go through exactly these
-- two, and the block below proves both of them are themselves pinned to
-- `auth.uid()`. That is stricter than the original, not weaker.
do $$
declare bad text;
begin
  select string_agg(format('%s on %s', polname, polrelid::regclass), ', ') into bad
    from pg_policy
   where polrelid in ('public.trips'::regclass, 'public.trip_stops'::regclass,
                      'public.trip_invites'::regclass)
     and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid))
         not like '%auth.uid()%'
     and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid))
         not similar to '%(on_trip|trip_invite_count)%';
  assert bad is null, format('these do not scope to the caller: %s', bad);
end $$;

-- And the indirection itself. If either function ever stops asking about
-- the caller, the two policies that lean on it become "anybody invited"
-- rather than "you were invited", and nothing else in this file would
-- notice.
do $$
declare body text;
begin
  select prosrc into body from pg_proc
   where oid = 'public.on_trip(uuid)'::regprocedure;
  assert body like '%auth.uid()%', 'on_trip stopped asking about the caller';

  select prosrc into body from pg_proc
   where oid = 'public.trip_invite_count(uuid)'::regprocedure;
  assert body like '%auth.uid()%', 'trip_invite_count stopped asking about the caller';
end $$;

-- Both are security definer on purpose — that is what breaks the
-- recursion — which makes their exposure the thing to hold down. Neither
-- may be reachable with the anon key.
do $$
begin
  assert not has_function_privilege('anon', 'public.on_trip(uuid)', 'execute'),
    'on_trip is callable by anon';
  assert not has_function_privilege('anon', 'public.trip_invite_count(uuid)', 'execute'),
    'trip_invite_count is callable by anon';
end $$;

-- Widening the read is the only thing this migration was allowed to do.
-- If a policy ever appears that lets a non-owner write, it will be named
-- here — the count is of write policies on trips and trip_stops that do
-- not go through `owner_id`.
do $$
declare n int;
begin
  select count(*) into n from pg_policy
   where polrelid in ('public.trips'::regclass, 'public.trip_stops'::regclass)
     and polcmd <> 'r'
     and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid))
         not like '%owner_id%';
  assert n = 0, format('%s write policies on a trip no longer go through its owner', n);
end $$;

-- The function is not reachable with the anon key. Same exposure rule the
-- other security-definer functions in this schema follow.
do $$
begin
  assert not has_function_privilege('anon', 'public.trip_crew_counts(uuid[])', 'execute'),
    'trip_crew_counts is callable by anon';
  assert has_function_privilege('authenticated', 'public.trip_crew_counts(uuid[])', 'execute'),
    'trip_crew_counts is not callable by a signed-in reader';
end $$;

do $$
declare on_invites boolean;
begin
  select relrowsecurity into on_invites from pg_class where oid = 'public.trip_invites'::regclass;
  assert on_invites, 'row level security is off on trip_invites';
end $$;

select 'all trip invite checks passed' as result;
