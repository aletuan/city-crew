-- Comment news (20261119080000): four kinds of row, each to the one
-- reader it concerns; one row a comment; hearts gathered; nothing of
-- one's own, nothing across a block, nothing that cannot be opened.
--
--   …0a  the owner of a public list (c1) and a private one (c2)
--   …0b  a writer — the reader most of this is read as
--   …0c  somebody who answers, tags and likes
--   …0d  a second liker
--   …0e  somebody the writer has blocked

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c9e50000-0000-0000-0000-00000000000a', 'cn-a@x.com', '{"handle":"cnowner"}'),
 ('c9e50000-0000-0000-0000-00000000000b', 'cn-b@x.com', '{"handle":"cnwriter"}'),
 ('c9e50000-0000-0000-0000-00000000000c', 'cn-c@x.com', '{"handle":"cnactor"}'),
 ('c9e50000-0000-0000-0000-00000000000d', 'cn-d@x.com', '{"handle":"cnliker"}'),
 ('c9e50000-0000-0000-0000-00000000000e', 'cn-e@x.com', '{"handle":"cnblocked"}');
insert into public.blocks (blocker, blocked) values
 ('c9e50000-0000-0000-0000-00000000000b', 'c9e50000-0000-0000-0000-00000000000e');
insert into public.collections (id, slug, owner_id, title_en) values
 ('c9e50000-0000-0000-0000-0000000000c1', 'cn-public',  'c9e50000-0000-0000-0000-00000000000a', 'Hoi An Coffee'),
 ('c9e50000-0000-0000-0000-0000000000c2', 'cn-private', 'c9e50000-0000-0000-0000-00000000000a', 'Hidden');
update public.collections set is_public = true where id = 'c9e50000-0000-0000-0000-0000000000c1';

-- The writer's root, and under it: a plain reply, a reply that also tags
-- the writer, and a reply to the reply (which answers c, not the writer).
-- Then a root by c that tags the writer, a root by c that concerns only
-- the owner, the writer's own reply to themself, and one by the blocked.
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000b', 'c9e50000-0000-0000-0000-0000000000c1', null, 'mine', now() - interval '6 days');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c9e50000-0000-0000-0000-0000000000b1', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c1', 'c9e50000-0000-0000-0000-0000000000a1', 'reply', now() - interval '5 days'),
 ('c9e50000-0000-0000-0000-0000000000b2', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c1', 'c9e50000-0000-0000-0000-0000000000a1', '@cnwriter both', now() - interval '4 days'),
 ('c9e50000-0000-0000-0000-0000000000b4', 'c9e50000-0000-0000-0000-00000000000b', 'c9e50000-0000-0000-0000-0000000000c1', 'c9e50000-0000-0000-0000-0000000000a1', 'own', now() - interval '3 days'),
 ('c9e50000-0000-0000-0000-0000000000b5', 'c9e50000-0000-0000-0000-00000000000e', 'c9e50000-0000-0000-0000-0000000000c1', 'c9e50000-0000-0000-0000-0000000000a1', 'blocked', now() - interval '2 days');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c9e50000-0000-0000-0000-0000000000b3', 'c9e50000-0000-0000-0000-00000000000d', 'c9e50000-0000-0000-0000-0000000000c1', 'c9e50000-0000-0000-0000-0000000000b1', 'deeper', now() - interval '3 days 12 hours'),
 ('c9e50000-0000-0000-0000-0000000000a2', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c1', null, '@cnwriter look', now() - interval '1 day'),
 ('c9e50000-0000-0000-0000-0000000000a3', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c1', null, 'plain', now() - interval '12 hours'),
 ('c9e50000-0000-0000-0000-0000000000a4', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c1', null, 'old', now() - interval '40 days'),
 ('c9e50000-0000-0000-0000-0000000000a9', 'c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-0000000000c2', null, '@cnwriter hidden', now() - interval '1 hour');
insert into public.comment_mentions (comment_id, at, len, person_id) values
 ('c9e50000-0000-0000-0000-0000000000b2', 0, 9, 'c9e50000-0000-0000-0000-00000000000b'),
 ('c9e50000-0000-0000-0000-0000000000a2', 0, 9, 'c9e50000-0000-0000-0000-00000000000b'),
 ('c9e50000-0000-0000-0000-0000000000a9', 0, 9, 'c9e50000-0000-0000-0000-00000000000b');

-- The news as "kind:body:actor handle:others", newest first.
create function public._cn_news(as_user text, since interval default interval '14 days') returns text
language plpgsql set search_path = public as $$
declare got text;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  select string_agg(n.kind || ':' || n.body || ':' || coalesce(n.handle, '?') || ':' || n.others, ' | ' order by k)
    into got
    from public.comment_news(now() - since) with ordinality as n(kind, comment_id, list, actor, handle, full_name, avatar_url, body, at, others, k);
  reset role;
  return coalesce(got, '');
end $$;

-- ── who may ask ──
do $$
begin
  assert not has_function_privilege('anon', 'public.comment_news(timestamptz)', 'execute'), 'a guest may ask for news';
  assert has_function_privilege('authenticated', 'public.comment_news(timestamptz)', 'execute'), 'a reader may not ask for news';
end $$;

-- ── the writer: a tag, a reply that is also a tag (once, as a tag), a plain reply;
--    not their own, not the blocked one's, not the reply to somebody else, not the private list's ──
do $$
declare got text;
begin
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b');
  assert got = 'tag:@cnwriter look:cnactor:0 | tag:@cnwriter both:cnactor:0 | reply:reply:cnactor:0',
    format('the writer''s news: %s', got);
end $$;

-- ── the owner: everything written on the list by others, as "on your list" ──
do $$
declare got text;
begin
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000a');
  assert got = 'on_list:plain:cnactor:0 | on_list:@cnwriter look:cnactor:0 | on_list:blocked:cnblocked:0 | on_list:own:cnwriter:0 | on_list:deeper:cnliker:0 | on_list:@cnwriter both:cnactor:0 | on_list:reply:cnactor:0 | on_list:mine:cnwriter:0',
    format('the owner''s news: %s', got);
end $$;

-- ── the one who answered: only the reply to their own comment ──
do $$
declare got text;
begin
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000c');
  assert got = 'reply:deeper:cnliker:0', format('the actor''s news: %s', got);
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000d');
  assert got = '', format('the liker''s news: %s', got);
end $$;

-- ── the window: an older one is in a wider window, and no window is wider than 31 days ──
do $$
declare got text;
begin
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '2 days');
  assert got = 'tag:@cnwriter look:cnactor:0', format('two days of the writer''s news: %s', got);
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000a', interval '400 days');
  assert got not like '%:old:%', format('a year of the owner''s news holds the forty-day-old: %s', got);
end $$;

-- ── hearts: gathered by comment, the latest liker named, the rest counted;
--    not one's own, not a blocked reader's ──
do $$
declare got text;
begin
  insert into public.comment_likes (comment_id, user_id, created_at) values
   ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000c', now() - interval '3 hours'),
   ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000d', now() - interval '2 hours'),
   ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000a', now() - interval '4 hours'),
   ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000b', now() - interval '1 hour'),
   ('c9e50000-0000-0000-0000-0000000000a1', 'c9e50000-0000-0000-0000-00000000000e', now() - interval '30 minutes'),
   ('c9e50000-0000-0000-0000-0000000000b4', 'c9e50000-0000-0000-0000-00000000000c', now() - interval '5 hours'),
   -- From before any window asked for below: never counted, never named.
   ('c9e50000-0000-0000-0000-0000000000b4', 'c9e50000-0000-0000-0000-00000000000d', now() - interval '20 days');
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '10 hours');
  assert got = 'heart:mine:cnliker:2 | heart:own:cnactor:0', format('the writer''s hearts: %s', got);
  -- A heart is news to the comment's writer and to nobody else: not to the list's owner.
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000a', interval '10 hours');
  assert got = '', format('the owner''s share of somebody else''s hearts: %s', got);
  -- Taken back, it is gone, and the next latest is named.
  delete from public.comment_likes
   where comment_id = 'c9e50000-0000-0000-0000-0000000000a1' and user_id = 'c9e50000-0000-0000-0000-00000000000d';
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '10 hours');
  assert got = 'heart:mine:cnactor:1 | heart:own:cnactor:0', format('after one is taken back: %s', got);
end $$;

-- ── what a row carries: the comment, the list by name, who and when ──
do $$
declare r record;
begin
  set local role rls_client;
  set local test.uid = 'c9e50000-0000-0000-0000-00000000000b';
  select * into r from public.comment_news(now() - interval '14 days') n where n.body = 'reply';
  reset role;
  assert r.comment_id = 'c9e50000-0000-0000-0000-0000000000b1' and r.actor = 'c9e50000-0000-0000-0000-00000000000c',
    format('the reply row: %s', r);
  assert r.list ->> 'id' = 'c9e50000-0000-0000-0000-0000000000c1' and r.list ->> 'slug' = 'cn-public'
     and r.list ->> 'title_en' = 'Hoi An Coffee' and r.list ? 'title_vi' and r.list ? 'title_ja',
    format('the list on a row: %s', r.list);
  assert r.at > now() - interval '6 days' and r.at < now() - interval '4 days', format('when: %s', r.at);
end $$;

-- ── what still stands: a deleted comment, a list made private, a new block ──
do $$
declare got text;
begin
  delete from public.comments where id = 'c9e50000-0000-0000-0000-0000000000a2';
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '8 days');
  assert got = 'heart:mine:cnactor:1 | heart:own:cnactor:0 | tag:@cnwriter both:cnactor:0 | reply:reply:cnactor:0',
    format('after a delete: %s', got);

  insert into public.blocks (blocker, blocked) values
   ('c9e50000-0000-0000-0000-00000000000c', 'c9e50000-0000-0000-0000-00000000000b');
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '8 days');
  -- Everything of the actor's goes; the owner's heart, further back, is what is left.
  assert got = 'heart:mine:cnowner:0', format('after the actor blocks the writer: %s', got);
  delete from public.blocks where blocker = 'c9e50000-0000-0000-0000-00000000000c';

  update public.collections set is_public = false where id = 'c9e50000-0000-0000-0000-0000000000c1';
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '8 days');
  assert got = '', format('after the list goes private: %s', got);
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000a', interval '8 days');
  assert got = '', format('the owner, after the list goes private: %s', got);
  update public.collections set is_public = true where id = 'c9e50000-0000-0000-0000-0000000000c1';
  got := public._cn_news('c9e50000-0000-0000-0000-00000000000b', interval '8 days');
  assert got <> '', 'public again, the news did not come back';
end $$;

-- ── signed out: nothing ──
do $$
declare got text;
begin
  got := public._cn_news('');
  assert got = '', format('signed out: %s', got);
end $$;

drop function public._cn_news(text, interval);

select 'all comment news checks passed' as result;
