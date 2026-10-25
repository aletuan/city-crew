-- Friend suggestions from four sources, and the × that puts one away
-- (`*_friend_suggestions`).
--
-- Exercised as a client: `rls_client` as the reader, as someone the
-- reader was suggested, and as nobody. Every account is named by its last
-- two digits, which say what it did:
--
--   a0  the reader
--   11  liked a public list of the reader's
--   12  copied it
--   13  liked it last, and shares a saved place too — appears once
--   21  has a public list the reader liked
--   22  has a public list the reader copied
--   31  holds two of the reader's places in a public list
--   32  holds one
--   41  holds the place the reader checked in at
--   51  liked it, and is already a friend
--   52  liked it, and blocked the reader
--   53  liked it, and the reader puts them away
--   54  liked the reader's private list only
--   55  holds the reader's place in a private list only
--   56  holds the reader's place that is not live
--   57  has a list the reader liked, gone private since

grant usage on schema public to rls_client;
grant usage on schema public to anon;
grant select, insert, delete on public.suggestion_dismissals to rls_client;

insert into auth.users (id, email, raw_user_meta_data)
select ('e4000000-0000-0000-0000-0000000000' || k)::uuid, 'fs' || k || '@x.com',
       jsonb_build_object('handle', 'fs' || k)
from unnest(array['a0','11','12','13','21','22','31','32','41','51','52','53','54','55','56','57']) k;

-- p1 in the reader's public list; p2, p3 and p4 (not live) in a private
-- one; p5 in other people's lists only; p6 where the reader checked in.
insert into public.places (id, slug, is_published, review_status, submitted_by) values
 ('e4000000-0000-0000-0000-0000000000f1', 'fs-one',   true,  'approved', null),
 ('e4000000-0000-0000-0000-0000000000f2', 'fs-two',   true,  'approved', null),
 ('e4000000-0000-0000-0000-0000000000f3', 'fs-three', true,  'approved', null),
 ('e4000000-0000-0000-0000-0000000000f4', 'fs-four',  false, 'pending',  'e4000000-0000-0000-0000-0000000000a0'),
 ('e4000000-0000-0000-0000-0000000000f5', 'fs-five',  true,  'approved', null),
 ('e4000000-0000-0000-0000-0000000000f6', 'fs-six',   true,  'approved', null);

-- Lists, by owner: `c<owner>` is public, `p<owner>` private.
insert into public.collections (id, slug, owner_id, copied_from) values
 ('e4000000-0000-0000-0000-000000000ca0', 'fs-ca0', 'e4000000-0000-0000-0000-0000000000a0', null),
 ('e4000000-0000-0000-0000-000000000da0', 'fs-pa0', 'e4000000-0000-0000-0000-0000000000a0', null),
 ('e4000000-0000-0000-0000-000000000c13', 'fs-c13', 'e4000000-0000-0000-0000-000000000013', null),
 ('e4000000-0000-0000-0000-000000000c21', 'fs-c21', 'e4000000-0000-0000-0000-000000000021', null),
 ('e4000000-0000-0000-0000-000000000c22', 'fs-c22', 'e4000000-0000-0000-0000-000000000022', null),
 ('e4000000-0000-0000-0000-000000000c31', 'fs-c31', 'e4000000-0000-0000-0000-000000000031', null),
 ('e4000000-0000-0000-0000-000000000c32', 'fs-c32', 'e4000000-0000-0000-0000-000000000032', null),
 ('e4000000-0000-0000-0000-000000000c41', 'fs-c41', 'e4000000-0000-0000-0000-000000000041', null),
 ('e4000000-0000-0000-0000-000000000d55', 'fs-p55', 'e4000000-0000-0000-0000-000000000055', null),
 ('e4000000-0000-0000-0000-000000000c56', 'fs-c56', 'e4000000-0000-0000-0000-000000000056', null),
 ('e4000000-0000-0000-0000-000000000d57', 'fs-p57', 'e4000000-0000-0000-0000-000000000057', null);
-- The two copies, each private: a copy's own privacy is not what counts.
insert into public.collections (id, slug, owner_id, copied_from, created_at) values
 ('e4000000-0000-0000-0000-000000000d12', 'fs-k12', 'e4000000-0000-0000-0000-000000000012',
  'e4000000-0000-0000-0000-000000000ca0', now() - interval '2 hours'),
 ('e4000000-0000-0000-0000-000000000db0', 'fs-ka0', 'e4000000-0000-0000-0000-0000000000a0',
  'e4000000-0000-0000-0000-000000000c22', now() - interval '4 hours');
update public.collections set is_public = true where slug like 'fs-c%';

insert into public.collection_places (collection_id, place_id) values
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-0000000000f1'),
 ('e4000000-0000-0000-0000-000000000da0', 'e4000000-0000-0000-0000-0000000000f2'),
 ('e4000000-0000-0000-0000-000000000da0', 'e4000000-0000-0000-0000-0000000000f3'),
 ('e4000000-0000-0000-0000-000000000da0', 'e4000000-0000-0000-0000-0000000000f4'),
 ('e4000000-0000-0000-0000-000000000c13', 'e4000000-0000-0000-0000-0000000000f3'),
 ('e4000000-0000-0000-0000-000000000c21', 'e4000000-0000-0000-0000-0000000000f5'),
 ('e4000000-0000-0000-0000-000000000c22', 'e4000000-0000-0000-0000-0000000000f5'),
 ('e4000000-0000-0000-0000-000000000c31', 'e4000000-0000-0000-0000-0000000000f2'),
 ('e4000000-0000-0000-0000-000000000c31', 'e4000000-0000-0000-0000-0000000000f3'),
 ('e4000000-0000-0000-0000-000000000c32', 'e4000000-0000-0000-0000-0000000000f2'),
 ('e4000000-0000-0000-0000-000000000c41', 'e4000000-0000-0000-0000-0000000000f6'),
 ('e4000000-0000-0000-0000-000000000d55', 'e4000000-0000-0000-0000-0000000000f2'),
 ('e4000000-0000-0000-0000-000000000c56', 'e4000000-0000-0000-0000-0000000000f4');

-- Times set so the order inside a rank is the order of the acts.
insert into public.collection_likes (collection_id, user_id, created_at) values
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-000000000011', now() - interval '3 hours'),
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-000000000013', now() - interval '1 hour'),
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-000000000051', now()),
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-000000000052', now()),
 ('e4000000-0000-0000-0000-000000000ca0', 'e4000000-0000-0000-0000-000000000053', now() - interval '6 hours'),
 ('e4000000-0000-0000-0000-000000000da0', 'e4000000-0000-0000-0000-000000000054', now()),
 ('e4000000-0000-0000-0000-000000000c21', 'e4000000-0000-0000-0000-0000000000a0', now() - interval '5 hours'),
 ('e4000000-0000-0000-0000-000000000d57', 'e4000000-0000-0000-0000-0000000000a0', now());

insert into public.checkins (user_id, place_id) values
 ('e4000000-0000-0000-0000-0000000000a0', 'e4000000-0000-0000-0000-0000000000f6');

insert into public.friendships (requester, addressee, status) values
 ('e4000000-0000-0000-0000-000000000051', 'e4000000-0000-0000-0000-0000000000a0', 'accepted');
-- Blocked by them, not by the reader: either side of a block is enough.
insert into public.blocks (blocker, blocked) values
 ('e4000000-0000-0000-0000-000000000052', 'e4000000-0000-0000-0000-0000000000a0');

-- What a reader is suggested, in order, as `who:reason:n`.
create or replace function pg_temp.suggested(uid text) returns text language plpgsql as $$
declare out text;
begin
  perform set_config('test.uid', coalesce(uid, ''), true);
  set local role rls_client;
  select string_agg(right(s.other::text, 2) || ':' || s.reason || ':' || s.n, ',' order by o)
    into out
    from public.friend_suggestions() with ordinality as s(other, reason, collection_id, n, o);
  reset role;
  return coalesce(out, '');
end $$;

-- As the reader, a dismissal: insert or delete, true if it went through.
create or replace function pg_temp.dismiss(uid text, who text, undo boolean default false) returns boolean language plpgsql as $$
declare ok boolean := true;
begin
  perform set_config('test.uid', uid, true);
  set local role rls_client;
  begin
    if undo then
      delete from public.suggestion_dismissals where other = who::uuid;
    else
      insert into public.suggestion_dismissals (user_id, other) values (uid::uuid, who::uuid);
    end if;
  exception when insufficient_privilege or check_violation then
    ok := false;
  end;
  reset role;
  return ok;
end $$;

-- ─────────────────────────────────────────────── the four, in order

do $$
declare got text;
begin
  got := pg_temp.suggested('e4000000-0000-0000-0000-0000000000a0');
  assert got = '13:liked_yours:1,12:copied_yours:1,11:liked_yours:1,53:liked_yours:1,'
            || '22:you_copied:1,21:you_liked:1,31:saves:2,32:saves:1,41:visits:1',
    format('the reader was suggested %s', got);
end $$;

-- The list a like or copy was about, so the row can name it; none for a count.
do $$
declare liked uuid; copied uuid; saves uuid;
begin
  perform set_config('test.uid', 'e4000000-0000-0000-0000-0000000000a0', true);
  set local role rls_client;
  select s.collection_id into liked from public.friend_suggestions() s where right(s.other::text, 2) = '13';
  select s.collection_id into copied from public.friend_suggestions() s where right(s.other::text, 2) = '22';
  select s.collection_id into saves from public.friend_suggestions() s where right(s.other::text, 2) = '31';
  reset role;
  assert liked = 'e4000000-0000-0000-0000-000000000ca0', format('a like named list %s, not the reader''s', liked);
  assert copied = 'e4000000-0000-0000-0000-000000000c22', format('a copy named list %s, not the original', copied);
  assert saves is null, 'a count of places named a list';
end $$;

-- The same acts, read from the other side: 11 liked the reader's list, so
-- to 11 the reader is someone they liked.
do $$
declare got text;
begin
  got := pg_temp.suggested('e4000000-0000-0000-0000-000000000011');
  assert got = 'a0:you_liked:1', format('the liker was suggested %s', got);
end $$;

-- ───────────────────────────────────────────────────── the ×

do $$
declare got text;
begin
  assert pg_temp.dismiss('e4000000-0000-0000-0000-0000000000a0', 'e4000000-0000-0000-0000-000000000053'),
    'the reader could not put a suggestion away';
  got := pg_temp.suggested('e4000000-0000-0000-0000-0000000000a0');
  assert got not like '%53:%', format('a suggestion put away came back: %s', got);
end $$;

-- Theirs alone: not written for someone else, not about themselves, and
-- not seen by the person put away.
do $$
declare seen int;
begin
  perform set_config('test.uid', 'e4000000-0000-0000-0000-000000000011', true);
  set local role rls_client;
  begin
    insert into public.suggestion_dismissals (user_id, other)
    values ('e4000000-0000-0000-0000-0000000000a0', 'e4000000-0000-0000-0000-000000000012');
    raise exception 'a reader put a suggestion away for somebody else';
  exception when insufficient_privilege then null;
  end;
  reset role;

  assert not pg_temp.dismiss('e4000000-0000-0000-0000-0000000000a0', 'e4000000-0000-0000-0000-0000000000a0'),
    'a reader put themselves away';

  perform set_config('test.uid', 'e4000000-0000-0000-0000-000000000053', true);
  set local role rls_client;
  select count(*) into seen from public.suggestion_dismissals;
  reset role;
  assert seen = 0, format('the person put away saw %s dismissals', seen);
end $$;

-- And taken back.
do $$
declare got text;
begin
  assert pg_temp.dismiss('e4000000-0000-0000-0000-0000000000a0', 'e4000000-0000-0000-0000-000000000053', true),
    'the reader could not take a dismissal back';
  got := pg_temp.suggested('e4000000-0000-0000-0000-0000000000a0');
  assert got like '%53:liked_yours:1%', format('a dismissal taken back left %s', got);
end $$;

-- ─────────────────────────────────────────────── nobody, and guests

do $$
begin
  assert pg_temp.suggested(null) = '', 'a signed-out caller was suggested somebody';
  assert not has_table_privilege('anon', 'public.suggestion_dismissals', 'select'),
    'guests can read dismissals';
  assert not has_function_privilege('anon', 'public.friend_suggestions()', 'execute'),
    'friend_suggestions is open to anon';
  assert has_function_privilege('authenticated', 'public.friend_suggestions()', 'execute'),
    'friend_suggestions is closed to readers';
end $$;

select 'all friend suggestion checks passed' as result;
