-- Comments: deleting one takes its answers with it.
--
-- ── what changed, and why (owner, 18 Nov 2026) ──
--
-- 20261118050000 kept a deleted comment that somebody had answered as a
-- husk — a row with no body, drawn as "This comment was deleted" — so
-- that the answers had something to hang from: Tildes' rule, chosen over
-- Facebook's because it does not let one person erase another's words.
--
-- Seen on a phone it read as this:
--
--     This comment was deleted
--         This comment was deleted
--             trang · Thanks
--
-- — two lines saying nothing and a word answering neither. Tildes' rule
-- is for a forum, where an answer is an argument that stands on its own.
-- Here a comment is a line under a list of cafés, and an answer to it
-- means nothing once it is gone. So: Instagram's and Facebook's rule.
-- Deleting a comment deletes what was said under it.
--
-- The cost is the one that was weighed the first time: you can lose an
-- answer you wrote because somebody else deleted theirs. The app says so
-- before a delete ("the replies under it go too"); it cannot say so to
-- the people whose answers go.
--
-- ── what that makes simpler ──
--
-- There is no husk, so there is nothing that prunes husks, nothing that
-- empties a body when an account goes, no `deleted_at`, no "gone" in
-- what a thread returns, and a body is never null. The foreign keys do
-- the whole of it: an answer goes with its parent, and now a comment
-- goes with its author's account — which takes its answers by the first
-- rule.
--
-- ── somebody blocked ──
--
-- A comment by somebody the reader has blocked, or who has blocked them,
-- was returned as a husk so that nobody could tell it from a deleted
-- one. With no husks to hide among, it is simply not returned — and
-- neither is anything under it, by the same reasoning as a delete: an
-- answer to a comment the reader cannot see is an answer to nothing.
-- That is what Instagram does. The rows are untouched; this is only
-- what one reader is shown.

-- ── the husks there are ──
--
-- Rows the old rule left: deleted comments kept for their answers, and
-- comments whose account has gone. By the new rule neither should be
-- there, and nor should what hangs from them. On the live project this
-- is two rows and the one answer under them, written the evening the
-- feature was first tried; on a fresh database it is nothing.
delete from public.comments where deleted_at is not null or author is null;

-- ── the triggers and the pruning, which were all for husks ──
drop trigger if exists comments_after_gone on public.comments;
drop trigger if exists comments_author_gone on public.comments;
drop function if exists public.comments_after_gone();
drop function if exists public.comments_author_gone();
drop function if exists public.comment_prune(uuid);

-- ── the columns ──
alter table public.comments drop constraint if exists comments_gone_has_no_body;
alter table public.comments drop column if exists deleted_at;
alter table public.comments alter column body set not null;
alter table public.comments alter column author set not null;

-- A comment goes with its author's account, where it used to stay as a
-- husk (`on delete set null`).
alter table public.comments drop constraint if exists comments_author_fkey;
alter table public.comments
  add constraint comments_author_fkey foreign key (author) references auth.users(id) on delete cascade;

-- ── how many today ──
--
-- Unchanged in what it counts; restated because its note spoke of husks.
-- A comment that was deleted is not counted, since it is not there: the
-- cap is against flooding a thread, and a reader who writes thirty and
-- deletes thirty has flooded nothing.
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

-- ── write ────────────────────────────────────────────────────────────

-- As 20261118050000 has it, less the two tests for a comment that was
-- deleted: there is no such row to answer or to tag by.
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
       or public.is_blocked_pair(me, par.author) then
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
                    where k.collection_id = p_collection and k.author = m_person)
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

-- Take a comment back, and everything said under it — the foreign key on
-- `parent_id` does the second half. Its author may; so may the owner of
-- the collection it is on (decision 5), and the desk. Idempotent: a
-- comment that is not there is not an error.
create or replace function public.delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := (select auth.uid());
  c   public.comments;
begin
  if me is null then
    raise exception 'comment:signed_out';
  end if;
  select * into c from public.comments where id = p_id;
  if not found then
    return;
  end if;
  if not (
       c.author = me
       or exists (select 1 from public.collections col
                   where col.id = c.collection_id and col.owner_id = me)
       or public.is_editor()
     ) then
    raise exception 'comment:not_yours';
  end if;
  delete from public.comments where id = c.id;
end;
$$;

-- ── read ─────────────────────────────────────────────────────────────

-- What a reader may see of some collections' comments: every comment
-- reached from a root without passing through one by somebody blocked
-- from the reader, either way. Walked down from the roots, so a comment
-- under a hidden one is not reached and is not shown — see the head of
-- this file. A collection the reader may not see contributes nothing.
--
-- One function for both reads, so the count on a card is the number of
-- rows its thread will draw, by construction.
create or replace function public.comments_seen(p_collections uuid[])
returns setof public.comments
language sql
stable
security definer
set search_path = public
as $$
  with recursive me as (select (select auth.uid()) as id),
  seen as (
    select c.* from public.comments c, me
     where c.collection_id = any (p_collections)
       and c.parent_id is null
       and public.comment_subject_visible(c.collection_id)
       and not (me.id is not null and public.is_blocked_pair(me.id, c.author))
    union all
    select c.* from public.comments c join seen s on c.parent_id = s.id, me
     where not (me.id is not null and public.is_blocked_pair(me.id, c.author))
  )
  select * from seen;
$$;

revoke all on function public.comments_seen(uuid[]) from public, anon, authenticated;

-- A whole thread, flat, in the order it is drawn: roots newest first
-- (decision 10), each followed by its answers oldest first. No `gone`
-- column any more — nothing returned is gone — so the function is
-- dropped and made again: a return type cannot be changed in place.
drop function if exists public.comment_thread(uuid, text);
create function public.comment_thread(p_collection uuid, p_order text default 'new')
returns table (
  id uuid, parent_id uuid, root_id uuid, depth smallint,
  body text, created_at timestamptz,
  author uuid, handle text, full_name text, avatar_url text,
  mentions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_order <> 'new' then
    raise exception 'comment:order';
  end if;
  return query
  select s.id, s.parent_id, s.root_id, s.depth, s.body, s.created_at,
         s.author, p.handle, p.full_name, p.avatar_url,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'at', mn.at, 'len', mn.len,
                    'person', mn.person_id, 'handle', mp.handle,
                    'place', mn.place_id) order by mn.at)
             from public.comment_mentions mn
             left join public.profiles mp on mp.id = mn.person_id
            where mn.comment_id = s.id), '[]'::jsonb)
    from public.comments_seen(array[p_collection]) s
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
-- two newest. Counted over what the reader may see, as the thread is.
create or replace function public.comment_previews(p_collections uuid[])
returns table (collection_id uuid, n integer, latest jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select l.*, row_number() over (partition by l.collection_id order by l.created_at desc, l.id) as k
      from public.comments_seen(p_collections[1:200]) l
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
