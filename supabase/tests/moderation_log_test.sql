-- The desk's record: every moderation act writes a line, in the same
-- transaction as the act, and nobody can write, change or remove one.

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.moderation_log to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d4000000-0000-0000-0000-00000000000a', 'owner4@x.com', '{"handle":"owner4","full_name":"Owner","bio":"Hi"}'),
 ('d4000000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"desk4"}');
insert into public.places (id, slug, is_published, review_status)
values ('d4000000-0000-0000-0000-0000000000f1', 'log-place', true, 'approved');
insert into public.collections (id, slug, owner_id)
values ('d4000000-0000-0000-0000-0000000000c1', 'log-list', 'd4000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'd4000000-0000-0000-0000-0000000000c1';
delete from public.moderation_log;

-- A refused act leaves no line; an act leaves exactly one, naming who.
do $$
declare n int; r record;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000a';
  set local test.jwt = '{"email": "owner4@x.com"}';
  begin
    perform public.moderate_collection('d4000000-0000-0000-0000-0000000000c1', true);
    assert false, 'a non-editor moderated a list';
  exception when raise_exception then null;
  end;
  reset role;
  select count(*) into n from public.moderation_log;
  assert n = 0, 'a refused act was logged';

  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "ANHLT1983@gmail.com"}';
  perform public.moderate_collection('d4000000-0000-0000-0000-0000000000c1', true);
  perform public.moderate_profile('d4000000-0000-0000-0000-00000000000a', clear_bio => true, clear_avatar => true);
  reset role;

  select count(*) into n from public.moderation_log;
  assert n = 2, format('expected 2 lines, found %s', n);
  select * into r from public.moderation_log where action = 'hide_collection';
  assert r.actor = 'd4000000-0000-0000-0000-00000000000e', 'the hide names the wrong actor';
  assert r.actor_email = 'anhlt1983@gmail.com', 'the actor email is not normalised';
  assert r.target_id = 'd4000000-0000-0000-0000-0000000000c1', 'the hide names the wrong list';
  select * into r from public.moderation_log where action = 'clear_profile';
  assert r.detail = '{"bio": true, "avatar": true, "name": false}'::jsonb,
    format('clear_profile recorded %s', r.detail);
end $$;

-- Readers see nothing; the desk sees the lines and still cannot touch them.
do $$
declare seen int; changed int := 0; refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000a';
  set local test.jwt = '{"email": "owner4@x.com"}';
  select count(*) into seen from public.moderation_log;
  assert seen = 0, 'a reader can read the moderation log';
  reset role;

  set local role rls_client;
  set local test.uid = 'd4000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  select count(*) into seen from public.moderation_log;
  begin
    insert into public.moderation_log (actor, actor_email, action, target_id)
    values ('d4000000-0000-0000-0000-00000000000e', 'x', 'suspend', 'd4000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  with u as (update public.moderation_log set actor_email = 'someone-else' returning 1)
  select count(*) into changed from u;
  with d as (delete from public.moderation_log returning 1)
  select changed + count(*) into changed from d;
  reset role;

  assert seen = 2, format('the desk sees %s lines, not 2', seen);
  assert refused = 1, 'the desk wrote a line by hand';
  assert changed = 0, 'the desk rewrote or removed a line';
end $$;

-- Leave nothing behind.
delete from public.moderation_log;
delete from public.collections where id = 'd4000000-0000-0000-0000-0000000000c1';
delete from public.places where id = 'd4000000-0000-0000-0000-0000000000f1';
delete from auth.users where id in ('d4000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000e');

select 'all moderation log checks passed' as result;
