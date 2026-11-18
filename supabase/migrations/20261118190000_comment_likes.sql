-- A heart on a comment.
--
-- Deferred when comments were planned (`docs/comments-plan.md`, "later")
-- and brought forward the evening they were first seen on a phone
-- (owner, 18 Nov 2026): under each comment a heart beside the bubble
-- that answers it, as Threads draws them.
--
-- ── the shape ──
--
-- One row a person a comment. It goes with the comment (and so with the
-- comment above it, and with the list), and with the account.
--
-- As the comments themselves: row level security on and not one policy.
-- A heart is set and taken back through `like_comment`, and read as two
-- columns of `comment_thread` — how many, and whether one is the
-- reader's. Nobody is told *who* liked a comment; there is no screen
-- that would say, and a function that does not exist cannot be asked.
--
-- ── who may ──
--
-- Anybody signed in who could read the comment: its list is public and
-- its writer and the reader have no block between them. Your own
-- comment too — Instagram and Threads allow it, and refusing it is a
-- rule a reader meets only as a button that does nothing.
--
-- No cap of its own. A like is one row a person a comment by its key,
-- so the most one account can write is the number of comments it can
-- read; the comments' own cap is what bounds that.
--
-- ── the count ──
--
-- Everybody's, whoever they are to the reader. The collection's count
-- leaves nobody out either, and a figure that changed with who was
-- looking would be one two friends could not agree on.

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- "What have I liked", for an account's export and its deletion.
create index if not exists comment_likes_by_user on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;
revoke all on table public.comment_likes from anon, authenticated;

-- Set a heart on a comment, or take it back. Idempotent both ways: a
-- second press of the same kind changes nothing and is not an error, so
-- a press drawn before the answer and a retry after a dropped connection
-- both land where the reader meant.
--
-- Refused as a comment is: `comment:signed_out`, and `comment:parent`
-- for a comment that is not there to like — deleted, on a list gone
-- private, or by somebody blocked either way. The same word as
-- answering such a comment, because it is the same fact.
create or replace function public.like_comment(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  c  public.comments;
begin
  if me is null then
    raise exception 'comment:signed_out';
  end if;
  select * into c from public.comments where id = p_id;
  if not found
     or not public.comment_subject_visible(c.collection_id)
     or public.is_blocked_pair(me, c.author) then
    raise exception 'comment:parent';
  end if;
  if p_on then
    insert into public.comment_likes (comment_id, user_id) values (p_id, me)
    on conflict do nothing;
  else
    delete from public.comment_likes where comment_id = p_id and user_id = me;
  end if;
end;
$$;

revoke all on function public.like_comment(uuid, boolean) from public, anon;
grant execute on function public.like_comment(uuid, boolean) to authenticated;

-- The thread, with each comment's hearts: how many, and whether one is
-- the reader's. Two columns more, so dropped and made again — a return
-- type cannot be changed in place. Everything else is 20261118150000's.
drop function if exists public.comment_thread(uuid, text);
create function public.comment_thread(p_collection uuid, p_order text default 'new')
returns table (
  id uuid, parent_id uuid, root_id uuid, depth smallint,
  body text, created_at timestamptz,
  author uuid, handle text, full_name text, avatar_url text,
  mentions jsonb,
  likes integer, liked boolean
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
            where mn.comment_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.comment_likes l where l.comment_id = s.id),
         exists (select 1 from public.comment_likes l where l.comment_id = s.id and l.user_id = me)
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
