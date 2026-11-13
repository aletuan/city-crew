-- An activity row carries the actor's face and id (owner, 13 Nov 2026).
--
-- ── one round trip instead of two ──
--
-- A list's activity page (`CollectionActivityScreen`) asked these two
-- functions for its rows, and only once they had answered did it know
-- whose faces to ask for: a second read, `profiles` by handle
-- (`fetchCuratorAvatars`), sent after the first came back. Two round
-- trips in a row, the second waiting on the first, before a row had its
-- face. The profile each row names is already joined here for the handle
-- and the name, so its picture is one more column off the same row, and
-- the second read has nothing left to ask.
--
-- ── the id, for the friend button ──
--
-- The same page puts a friend button on each row — Add friend, Requested,
-- Accept, Friends — and every one of those is a question about an
-- account id: `friendships` keys on ids, and `standingWith` reads them.
-- The rows named a person only by handle and name, which the app cannot
-- turn into an id without a lookup per row.
--
-- The id is the profile's (`p.id`), not the like's `user_id` or the
-- copy's `owner_id`. While the profile stands they are the same value;
-- when it is gone, the handle, the name and the face are already null,
-- and an id with nobody behind it would put "Add friend" on a row that
-- says "Someone". One source for everything a row says about who.
--
-- ── what the owner learns that they did not know ──
--
-- Nothing about the person they could not already read. `profiles` is
-- world-readable (`fetchProfilesById`, `fetchCuratorAvatars` read it
-- with the public key): the face is the one the byline on that person's
-- own lists wears, and the id is what any of those reads returns beside
-- it. The handle and the name were the answer to "who"; the id and the
-- face are the same answer in the two forms the app needed it in. A
-- face cleared by the desk (`moderate_profile`, `clear_avatar`) is an
-- empty `avatar_url`, so it comes back empty here too.
--
-- Who may ask is unchanged: the owner of the list, and nobody else —
-- `owner_id = auth.uid()` on both, as before. Every filter in the bodies
-- below is the last migration's, word for word
-- (`20261113120000_likes_kept_off_public.sql`): the owner's own acts left
-- out, anybody the owner has blocked left out, `since` as it was, no
-- `is_public`. `auth.uid()` bare, as it stood there: these are definer
-- functions, not policies, so the ask-once rewrite has nothing to say to
-- them.
--
-- ── why drop and create ──
--
-- A new column is a new return type, and `create or replace` refuses to
-- change one. So each function is dropped and made again — inside the
-- one transaction a migration runs in, so no caller sees the gap.
--
-- A dropped function takes its grants with it, and the new one gets the
-- schema's defaults. Since `20260910150000_close_signed_in_functions_to_
-- anon` those are already what these two need — no `public`, no `anon`,
-- `authenticated` by name — so the revoke and the grant after each create
-- change nothing today. They are kept, as the last migration stated them,
-- so the file says what the functions allow without sending the reader to
-- the defaults, and so a later change to the defaults cannot open them.
-- That also means no test can tell them apart from their absence: the
-- mutants that drop them pass the bench, which is the defaults holding,
-- not a hole in the test. `activity_rows_carry_face_test` asserts the
-- grants the functions end up with.
--
-- Nothing else in the database calls either function — no view, no
-- other function (`friend_suggestions` reads the tables, and names these
-- two only in a comment) — so the drop takes nothing with it. Grepped
-- across `supabase/migrations` on 13 Nov 2026.
--
-- The new columns go last, so a reader of the old four still finds them
-- where they were. The app's types take them as optional
-- (`lib/friends.ts`): an update can reach a phone before this migration
-- reaches the live project, and the page then draws the blank disc and
-- no button rather than failing.
--
-- Rejected: a separate `activity_faces(ids)` function. The second round
-- trip again, under a new name.

drop function public.likes_on_mine(timestamptz);

create function public.likes_on_mine(since timestamptz)
returns table (
  collection_id uuid, liked_at timestamptz, liker_handle text, liker_name text,
  liker_id uuid, liker_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, l.created_at, p.handle, p.full_name, p.id, p.avatar_url
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  left join public.profiles p on p.id = l.user_id
  where c.owner_id = auth.uid()
    and l.user_id <> auth.uid()
    and l.created_at >= since
    and not exists (
      select 1 from public.blocks b
      where b.blocker = auth.uid() and b.blocked = l.user_id
    )
  order by l.created_at desc;
$$;

revoke all on function public.likes_on_mine(timestamptz) from public, anon;
grant execute on function public.likes_on_mine(timestamptz) to authenticated;

drop function public.copies_of_mine(timestamptz);

create function public.copies_of_mine(since timestamptz)
returns table (
  collection_id uuid, copied_at timestamptz, copier_handle text, copier_name text,
  copier_id uuid, copier_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, c.created_at, p.handle, p.full_name, p.id, p.avatar_url
  from public.collections c
  join public.collections o on o.id = c.copied_from
  left join public.profiles p on p.id = c.owner_id
  where o.owner_id = auth.uid()
    and c.owner_id is distinct from auth.uid()
    and c.created_at >= since
    and not exists (
      select 1 from public.blocks b
      where b.blocker = auth.uid() and b.blocked = c.owner_id
    )
  order by c.created_at desc;
$$;

revoke all on function public.copies_of_mine(timestamptz) from public, anon;
grant execute on function public.copies_of_mine(timestamptz) to authenticated;
