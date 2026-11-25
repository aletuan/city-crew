-- A check-in photo at the desk (20261125120000): reported by somebody
-- else and never by its owner; shown to the desk beside the report; hidden
-- and put back by the desk alone, a line each; and a suspension's hiding
-- kept apart from the desk's own.
--
--   f5…0a  the photo's owner     f5…0c  a reporter     f5…0e  the desk
--   f5…c1  the visit, with two photos (f5…b1, f5…b2)

grant usage on schema public, storage to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f5de0000-0000-0000-0000-00000000000a', 'cd-a@x.com', '{"handle":"cdowner"}'),
 ('f5de0000-0000-0000-0000-00000000000c', 'cd-c@x.com', '{"handle":"cdreporter"}'),
 ('f5de0000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"cddesk"}')
on conflict (id) do nothing;
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f5de0000-0000-0000-0000-0000000000a1', 'cd-cong', 'hanoi', true, 'approved', 'Cong Desk', '{cafes}');
insert into public.checkins (id, user_id, place_id, city_id, audience, note) values
 ('f5de0000-0000-0000-0000-0000000000c1', 'f5de0000-0000-0000-0000-00000000000a', 'f5de0000-0000-0000-0000-0000000000a1', 'hanoi', 'friends', 'look at this');
insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
 ('f5de0000-0000-0000-0000-0000000000b1', 'f5de0000-0000-0000-0000-0000000000c1', 'f5de0000-0000-0000-0000-00000000000a', 1,
  'f5de0000-0000-0000-0000-00000000000a/f5de0000-0000-0000-0000-0000000000c1/f5de0000-0000-0000-0000-0000000000b1.jpg', 1200, 900, 1),
 ('f5de0000-0000-0000-0000-0000000000b2', 'f5de0000-0000-0000-0000-0000000000c1', 'f5de0000-0000-0000-0000-00000000000a', 2,
  'f5de0000-0000-0000-0000-00000000000a/f5de0000-0000-0000-0000-0000000000c1/f5de0000-0000-0000-0000-0000000000b2.jpg', 1200, 900, 1);
insert into storage.objects (bucket_id, name, owner) values
 ('checkin-photos', 'f5de0000-0000-0000-0000-00000000000a/f5de0000-0000-0000-0000-0000000000c1/f5de0000-0000-0000-0000-0000000000b1.jpg', 'f5de0000-0000-0000-0000-00000000000a');
delete from public.reports;
delete from public.moderation_log;

-- As somebody: 'a', 'c' or 'e'.
create function public._cd_as(who text) returns void
language plpgsql set search_path = public as $$
begin
  perform set_config('test.uid', 'f5de0000-0000-0000-0000-00000000000' || who, true);
  perform set_config('test.jwt', case who when 'e' then '{"email": "anhlt1983@gmail.com"}'
                                          else format('{"email": "cd-%s@x.com"}', who) end, true);
end $$;
grant execute on function public._cd_as(text) to rls_client;

-- ── a report: somebody else's, never your own ──
do $$
declare ok boolean;
begin
  set local role rls_client;
  perform public._cd_as('a');
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values ('f5de0000-0000-0000-0000-00000000000a', 'checkin_photo', 'f5de0000-0000-0000-0000-0000000000b1', 'spam');
    ok := true;
  -- The policy's own refusal, not some other: a column the check could
  -- not read is the same SQLSTATE.
  exception when insufficient_privilege then
    assert sqlerrm like 'new row violates row-level security policy%', sqlerrm;
    ok := false;
  end;
  assert not ok, 'an owner reported their own photo';
  perform public._cd_as('c');
  insert into public.reports (reporter, kind, target_id, reason, note)
  values ('f5de0000-0000-0000-0000-00000000000c', 'checkin_photo', 'f5de0000-0000-0000-0000-0000000000b1', 'offensive', 'not ok');
  reset role;
  assert (select count(*) from public.reports where kind = 'checkin_photo') = 1, 'the report was filed';
end $$;

-- ── the queue: the place, the note, the owner, the path ──
do $$
declare q record; n int;
begin
  set local role rls_client;
  perform public._cd_as('e');
  select * into q from public.reports_queue() where kind = 'checkin_photo';
  reset role;
  assert q.title = 'Cong Desk' and q.body = 'look at this' and q.owner_handle = 'cdowner'
     and q.owner_id = 'f5de0000-0000-0000-0000-00000000000a'
     and q.photo_path like '%/f5de0000-0000-0000-0000-0000000000b1.jpg' and q.photo_hidden = false,
    format('the queue said %s', row_to_json(q));
  set local role rls_client;
  perform public._cd_as('c');
  select count(*) into n from public.reports_queue();
  reset role;
  assert n = 0, 'a reader read the queue';
end $$;

-- ── the desk reads the bucket; a stranger does not ──
do $$
declare n int;
begin
  set local role rls_client;
  perform public._cd_as('e');
  select count(*) into n from storage.objects where bucket_id = 'checkin-photos' and name like 'f5de%';
  assert n = 1, format('the desk sees %s objects', n);
  perform public._cd_as('c');
  select count(*) into n from storage.objects where bucket_id = 'checkin-photos' and name like 'f5de%';
  reset role;
  assert n = 0, 'a stranger read a friends-only photo';
end $$;

-- ── hiding: the desk's alone, once, a line each way ──
do $$
declare ph record; n int; why text;
begin
  set local role rls_client;
  perform public._cd_as('a');
  begin
    perform public.moderate_checkin_photo('f5de0000-0000-0000-0000-0000000000b1', true);
    why := 'went through';
  exception when raise_exception then why := sqlerrm;
  end;
  assert why = 'not an editor', format('the owner hid as the desk: %s', why);
  perform public._cd_as('e');
  perform public.moderate_checkin_photo('f5de0000-0000-0000-0000-0000000000b1', true);
  perform public.moderate_checkin_photo('f5de0000-0000-0000-0000-0000000000b1', true);
  perform public.moderate_checkin_photo('f5de0000-0000-0000-0000-00000000dead', true);
  reset role;
  select * into ph from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b1';
  assert ph.hidden_at is not null and ph.hidden_for = 'report' and ph.hidden_by = 'f5de0000-0000-0000-0000-00000000000e',
    format('hidden as %s by %s', ph.hidden_for, ph.hidden_by);
  select count(*) into n from public.moderation_log where action = 'hide_checkin_photo';
  assert n = 1, format('%s lines for one hiding asked twice and one of nothing', n);
  assert (select detail from public.moderation_log where action = 'hide_checkin_photo')
       = jsonb_build_object('owner', 'f5de0000-0000-0000-0000-00000000000a', 'checkin', 'f5de0000-0000-0000-0000-0000000000c1'),
    'the line names the owner and the visit';
  set local role rls_client;
  perform public._cd_as('e');
  select count(*) into n from public.reports_queue() where kind = 'checkin_photo' and photo_hidden;
  perform public.moderate_checkin_photo('f5de0000-0000-0000-0000-0000000000b1', false);
  reset role;
  assert n = 1, 'the queue says the photo is hidden';
  select * into ph from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b1';
  assert ph.hidden_at is null and ph.hidden_for is null and ph.hidden_by is null, 'put back whole';
  assert (select count(*) from public.moderation_log where action = 'show_checkin_photo') = 1, 'putting back is logged';
end $$;

-- ── a suspension hides what is shown, and its lifting only that ──
do $$
declare n int; why text;
begin
  -- The desk hid b2 for itself first.
  update public.checkin_photos set hidden_at = now(), hidden_for = 'report' where id = 'f5de0000-0000-0000-0000-0000000000b2';
  n := public.checkin_photos_suspended('f5de0000-0000-0000-0000-00000000000a', true, 'f5de0000-0000-0000-0000-00000000000e');
  assert n = 1, format('a suspension hid %s', n);
  assert (select hidden_for from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b1') = 'suspended', 'b1 hidden for the suspension';
  assert (select hidden_for from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b2') = 'report', 'b2 keeps the desk''s reason';
  n := public.checkin_photos_suspended('f5de0000-0000-0000-0000-00000000000a', false, null);
  assert n = 1, format('a lifting put back %s', n);
  assert (select hidden_at from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b1') is null, 'b1 back';
  assert (select hidden_for from public.checkin_photos where id = 'f5de0000-0000-0000-0000-0000000000b2') = 'report', 'b2 stays hidden';

  -- No client may call it.
  set local role rls_client;
  begin
    perform public.checkin_photos_suspended('f5de0000-0000-0000-0000-00000000000a', true, null);
    why := 'went through';
  exception when insufficient_privilege then why := 'refused';
  end;
  reset role;
  assert why = 'refused', 'a client hid an account''s photos';

  -- A reason without a time, or a time without one, is not a row.
  begin
    update public.checkin_photos set hidden_at = now(), hidden_for = null where id = 'f5de0000-0000-0000-0000-0000000000b1';
    why := 'went through';
  exception when check_violation then why := 'refused';
  end;
  assert why = 'refused', 'hidden without a reason';
  begin
    update public.checkin_photos set hidden_at = now(), hidden_for = 'whim' where id = 'f5de0000-0000-0000-0000-0000000000b1';
    why := 'went through';
  exception when check_violation then why := 'refused';
  end;
  assert why = 'refused', 'hidden for a reason the column does not know';
end $$;

-- The owner still cannot read why.
do $$
declare why text;
begin
  set local role rls_client;
  perform public._cd_as('a');
  begin
    perform hidden_for from public.checkin_photos;
    why := 'read';
  exception when insufficient_privilege then why := 'refused';
  end;
  reset role;
  assert why = 'refused', 'the owner read why a photo was hidden';
end $$;

delete from public.reports;
delete from public.moderation_log;
