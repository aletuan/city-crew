-- Comments on a collection — the tables, the rules, and the five
-- functions a client may call. C1 of `docs/comments-plan.md`.
--
-- ── what a comment hangs on ──
--
-- A *subject*: the thing being talked about. Today there is one kind, a
-- public collection, and it is a column — `collection_id`, a real foreign
-- key. The next kind (a check-in, step 3 of the feed plan) is another
-- column beside it and a branch in `comment_subject_visible`; the check
-- `comments_one_subject` says a comment hangs on exactly one.
--
-- Weighed and not taken: `subject_type text, subject_id uuid`. One pair
-- of columns for every kind there will ever be — and no foreign key, so
-- deleting a collection leaves its thread behind, and "does this subject
-- exist, and may this reader see it" is a `case` written by hand in every
-- function that asks. A column a kind costs one `alter table`; that is
-- the right price for the database knowing what a comment is about.
--
-- ── nobody touches the tables ──
--
-- Row level security is on and there is not one policy: no client reads
-- or writes `comments` or `comment_mentions` directly. Everything goes
-- through the functions at the foot of this file, which are the only
-- place the rules are written:
--
--   comment_thread    read a thread
--   comment_previews  the count and the two newest, for a batch of cards
--   post_comment      write one, with its tags, or be told why not
--   delete_comment    take one back (its author, the subject's owner, or
--                     the desk)
--
-- A policy would have to say all of this again in a second dialect —
-- who is blocked from whom, which collection is public, what a deleted
-- comment still shows — and the two would drift.
--
-- ── a deleted comment that somebody answered ──
--
-- stays as a row with no body and no author, because its answers hang on
-- it (decision 5: Tildes' rule, not Facebook's, which takes the answers
-- too). One nobody answered is deleted outright, and deleting the last
-- answer under a husk deletes the husk, upward, until something living
-- is reached. `comments_gone_has_no_body` keeps the two states honest:
-- gone means no body, and nothing else does.
--
-- An account that is deleted takes the words with it at once — the
-- author's column is `on delete set null`, and the trigger on that
-- update empties the body in the same statement. `delete-account`
-- promises "everything personal, immediately"; a husk is not personal.

-- ── the tables ───────────────────────────────────────────────────────

create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  author        uuid references auth.users(id) on delete set null,
  -- The subject. One column a kind; see the head of this file.
  collection_id uuid references public.collections(id) on delete cascade,
  -- The comment answered, and the top of its branch. `root_id` is what a
  -- thread is fetched and counted by; `depth` is the true depth, which
  -- the app draws no deeper than two (decision 2).
  parent_id     uuid references public.comments(id) on delete cascade,
  root_id       uuid references public.comments(id) on delete cascade,
  depth         smallint not null default 0 check (depth >= 0),
  -- 500: decision 7. Counted in characters, as the composer counts.
  body          text check (body is null or char_length(body) between 1 and 500),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint comments_one_subject check (num_nonnulls(collection_id) = 1),
  constraint comments_gone_has_no_body check ((deleted_at is null) = (body is not null)),
  constraint comments_root_with_parent check ((parent_id is null) = (root_id is null))
);

-- A thread, newest root first: every read starts here.
create index if not exists comments_on_collection
  on public.comments (collection_id, created_at desc);
-- "Has it answers" and "the answers of", asked on every delete.
create index if not exists comments_by_parent on public.comments (parent_id);
-- The day's count, for the cap; and the account's own, for its export.
create index if not exists comments_by_author on public.comments (author, created_at desc);

alter table public.comments enable row level security;
revoke all on table public.comments from anon, authenticated;

-- A tag: a stretch of a comment's body that is a person or a place.
-- Kept as a link, not as the text "@trang": a handle that changes still
-- points at its person, and a person or place that is deleted takes the
-- row with it and leaves plain words behind.
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  -- Where in the body, in characters, and how many.
  at         integer not null check (at >= 0),
  len        integer not null check (len > 0),
  person_id  uuid references auth.users(id) on delete cascade,
  place_id   uuid references public.places(id) on delete cascade,
  primary key (comment_id, at),
  constraint comment_mentions_one_target check (num_nonnulls(person_id, place_id) = 1)
);

alter table public.comment_mentions enable row level security;
revoke all on table public.comment_mentions from anon, authenticated;

-- The owner's switch (decision 3): no new comments on this collection.
-- What is already there stays readable; turning it off is closing the
-- door, not emptying the room.
alter table public.collections
  add column if not exists comments_off boolean not null default false;

-- Words a comment may not contain (decision 8, and the first of the four
-- things Guideline 1.2 asks of an app that carries people's words).
-- Empty as shipped: the list is the desk's to write, in C8, and must be
-- written before the flag is turned on (the plan's open item 2).
create table if not exists public.banned_words (
  word       text primary key check (word = lower(btrim(word)) and word <> ''),
  created_at timestamptz not null default now()
);

alter table public.banned_words enable row level security;
revoke all on table public.banned_words from anon, authenticated;
grant select, insert, delete on table public.banned_words to authenticated;

drop policy if exists "the desk keeps the banned words" on public.banned_words;
create policy "the desk keeps the banned words" on public.banned_words
  for all using ((select public.is_editor())) with check ((select public.is_editor()));

-- A comment can be reported, as a collection and a profile can.
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports
  add constraint reports_kind_check check (kind in ('collection', 'profile', 'comment'));

-- ── the tree keeps itself ────────────────────────────────────────────

-- A reply takes its subject, its root and its depth from the comment it
-- answers — whoever inserts it. `post_comment` is the only writer today;
-- this is so the invariants do not depend on that staying true.
create or replace function public.comments_place_in_tree()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  par public.comments;
begin
  if new.parent_id is null then
    new.root_id := null;
    new.depth := 0;
    return new;
  end if;
  select * into par from public.comments where id = new.parent_id;
  if not found then
    raise exception 'comment:parent';
  end if;
  if par.collection_id is distinct from new.collection_id then
    raise exception 'comment:parent';
  end if;
  new.root_id := coalesce(par.root_id, par.id);
  new.depth := par.depth + 1;
  return new;
end;
$$;

drop trigger if exists comments_place_in_tree on public.comments;
create trigger comments_place_in_tree
  before insert on public.comments
  for each row execute function public.comments_place_in_tree();

-- An author that becomes null is an account that was deleted: the words
-- go in the same statement.
create or replace function public.comments_author_gone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.author is null and old.author is not null and new.deleted_at is null then
    new.body := null;
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_author_gone on public.comments;
create trigger comments_author_gone
  before update of author on public.comments
  for each row execute function public.comments_author_gone();

-- Delete a husk nobody answers, and then its parent if that was a husk
-- kept only for this one, and so on up.
create or replace function public.comment_prune(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur uuid := p_id;
  up  uuid;
begin
  while cur is not null loop
    select c.parent_id into up
      from public.comments c
     where c.id = cur
       and c.deleted_at is not null
       and not exists (select 1 from public.comments k where k.parent_id = c.id);
    exit when not found;
    delete from public.comments where id = cur;
    cur := up;
  end loop;
end;
$$;

revoke all on function public.comment_prune(uuid) from public, anon, authenticated;

-- A comment that has just gone — by its author, by the desk, or with its
-- author's account — loses its tags, and is pruned if nothing hangs on it.
create or replace function public.comments_after_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.comment_mentions where comment_id = new.id;
    perform public.comment_prune(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists comments_after_gone on public.comments;
create trigger comments_after_gone
  -- Not `update of deleted_at`: an account's deletion sets only `author`,
  -- and it is the trigger above that stamps `deleted_at`. A column list
  -- reads the statement, not the row, and would sleep through it.
  after update on public.comments
  for each row execute function public.comments_after_gone();

-- ── who may see a subject ────────────────────────────────────────────

-- The one place "may this reader see what this comment is about" is
-- answered. Today: the collection exists and is public. A list shared
-- with friends only is not public and has no thread; a list taken
-- private hides its thread until it is public again.
--
-- A check-in is a second argument and a second branch here.
create or replace function public.comment_subject_visible(p_collection uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collections c
     where c.id = p_collection and c.is_public
  );
$$;

revoke all on function public.comment_subject_visible(uuid) from public, anon, authenticated;

-- ── the filter, and the cap ──────────────────────────────────────────

-- Whether a body is free of every banned word. Words are compared whole:
-- the body and the word are both folded to lower case with runs of
-- space and punctuation made one space, and padded, so "ass" does not
-- stop "class" and "ASS!" does not get by. A word spelled apart
-- ("a.s.s") does get by: closing that door stops honest sentences made
-- of short words, and it is what the report button is for. Not a
-- regular expression: a word in the table is somebody's typing, and
-- must not be able to be a pattern.
create or replace function public.comment_clean(p_body text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.banned_words w
     where position(
             ' ' || regexp_replace(w.word, '[[:space:][:punct:]]+', ' ', 'g') || ' '
             in ' ' || regexp_replace(lower(p_body), '[[:space:][:punct:]]+', ' ', 'g') || ' '
           ) > 0
  );
$$;

revoke all on function public.comment_clean(text) from public, anon, authenticated;

-- How many comments the caller has written in the last day. A deleted
-- one that left a husk still counts; one deleted outright does not —
-- the cap is against flooding a thread, and a comment that is gone is
-- not in one.
create or replace function public.own_comments_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.comments c
   where c.author = (select auth.uid()) and c.created_at > now() - interval '1 day';
$$;

revoke all on function public.own_comments_today() from public, anon;
grant execute on function public.own_comments_today() to authenticated;

-- ── write ────────────────────────────────────────────────────────────

-- Post a comment on a collection, or an answer to one, with its tags.
--
-- Refusals are exceptions whose message is `comment:<reason>`, which the
-- app turns into a sentence: signed_out, subject (not there, not public,
-- or one of you has blocked the other), off, empty, long, banned, cap,
-- parent, mention.
--
-- `p_mentions`: `[{ "at": 0, "len": 6, "person": "<uuid>" }, { …, "place": "<uuid>" }]`.
-- A person may be tagged if they are the caller's friend, the
-- collection's owner, or already in the thread (decision 4) — and not
-- blocked either way. A place may be tagged if it is on the collection.
create or replace function public.post_comment(
  p_collection uuid,
  p_parent     uuid,
  p_body       text,
  p_mentions   jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := (select auth.uid());
  words    text := btrim(coalesce(p_body, ''));
  owner    uuid;
  off      boolean;
  par      public.comments;
  made     uuid;
  m        jsonb;
  m_at     integer;
  m_len    integer;
  m_person uuid;
  m_place  uuid;
begin
  if me is null then
    raise exception 'comment:signed_out';
  end if;
  select c.owner_id, c.comments_off into owner, off
    from public.collections c
   where c.id = p_collection and c.is_public;
  if not found or (owner is not null and public.is_blocked_pair(me, owner)) then
    raise exception 'comment:subject';
  end if;
  if off then
    raise exception 'comment:off';
  end if;
  if words = '' then
    raise exception 'comment:empty';
  end if;
  if char_length(words) > 500 then
    raise exception 'comment:long';
  end if;
  if not public.comment_clean(words) then
    raise exception 'comment:banned';
  end if;
  -- 30 a day: decision 7.
  if public.own_comments_today() >= 30 then
    raise exception 'comment:cap';
  end if;

  if p_parent is not null then
    select * into par from public.comments where id = p_parent;
    if not found
       or par.collection_id is distinct from p_collection
       or par.deleted_at is not null
       or (par.author is not null and public.is_blocked_pair(me, par.author)) then
      raise exception 'comment:parent';
    end if;
  end if;

  -- Ten tags: a ceiling, not a measurement — 500 characters hold more
  -- handles than that, and a comment that is all handles is a way of
  -- ringing ten doorbells at once.
  if jsonb_typeof(coalesce(p_mentions, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_mentions, '[]'::jsonb)) > 10 then
    raise exception 'comment:mention';
  end if;

  insert into public.comments (author, collection_id, parent_id, body)
  values (me, p_collection, p_parent, words)
  returning id into made;

  for m in select * from jsonb_array_elements(coalesce(p_mentions, '[]'::jsonb)) loop
    begin
      m_at     := (m ->> 'at')::integer;
      m_len    := (m ->> 'len')::integer;
      m_person := nullif(m ->> 'person', '')::uuid;
      m_place  := nullif(m ->> 'place', '')::uuid;
    exception when others then
      raise exception 'comment:mention';
    end;
    if m_at is null or m_len is null or m_at < 0 or m_len < 1
       or m_at + m_len > char_length(words)
       or num_nonnulls(m_person, m_place) <> 1 then
      raise exception 'comment:mention';
    end if;
    if m_person is not null then
      if m_person = me
         or not exists (select 1 from public.profiles p where p.id = m_person)
         or public.is_blocked_pair(me, m_person)
         or not (
              m_person is not distinct from owner
              or public.friends_with(m_person)
              or exists (
                   select 1 from public.comments k
                    where k.collection_id = p_collection
                      and k.author = m_person and k.deleted_at is null)
            ) then
        raise exception 'comment:mention';
      end if;
    elsif not exists (
            select 1 from public.collection_places cp
             where cp.collection_id = p_collection and cp.place_id = m_place) then
      raise exception 'comment:mention';
    end if;
    begin
      insert into public.comment_mentions (comment_id, at, len, person_id, place_id)
      values (made, m_at, m_len, m_person, m_place);
    exception when unique_violation then
      raise exception 'comment:mention';
    end;
  end loop;

  return made;
end;
$$;

revoke all on function public.post_comment(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.post_comment(uuid, uuid, text, jsonb) to authenticated;

-- Take a comment back. Its author may; so may the owner of the
-- collection it is on (decision 5), and the desk. Answered, it leaves a
-- husk; unanswered, it goes, and takes with it any husk above that was
-- only there for it. Idempotent: a comment already gone is not an error.
create or replace function public.delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := (select auth.uid());
  c   public.comments;
  up  uuid;
begin
  if me is null then
    raise exception 'comment:signed_out';
  end if;
  select * into c from public.comments where id = p_id;
  if not found then
    return;
  end if;
  if not (
       c.author is not distinct from me
       or exists (select 1 from public.collections col
                   where col.id = c.collection_id and col.owner_id = me)
       or public.is_editor()
     ) then
    raise exception 'comment:not_yours';
  end if;
  if c.deleted_at is not null then
    return;
  end if;
  if exists (select 1 from public.comments k where k.parent_id = c.id) then
    -- The trigger takes the tags and has nothing to prune.
    update public.comments set body = null, deleted_at = now() where id = c.id;
  else
    up := c.parent_id;
    delete from public.comments where id = c.id;
    perform public.comment_prune(up);
  end if;
end;
$$;

revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

-- ── read ─────────────────────────────────────────────────────────────

-- A whole thread, flat, in the order it is drawn: roots newest first
-- (decision 10), each followed by its answers oldest first.
--
-- `p_order` is 'new' and nothing else today. It is a parameter so that
-- "top" — by hearts, when comments have hearts — is a value added here
-- and not a second function.
--
-- A comment by somebody the reader has blocked, or who has blocked them,
-- comes back as a husk (`gone`, no body, no author), exactly as a
-- deleted one does: the app draws the husk if it has answers and nothing
-- if it has none, and never learns which of the two it was.
--
-- Open to a signed-out reader: a public collection's thread is as public
-- as the collection.
create or replace function public.comment_thread(p_collection uuid, p_order text default 'new')
returns table (
  id uuid, parent_id uuid, root_id uuid, depth smallint,
  body text, created_at timestamptz, gone boolean,
  author uuid, handle text, full_name text, avatar_url text,
  mentions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if p_order <> 'new' then
    raise exception 'comment:order';
  end if;
  if not public.comment_subject_visible(p_collection) then
    return;
  end if;
  return query
  with seen as (
    select c.*,
           (c.deleted_at is not null
            or (me is not null and c.author is not null
                and public.is_blocked_pair(me, c.author))) as is_gone
      from public.comments c
     where c.collection_id = p_collection
  )
  select s.id, s.parent_id, s.root_id, s.depth,
         case when s.is_gone then null else s.body end,
         s.created_at, s.is_gone,
         case when s.is_gone then null else s.author end,
         case when s.is_gone then null else p.handle end,
         case when s.is_gone then null else p.full_name end,
         case when s.is_gone then null else p.avatar_url end,
         case when s.is_gone then '[]'::jsonb else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'at', mn.at, 'len', mn.len,
                    'person', mn.person_id, 'handle', mp.handle,
                    'place', mn.place_id) order by mn.at)
             from public.comment_mentions mn
             left join public.profiles mp on mp.id = mn.person_id
            where mn.comment_id = s.id), '[]'::jsonb) end
    from seen s
    left join public.profiles p on p.id = s.author
    left join public.comments r on r.id = s.root_id
   order by coalesce(r.created_at, s.created_at) desc,
            coalesce(s.root_id, s.id),
            (s.root_id is not null),
            s.created_at asc, s.id;
end;
$$;

revoke all on function public.comment_thread(uuid, text) from public;
grant execute on function public.comment_thread(uuid, text) to anon, authenticated;

-- For a batch of cards: how many comments each collection has, and its
-- two newest (decision: a card shows a count and two, never a thread).
-- One call for the whole batch. Husks are neither counted nor shown,
-- and neither is anybody blocked from the reader.
--
-- A count worked out on asking, not a column kept on `collections`:
-- that table carries triggers and an owner's update policy, and a
-- counter there is one more thing a client could write and a trigger
-- must defend. At some sixty public collections and a handful of
-- comments each this is an index scan; if it ever is not, it becomes a
-- column then.
create or replace function public.comment_previews(p_collections uuid[])
returns table (collection_id uuid, n integer, latest jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select (select auth.uid()) as id),
  live as (
    select c.id, c.collection_id, c.body, c.created_at, c.author
      from public.comments c, me
     where c.collection_id = any (p_collections[1:200])
       and c.deleted_at is null
       and public.comment_subject_visible(c.collection_id)
       and not (me.id is not null and c.author is not null
                and public.is_blocked_pair(me.id, c.author))
  ),
  ranked as (
    select l.*, row_number() over (partition by l.collection_id order by l.created_at desc, l.id) as k
      from live l
  )
  select r.collection_id,
         count(*)::integer,
         jsonb_agg(jsonb_build_object(
           'id', r.id, 'body', r.body, 'created_at', r.created_at,
           'author', r.author, 'handle', p.handle,
           'full_name', p.full_name, 'avatar_url', p.avatar_url)
           order by r.created_at desc, r.id) filter (where r.k <= 2)
    from ranked r
    left join public.profiles p on p.id = r.author
   group by r.collection_id;
$$;

revoke all on function public.comment_previews(uuid[]) from public;
grant execute on function public.comment_previews(uuid[]) to anon, authenticated;

-- The three trigger functions answer to their triggers and to nobody's
-- RPC. A trigger function cannot be called directly whatever it is
-- granted; this is so the list of what a guest may execute says so.
revoke all on function public.comments_place_in_tree() from public, anon, authenticated;
revoke all on function public.comments_author_gone() from public, anon, authenticated;
revoke all on function public.comments_after_gone() from public, anon, authenticated;
