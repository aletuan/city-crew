-- Applause carries its author's name now — for the owner, always.
--
-- The first cut named a liker only when they were already the owner's
-- accepted friend, out of deference to the likes table's promise that
-- "a caller cannot learn that you are one of them". Read against real
-- use, that deference landed in the wrong place: the promise was made
-- to keep one person's taste in another's work out of *public* reach,
-- and the owner of the work is not the public. Every mainstream feed
-- attributes likes on your own content to you, and a person tapping a
-- heart on a public list understands its curator will see them do it.
--
-- So the function stops asking whether the liker is a friend, and its
-- columns stop being named as if it mattered — `liker_handle`, not
-- `friend_handle`. What has NOT changed: only the owner can call this
-- about their own lists, private lists never appear, and there is still
-- no path by which anyone else can read who liked what.
--
-- Dropped rather than replaced in place: the return columns are renamed,
-- and `create or replace` cannot change a function's out parameters.

drop function if exists public.likes_on_mine(timestamptz);

create function public.likes_on_mine(since timestamptz)
returns table (collection_id uuid, liked_at timestamptz, liker_handle text, liker_name text)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at, p.handle, p.full_name
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.profiles p on p.id = l.user_id
  where c.owner_id = auth.uid()
    and c.is_public
    and l.user_id <> auth.uid()
    and l.created_at >= since
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_mine(timestamptz) from public;
grant execute on function public.likes_on_mine(timestamptz) to authenticated;
