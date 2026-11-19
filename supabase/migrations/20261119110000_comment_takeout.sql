-- What an account has written in comments, for the copy of its data
-- (C9 of docs/comments-plan.md; the file is built in app/src/lib/export.ts).
--
-- The comment tables are closed to clients: every read goes through a
-- function that applies who may see what (`comment_thread` and the rest),
-- so the export's usual way in — a plain read of the account's own rows —
-- has no table to read. This is that read, for the caller's own rows and
-- nothing else.
--
-- ── what is the account's, and what is not ──
--
--   comments   every comment the caller wrote: where, the words, when,
--              whom it answered, and the people and places it tagged
--   hearts     every heart the caller set on a comment: where, whose
--              comment, when
--
-- Not here: comments others wrote that tag the caller or answer them,
-- and who set a heart on the caller's comments. Those are other people's
-- acts; the copy holds what this account did (rule 6 of the export).
--
-- Other people travel as their public handle and nothing else (rule 5):
-- no id, no name. Somebody whose profile is gone is a null, and the app
-- drops what it cannot name. A list travels as its slug, private or not:
-- a comment the caller wrote stays theirs when the list's owner takes
-- the list out of sight.
--
-- Not filtered by blocks. `comment_thread` hides a blocked person's
-- comments from a reader; this is not a thread being read, it is the
-- caller's own record of having answered somebody, and a block made
-- since does not unwrite it. The handle is public either way.

create or replace function public.my_comment_takeout()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'collection_slug', col.slug,
               'in_reply_to', parent_author.handle,
               'is_reply', c.parent_id is not null,
               'text', c.body,
               'at', c.created_at,
               'people', coalesce((
                 select jsonb_agg(mp.handle order by mn.at)
                   from public.comment_mentions mn
                   join public.profiles mp on mp.id = mn.person_id
                  where mn.comment_id = c.id), '[]'::jsonb),
               'places', coalesce((
                 select jsonb_agg(pl.slug order by mn.at)
                   from public.comment_mentions mn
                   join public.places pl on pl.id = mn.place_id
                  where mn.comment_id = c.id), '[]'::jsonb)
             ) order by c.created_at, c.id)
        from public.comments c
        join public.collections col on col.id = c.collection_id
        left join public.comments parent on parent.id = c.parent_id
        left join public.profiles parent_author on parent_author.id = parent.author
       where c.author = (select auth.uid())
    ), '[]'::jsonb),
    'hearts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'collection_slug', col.slug,
               'author', author.handle,
               'at', l.created_at
             ) order by l.created_at, l.comment_id)
        from public.comment_likes l
        join public.comments c on c.id = l.comment_id
        join public.collections col on col.id = c.collection_id
        left join public.profiles author on author.id = c.author
       where l.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.my_comment_takeout() from public, anon;
grant execute on function public.my_comment_takeout() to authenticated;
