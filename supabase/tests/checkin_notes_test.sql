-- A check-in's note and who sees it (`20261124120000_checkin_notes.sql`):
-- the owner writes both and only those; nobody else reads a visit yet.
-- Runs on the rows `checkins_test.sql` left: the visitor's
-- (e1000000-…-0001) at ck-cong (…-00a1) and elsewhere.
do $$
declare n int; refused int := 0; aud text; nt text;
begin
  -- Rows written before the columns: no note, the question unanswered.
  select count(*) into n from public.checkins where note is not null or audience is not null;
  assert n = 0, format('an old visit has no note and no answer, saw %s with one', n);

  set local role rls_client;
  set local test.uid = 'e1000000-0000-0000-0000-000000000001';
  update public.checkins set note = 'Crisp sourdough.', audience = 'friends'
  where place_id = 'e1000000-0000-0000-0000-0000000000a1';
  select note, audience into nt, aud from public.checkins
  where place_id = 'e1000000-0000-0000-0000-0000000000a1' limit 1;
  assert nt = 'Crisp sourdough.' and aud = 'friends', format('the owner writes the note and the answer, read %s / %s', nt, aud);

  -- No third answer, no blank note, no essay.
  begin
    update public.checkins set audience = 'public' where user_id = 'e1000000-0000-0000-0000-000000000001';
  exception when check_violation then refused := refused + 1;
  end;
  begin
    update public.checkins set note = '   ' where user_id = 'e1000000-0000-0000-0000-000000000001';
  exception when check_violation then refused := refused + 1;
  end;
  begin
    update public.checkins set note = repeat('a', 281) where user_id = 'e1000000-0000-0000-0000-000000000001';
  exception when check_violation then refused := refused + 1;
  end;
  assert refused = 3, format('public, a blank note and 281 characters are each refused, %s were', refused);

  -- The visit itself is not edited: only taken back.
  refused := 0;
  begin
    update public.checkins set at = now() - interval '2 hours' where user_id = 'e1000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    update public.checkins set place_id = 'e1000000-0000-0000-0000-0000000000a2' where user_id = 'e1000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then refused := refused + 1;
  end;
  assert refused = 2, format('the instant and the place cannot be rewritten, %s refusals', refused);

  -- Somebody else: reads nothing still, 'friends' or not, and writes nothing.
  set local test.uid = 'e1000000-0000-0000-0000-000000000002';
  select count(*) into n from public.checkins;
  assert n = 0, format('nobody else reads a visit yet, whatever its answer; saw %s', n);
  update public.checkins set note = 'mine now';
  reset role;
  select count(*) into n from public.checkins where note = 'mine now';
  assert n = 0, 'somebody else''s update lands on no row';
end $$;
