-- A reported comment, at the desk (C8 of docs/comments-plan.md).
--
-- A comment has been reportable since the day it shipped (`reports.kind`
-- gained 'comment' in 20261118050000), and the queue did not know it:
-- `reports_queue` joined a collection or a profile and nothing else, so a
-- comment's report came back with no words and no author, and the desk's
-- page — which reads "not a collection" as "a profile" — offered to clear
-- the bio of nobody. One such report is in the live table, from a tester.
--
-- Two things, then:
--
--   reports_queue      a comment's row carries its words, the list it is
--                      on, and who wrote it
--   moderate_comment   the desk's own way to take one down, which leaves
--                      a line in the moderation log
--
-- ── why not `delete_comment`, which already lets the desk ──
--
-- It does, and this calls it: what a removal takes with it (the answers
-- under it, since 20261118 `comments_cascade`) is one function's to
-- know. What `delete_comment` cannot do is say who did
-- it. The log exists so that an act of the desk "that did happen cannot
-- go unlogged" (20260910150100), and a comment removed through the
-- author's own function would be the one act of the three that left no
-- line. So the desk gets a door of its own, and the page uses that one.
--
-- ── what the log keeps, and what it does not ──
--
-- Who wrote it, which list it was on, and how many answers went with
-- it. Not the words. A removed comment's row is deleted, and a copy kept
-- in a log nobody promised would be the one place those words survive
-- their removal — and survive their author's account, since the log is not
-- theirs to cascade. The cost is real: a removal cannot be reviewed
-- against what was said. The report that led to it is still in the
-- queue, with its reason and the reporter's note; that is the record.
--
-- ── not reversible ──
--
-- Hiding a list and clearing a field can be put back; this cannot, and
-- it takes the answers under the comment with it. The page says both and
-- asks first.

alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log
  add constraint moderation_log_action_check check (action in (
    'hide_collection', 'show_collection', 'clear_profile', 'suspend', 'unsuspend', 'remove_comment'));

-- The same eleven columns, so `create or replace` keeps the grants and
-- the page's reading of a row. For a comment: `title` is the list's name
-- (where the words were said), `body` the words, and the owner columns
-- the author — the person an action on the account would reach, as they
-- are for the other two kinds. A comment since removed has no row, and
-- its report reads as "nothing left".
create or replace function public.reports_queue()
returns table (
  id uuid, kind text, target_id uuid, reason text, note text,
  status text, created_at timestamptz,
  title text, body text, owner_handle text, owner_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.reason, r.note, r.status, r.created_at,
    case r.kind when 'collection' then c.title_en when 'comment' then on_list.title_en else p.full_name end,
    case r.kind when 'collection' then c.desc_en when 'comment' then k.body else p.bio end,
    case r.kind when 'collection' then owner.handle when 'comment' then author.handle else p.handle end,
    case r.kind when 'collection' then c.owner_id when 'comment' then k.author else p.id end
  from public.reports r
  left join public.collections c on r.kind = 'collection' and c.id = r.target_id
  left join public.profiles owner on owner.id = c.owner_id
  left join public.profiles p on r.kind = 'profile' and p.id = r.target_id
  left join public.comments k on r.kind = 'comment' and k.id = r.target_id
  left join public.collections on_list on on_list.id = k.collection_id
  left join public.profiles author on author.id = k.author
  where public.is_editor()
  order by (r.status = 'new') desc, r.created_at desc
  limit 200;
$$;

revoke all on function public.reports_queue() from public, anon;
grant execute on function public.reports_queue() to authenticated;

-- Take a comment down, as the desk. A comment that is not there is not
-- an error and not an act: nothing is logged for what did not happen.
create or replace function public.moderate_comment(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c       public.comments;
  answers int;
begin
  if not public.is_editor() then
    raise exception 'not an editor';
  end if;
  select * into c from public.comments where id = target;
  if not found then
    return;
  end if;
  select count(*) into answers from public.comments k where k.parent_id = c.id;
  perform public.delete_comment(target);
  insert into public.moderation_log (actor, actor_email, action, target_id, detail)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), 'remove_comment', target,
    jsonb_build_object('author', c.author, 'collection', c.collection_id, 'answers', answers)
  );
end;
$$;

revoke all on function public.moderate_comment(uuid) from public, anon;
grant execute on function public.moderate_comment(uuid) to authenticated;
