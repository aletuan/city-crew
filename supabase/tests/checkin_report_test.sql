-- A check-in reported whole (20261126090000): reported by somebody else
-- and never by its owner; shown to the desk with its photos and the
-- state of each part; its note or the whole of it hidden by the desk
-- alone, a line each, and put back; and what a hidden part leaves a
-- stranger and its owner.
--
--   f6…0a  the visitor   f6…0c  a stranger, the reporter   f6…0e  the desk
--   f6…c1  a public visit with a note and two photos (f6…b1, f6…b2)

grant usage on schema public, storage to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f6de0000-0000-0000-0000-00000000000a', 'cr-a@x.com', '{"handle":"crowner"}'),
 ('f6de0000-0000-0000-0000-00000000000c', 'cr-c@x.com', '{"handle":"crreporter"}'),
 ('f6de0000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"crdesk"}')
on conflict (id) do nothing;
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f6de0000-0000-0000-0000-0000000000a1', 'cr-omu', 'hanoi', true, 'approved', 'Omu Desk', '{eats}');
insert into public.checkins (id, user_id, place_id, city_id, audience, note) values
 ('f6de0000-0000-0000-0000-0000000000c1', 'f6de0000-0000-0000-0000-00000000000a', 'f6de0000-0000-0000-0000-0000000000a1', 'hanoi', 'public', 'buy my course');
insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes) values
 ('f6de0000-0000-0000-0000-0000000000b1', 'f6de0000-0000-0000-0000-0000000000c1', 'f6de0000-0000-0000-0000-00000000000a', 1,
  'f6de0000-0000-0000-0000-00000000000a/f6de0000-0000-0000-0000-0000000000c1/f6de0000-0000-0000-0000-0000000000b1.jpg', 10, 10, 1),
 ('f6de0000-0000-0000-0000-0000000000b2', 'f6de0000-0000-0000-0000-0000000000c1', 'f6de0000-0000-0000-0000-00000000000a', 2,
  'f6de0000-0000-0000-0000-00000000000a/f6de0000-0000-0000-0000-0000000000c1/f6de0000-0000-0000-0000-0000000000b2.jpg', 10, 10, 1);
delete from public.reports;
delete from public.moderation_log;

create function public._cr_as(who text) returns void
language plpgsql set search_path = public as $$
begin
  perform set_config('test.uid', 'f6de0000-0000-0000-0000-00000000000' || who, true);
  perform set_config('test.jwt', case who when 'e' then '{"email": "anhlt1983@gmail.com"}'
                                          else format('{"email": "cr-%s@x.com"}', who) end, true);
end $$;
grant execute on function public._cr_as(text) to rls_client;

-- The visitor's page as one reader gets it: "note|hidden|note_hidden|photos".
create function public._cr_page(who text) returns text
language plpgsql set search_path = public as $$
declare out text;
begin
  set local role rls_client;
  perform public._cr_as(who);
  select coalesce(string_agg(coalesce(r.note, '-') || '|' || r.hidden || '|' || r.note_hidden
                             || '|' || jsonb_array_length(r.photos), ' ; '), '')
    into out
    from public.person_checkins('f6de0000-0000-0000-0000-00000000000a'::uuid) r;
  reset role;
  return out;
end $$;

create function public._cr_photo(who text, path text) returns boolean
language plpgsql set search_path = public as $$
declare ok boolean;
begin
  set local role rls_client;
  perform public._cr_as(who);
  ok := public.checkin_photo_readable(path);
  reset role;
  return ok;
end $$;

create function public._cr_why(who text, q text) returns text
language plpgsql set search_path = public as $$
begin
  set local role rls_client;
  perform public._cr_as(who);
  execute q;
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlerrm;
end $$;

-- ── a report: somebody else's, never your own ──
do $$
declare ok boolean;
begin
  set local role rls_client;
  perform public._cr_as('a');
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values ('f6de0000-0000-0000-0000-00000000000a', 'checkin', 'f6de0000-0000-0000-0000-0000000000c1', 'spam');
    ok := true;
  exception when insufficient_privilege then
    assert sqlerrm like 'new row violates row-level security policy%', sqlerrm;
    ok := false;
  end;
  assert not ok, 'an owner reported their own visit';
  perform public._cr_as('c');
  insert into public.reports (reporter, kind, target_id, reason, note)
  values ('f6de0000-0000-0000-0000-00000000000c', 'checkin', 'f6de0000-0000-0000-0000-0000000000c1', 'spam', 'selling');
  reset role;
  assert (select count(*) from public.reports where kind = 'checkin') = 1, 'the report was filed';
end $$;

-- ── the queue: the place, the note, the owner, the photos, the state ──
do $$
declare q record; n int;
begin
  set local role rls_client;
  perform public._cr_as('e');
  select * into q from public.reports_queue() where kind = 'checkin';
  reset role;
  assert q.title = 'Omu Desk' and q.body = 'buy my course' and q.owner_handle = 'crowner'
     and q.owner_id = 'f6de0000-0000-0000-0000-00000000000a'
     and jsonb_array_length(q.visit_photos) = 2
     and q.visit_photos -> 0 ->> 'path' like '%/f6de0000-0000-0000-0000-0000000000b1.jpg'
     and (q.visit_photos -> 0 ->> 'hidden')::boolean = false
     and q.visit_hidden = false and q.visit_note_hidden = false and q.visit_audience = 'public',
    format('the queue said %s', row_to_json(q));
  set local role rls_client;
  perform public._cr_as('c');
  select count(*) into n from public.reports_queue();
  reset role;
  assert n = 0, 'a reader read the queue';
end $$;

-- ── the note ──
do $$
declare got text; why text; n int;
begin
  why := public._cr_why('c', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'note', true)$q$);
  assert why = 'not an editor', format('a reader hid a note: %s', why);
  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'everything', true)$q$);
  assert why = 'checkin:part', format('a part that is not one: %s', why);

  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'note', true)$q$);
  assert why = 'ok', why;
  -- Asked twice, one act.
  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'note', true)$q$);
  select count(*) into n from public.moderation_log where action = 'hide_checkin_note';
  assert n = 1, format('one hiding, one line: %s', n);

  got := public._cr_page('c');
  assert got = '-|false|false|2', format('the stranger sees the visit and its photos, not the note: %s', got);
  got := public._cr_page('a');
  assert got = 'buy my course|false|true|2', format('the owner sees their note, marked hidden: %s', got);

  -- Rewriting it does not bring it back.
  why := public._cr_why('a', $q$update public.checkins set note = 'a better note' where id = 'f6de0000-0000-0000-0000-0000000000c1'$q$);
  assert why = 'ok', why;
  got := public._cr_page('c');
  assert got = '-|false|false|2', format('an edited note stays hidden: %s', got);
  -- Nor can its owner clear the mark.
  why := public._cr_why('a', $q$update public.checkins set note_hidden_at = null where id = 'f6de0000-0000-0000-0000-0000000000c1'$q$);
  assert why like 'permission denied%', format('the owner cleared the desk''s mark: %s', why);

  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'note', false)$q$);
  got := public._cr_page('c');
  assert got = 'a better note|false|false|2', format('put back: %s', got);
  select count(*) into n from public.moderation_log where action = 'show_checkin_note';
  assert n = 1, 'putting back is logged';
end $$;

-- ── the whole visit ──
do $$
declare got text; why text; d jsonb;
  p1 constant text := 'f6de0000-0000-0000-0000-00000000000a/f6de0000-0000-0000-0000-0000000000c1/f6de0000-0000-0000-0000-0000000000b1.jpg';
begin
  assert public._cr_photo('c', p1), 'a stranger reads a photo of the public visit';
  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'visit', true)$q$);
  assert why = 'ok', why;

  got := public._cr_page('c');
  assert got = '', format('the stranger sees nothing of a hidden visit: %s', got);
  assert not public._cr_photo('c', p1), 'nor its photos';
  why := public._cr_why('c', $q$select public.like_checkin('f6de0000-0000-0000-0000-0000000000c1', true)$q$);
  assert why = 'checkin:unseen', format('nor hearts it: %s', why);

  got := public._cr_page('a');
  assert got = 'a better note|true|false|2', format('the owner still has it, marked hidden: %s', got);
  -- Answering it again does not bring it back.
  why := public._cr_why('a', $q$update public.checkins set audience = 'public' where id = 'f6de0000-0000-0000-0000-0000000000c1'$q$);
  got := public._cr_page('c');
  assert got = '', format('answered again, still hidden: %s', got);

  select detail into d from public.moderation_log where action = 'hide_checkin';
  assert d ->> 'owner' = 'f6de0000-0000-0000-0000-00000000000a', format('the log names whose visit: %s', d);

  why := public._cr_why('e', $q$select public.moderate_checkin('f6de0000-0000-0000-0000-0000000000c1', 'visit', false)$q$);
  got := public._cr_page('c');
  assert got = 'a better note|false|false|2', format('put back: %s', got);
  assert (select count(*) from public.moderation_log where action = 'show_checkin') = 1, 'putting back is logged';
end $$;

drop function public._cr_page(text);
drop function public._cr_photo(text, text);
drop function public._cr_why(text, text);
drop function public._cr_as(text);
