-- What `prune-checkin-photos` is handed (`20261125000000_checkin_photo_orphans.sql`):
-- files in `checkin-photos` no row names, an hour old or more, nothing of
-- another bucket; and the bucket's size. Runs after `checkin_photos_test`.

do $$
declare
  a constant text := 'f3ec0000-0000-0000-0000-00000000000a';
  v constant text := 'f3ec0000-0000-0000-0000-0000000000c1';
  named text; got text[]; n bigint; b bigint; who bigint; why text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (a::uuid, 'or-a@x.com', '{"handle":"ora"}');
  insert into public.places (id, slug, city_id, is_published, review_status)
  values ('f3ec0000-0000-0000-0000-0000000000a1', 'or-cong', 'hanoi', true, 'approved');
  insert into public.checkins (id, user_id, place_id, city_id) values (v::uuid, a::uuid, 'f3ec0000-0000-0000-0000-0000000000a1', 'hanoi');

  -- One named by a row, two orphans (old and fresh), one in another bucket.
  named := a || '/' || v || '/f3ec0000-0000-0000-0000-0000000000e1.jpg';
  insert into public.checkin_photos (id, checkin_id, user_id, position, path, width, height, bytes)
  values ('f3ec0000-0000-0000-0000-0000000000e1', v::uuid, a::uuid, 1, named, 10, 10, 10);
  insert into storage.objects (bucket_id, name, owner, created_at, metadata) values
    ('checkin-photos', named, a::uuid, now() - interval '3 hours', '{"size": 1000}'),
    ('checkin-photos', a || '/' || v || '/f3ec0000-0000-0000-0000-0000000000e2.jpg', a::uuid, now() - interval '3 hours', '{"size": 2000}'),
    ('checkin-photos', a || '/' || v || '/f3ec0000-0000-0000-0000-0000000000e3.jpg', a::uuid, now() - interval '5 minutes', '{"size": 3000}'),
    ('avatars', a || '/avatar.jpg', a::uuid, now() - interval '3 hours', '{"size": 500}');

  select array_agg(name order by name) into got
    from public.checkin_photo_orphans(100)
   where name like a || '%';
  assert got = array[a || '/' || v || '/f3ec0000-0000-0000-0000-0000000000e2.jpg'],
    format('only the old orphan of this bucket, saw %s', got);

  -- The limit holds, and is held to one at least.
  select count(*) into n from public.checkin_photo_orphans(0);
  assert n <= 1, format('a limit of nothing is one, saw %s', n);

  select files, bytes, accounts into n, b, who from public.checkin_photos_usage();
  assert n >= 3 and b >= 6000 and who >= 1, format('the bucket''s size: %s files, %s bytes, %s accounts', n, b, who);

  -- Neither is a client's to call.
  set local role rls_client;
  perform set_config('test.uid', a, true);
  begin
    perform public.checkin_photo_orphans(10);
    why := 'ok';
  exception when others then why := sqlerrm;
  end;
  reset role;
  assert why like 'permission denied%', format('the orphans are not a client''s to list: %s', why);
  set local role rls_client;
  begin
    perform public.checkin_photos_usage();
    why := 'ok';
  exception when others then why := sqlerrm;
  end;
  reset role;
  assert why like 'permission denied%', format('nor the size: %s', why);
end $$;
