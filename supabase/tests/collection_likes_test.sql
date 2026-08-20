-- Liking a public collection: what the count may say, and what it must not.
--
-- Two rules carry weight here and both are enforced in SQL rather than in
-- the app, because both decide something a public shelf shows and neither
-- can be left to whichever screen happens to call.
--
--   1. A like is attributed to whoever cast it and to nobody else, and
--      lands only on a list that is public. Anybody may like any public
--      list, their own included — that was asked for explicitly, and the
--      primary key is what keeps it one vote per person rather than a
--      tally somebody can run up.
--   2. The count is public, the voters are not. Anyone may learn a list
--      has forty likes. Nobody may learn who the forty are.
--
-- The harness stubs `auth.uid()` and does not run as a real client, so the
-- policies are asserted against `pg_policy` rather than exercised — the
-- same approach trips_test takes, and honest about what it covers. The
-- counting function needs no RLS and *is* exercised.

-- ----------------------------------------------------------------- shape

-- One like per person per list. The key leads with the collection because
-- the shelf asks for every count at once and groups by it.
do $$
declare cols text;
begin
  select string_agg(a.attname, ',' order by a.attnum) into cols
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.collection_likes'::regclass and i.indisprimary;
  assert cols = 'collection_id,user_id',
    format('collection_likes primary key became (%s); a second like from one person would count twice', cols);
end $$;

-- Both parents cascade. The seeded lists are placeholders and will be
-- replaced; accounts get deleted. A like outliving either would be a
-- ghost in a public number.
do $$
declare n int;
begin
  select count(*) into n from pg_constraint
   where conrelid = 'public.collection_likes'::regclass
     and contype = 'f' and confdeltype = 'c';
  assert n = 2, format('%s of 2 foreign keys cascade on delete; a like can outlive its list or its author', n);
end $$;

-- The column that lets a time-aware score arrive later without a
-- migration. Total likes ranks by age as much as by worth.
do $$
declare kind text;
begin
  select data_type into kind from information_schema.columns
   where table_schema = 'public' and table_name = 'collection_likes' and column_name = 'created_at';
  assert kind = 'timestamp with time zone',
    format('collection_likes.created_at is %s; a decayed ranking has nothing to decay by', kind);
end $$;

do $$
declare on_likes bool;
begin
  select relrowsecurity into on_likes from pg_class where oid = 'public.collection_likes'::regclass;
  assert on_likes, 'row level security is off on collection_likes';
end $$;

-- --------------------------------------------------------------- policies

-- Who liked what stays with its author. Without this the anon key reads a
-- record of one person's taste in another person's work.
do $$
declare qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
    from pg_policy where polname = 'readers see their own likes'
     and polrelid = 'public.collection_likes'::regclass;
  assert qual like '%uid%' and qual like '%user_id%',
    format('the select policy stopped scoping likes to their author: %s', qual);
end $$;

-- What the insert policy still has to hold. Liking your own list is
-- allowed on purpose, so there is no owner clause to assert — these two
-- are what is left, and both matter: without the first a like can be
-- filed under somebody else's name, which turns a count into a forgery;
-- without the second a private list collects votes for a shelf it is not
-- on.
do $$
declare chk text;
begin
  select pg_get_expr(polwithcheck, polrelid) into chk
    from pg_policy where polname = 'readers like public collections'
     and polrelid = 'public.collection_likes'::regclass;
  assert chk like '%uid%' and chk like '%user_id%',
    format('the insert policy stopped tying a like to its caster: %s', chk);
  assert chk like '%is_public%',
    format('the insert policy no longer requires the list to be public: %s', chk);
end $$;

-- --------------------------------------------------------------- counting

-- Security definer, because it has to see past the select policy above —
-- and safe precisely because of what it returns.
do $$
declare def bool; args text;
begin
  select p.prosecdef into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'collection_like_counts';
  assert def, 'collection_like_counts is not security definer; it cannot see the rows it counts';

  select pg_get_function_result(p.oid) into args from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'collection_like_counts';
  assert args not like '%user_id%',
    format('collection_like_counts started returning who liked: %s', args);
end $$;

-- And the behaviour, which needs no RLS to check.
do $$
declare pub uuid; priv uuid; u1 uuid; u2 uuid; n int;
begin
  insert into auth.users default values returning id into u1;
  insert into auth.users default values returning id into u2;
  -- Only the columns the stub carries: what this migration reasons about
  -- is `is_public`, and a title is not part of that.
  insert into public.collections (slug, is_public, city_id)
    values ('t-like-pub', true, 'hanoi') returning id into pub;
  insert into public.collections (slug, is_public, city_id)
    values ('t-like-priv', false, 'hanoi') returning id into priv;

  insert into public.collection_likes (collection_id, user_id) values (pub, u1), (pub, u2);
  insert into public.collection_likes (collection_id, user_id) values (priv, u1);

  select likes into n from public.collection_like_counts() where collection_id = pub;
  assert n = 2, format('a public list with two likes counted %s', n);

  -- One vote per person, whoever they are. With the self-like rule gone
  -- this is the only thing between a count and a tally somebody runs up
  -- by tapping twice, so it is worth proving rather than assuming.
  begin
    insert into public.collection_likes (collection_id, user_id) values (pub, u1);
    raise exception 'a second like from the same person was accepted';
  exception when unique_violation then null;  -- the key did its job
  end;

  select likes into n from public.collection_like_counts() where collection_id = pub;
  assert n = 2, format('the count moved to %s after a refused duplicate', n);

  -- A private list has no shelf to be ordered on and its count is nobody's
  -- business.
  select count(*) into n from public.collection_like_counts() where collection_id = priv;
  assert n = 0, 'collection_like_counts leaked a private list';

  -- Deleting the list takes its likes with it, so no count can outlive
  -- what it was counting.
  delete from public.collections where id = pub;
  select count(*) into n from public.collection_likes where collection_id = pub;
  assert n = 0, format('%s likes survived their collection', n);

  -- Both fixtures go, and the likes on the private one go with it by the
  -- same cascade this block just proved.
  delete from public.collections where slug like 't-like-%';
  delete from auth.users where id in (u1, u2);
end $$;

select 'all collection-like checks passed' as result;
