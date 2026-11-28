-- Who attached a photo (`20261128123000_checkin_photo_uploader.sql`):
-- null for the owner's own; an editor's name on a row that is still the
-- owner's by every rule the table had; readable to whoever may read the
-- visit; not a client's to read; and null again when the editor's account
-- goes, the photo staying.
--
--   f7…0a  the visitor   f7…0b  a friend   f7…0e  an editor
--   f7…a1  a place       f7…c1  a visit shared with friends

grant usage on schema public, storage to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f7ec0000-0000-0000-0000-00000000000a', 'up-a@x.com', '{"handle":"upa"}'),
 ('f7ec0000-0000-0000-0000-00000000000b', 'up-b@x.com', '{"handle":"upb"}'),
 ('f7ec0000-0000-0000-0000-00000000000e', 'up-e@x.com', '{"handle":"upe"}');
insert into public.places (id, slug, city_id, is_published, review_status, name_en, categories) values
 ('f7ec0000-0000-0000-0000-0000000000a1', 'up-cong', 'hanoi', true, 'approved', 'Cong', '{cafes}');
insert into public.friendships (requester, addressee, status) values
 ('f7ec0000-0000-0000-0000-00000000000a', 'f7ec0000-0000-0000-0000-00000000000b', 'accepted');
insert into public.checkins (id, user_id, place_id, city_id, audience) values
 ('f7ec0000-0000-0000-0000-0000000000c1', 'f7ec0000-0000-0000-0000-00000000000a', 'f7ec0000-0000-0000-0000-0000000000a1', 'hanoi', 'friends');

create function public._up_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._up_why(text) to rls_client, anon;

create function public._up_reads(as_user text, path text) returns boolean
language plpgsql set search_path = public as $$
declare ok boolean;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  ok := public.checkin_photo_readable(path);
  reset role;
  return ok;
end $$;

do $$
declare
  a constant text := 'f7ec0000-0000-0000-0000-00000000000a';
  b constant text := 'f7ec0000-0000-0000-0000-00000000000b';
  e constant text := 'f7ec0000-0000-0000-0000-00000000000e';
  visit constant text := 'f7ec0000-0000-0000-0000-0000000000c1';
  own constant text := 'f7ec0000-0000-0000-0000-0000000000f1';
  desk constant text := 'f7ec0000-0000-0000-0000-0000000000f2';
  desk_path text; why text; who uuid; n int;
begin
  desk_path := a || '/' || visit || '/' || desk || '.jpg';

  -- ── the owner's own: nobody named ──
  insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes)
  values (own::uuid, visit::uuid, a::uuid, 1, a || '/' || visit || '/' || own || '.jpg', 1200, 900, 150000);
  select uploaded_by into who from public.checkin_photos where id = own::uuid;
  assert who is null, 'a photo its owner uploaded names nobody';

  -- ── an editor's: the owner's row, the editor's name ──
  insert into public.checkin_photos (id, checkin_id, user_id, uploaded_by, position, path, width, height, bytes)
  values (desk::uuid, visit::uuid, a::uuid, e::uuid, 2, desk_path, 1200, 900, 150000);
  select uploaded_by into who from public.checkin_photos where id = desk::uuid;
  assert who = e::uuid, 'a photo an editor attached names the editor';

  -- Still the owner's by the caps: it is the second of the visit's three.
  assert public.checkin_photo_slot(a::uuid, visit::uuid) = 3, 'an editor''s photo takes one of the visit''s three places';

  -- The editor is not made the owner by it: a row in the editor's name
  -- on this visit is refused as it always was.
  why := public._up_why(format(
    'insert into public.checkin_photos (id, checkin_id, user_id, uploaded_by, position, path, width, height, bytes) values (%L, %L, %L, %L, 3, %L, 10, 10, 10)',
    'f7ec0000-0000-0000-0000-0000000000f3', visit, e, e, e || '/' || visit || '/f7ec0000-0000-0000-0000-0000000000f3.jpg'));
  assert why = 'photo:not_yours', format('a row owned by the editor on somebody''s visit: %s', why);

  -- ── who reads it: whoever may read the visit ──
  assert public._up_reads(a, desk_path), 'the owner reads a photo the desk attached';
  assert public._up_reads(b, desk_path), 'a friend reads it, the visit being shared with friends';
  assert not public._up_reads(e, desk_path), 'the editor, no friend of the owner, reads it no more than a stranger';

  -- ── which editor is not a client's to read ──
  set local role rls_client;
  perform set_config('test.uid', a, true);
  why := public._up_why('select uploaded_by from public.checkin_photos');
  select count(*) into n from public.checkin_photos where id = desk::uuid;
  reset role;
  assert why like 'permission denied%', format('uploaded_by is closed to its owner too: %s', why);
  assert n = 1, 'and the owner still reads the row by its other columns';

  -- ── the editor's account goes: the photo stays, and names nobody ──
  delete from auth.users where id = e::uuid;
  select count(*), max(uploaded_by::text) into n, why from public.checkin_photos where id = desk::uuid;
  assert n = 1, 'the photo outlives the editor who attached it';
  assert why is null, 'and reads as the owner''s own from then on';
end $$;

drop function public._up_why(text);
drop function public._up_reads(text, text);
