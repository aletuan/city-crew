-- Liking a public collection, and the shelf order that follows from it.
--
-- The shelf used to be ordered by `created_at desc, sort_order`. Neither
-- was a judgement about worth: the fifteen seeded lists share one
-- timestamp — the instant the column was added — and `sort_order` is the
-- order they happened to be gieo'd in. So the front of the shelf was
-- decided by an accident of the seed script, and the ask is for it to be
-- decided by readers instead.
--
-- ── why a table ──
--
-- This repo is reluctant about new state and the bar is "cannot be
-- derived". A like clears it: it is a fact about one person's response to
-- somebody else's list, and nothing existing records anything of the
-- kind. `collection_places` says what is *in* a list; `place_events` (opt
-- in, default off) is about places, not lists. There is no second source.
--
-- ── who may count, and who may look ──
--
-- Two different questions, and conflating them is the mistake this
-- migration exists to avoid. The *count* is public — it is the whole
-- point, it orders a shelf everyone sees. *Who liked what* is not: it is
-- a record of one person's taste in another person's work, and a
-- readable likes table hands that to anybody with the anon key.
--
-- So the table is readable only by its own author, and the counts come
-- out through `collection_like_counts()`, a security-definer function
-- that returns totals and no user ids at all. A caller can learn that a
-- list has forty likes. A caller cannot learn that you are one of them.
--
-- ── a like is not a save ──
--
-- The app already has saving: `collection_places` puts a *place* into a
-- list of *yours*. This is the other direction — a public gesture toward
-- somebody else's list, with no copy taken and nothing added to your own
-- shelf. They wear different glyphs for that reason.

create table if not exists public.collection_likes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Not decoration. Total likes ranks by age as much as by worth: a list
  -- posted six months ago outscores a better one posted yesterday, and a
  -- shelf ordered that way ossifies — the same few stay on top and
  -- nothing new ever surfaces. The fix is a time-aware score, which is
  -- not worth choosing constants for while the counts are all zero. This
  -- column is what lets that arrive later as a change to one pure
  -- function rather than another migration.
  created_at    timestamptz not null default now(),
  primary key (collection_id, user_id)
);

-- The shelf reads counts for every collection at once, so the index that
-- matters is the one grouping by collection. The primary key already
-- leads with `collection_id`, which serves it.
--
-- `on delete cascade` on both sides is load-bearing rather than tidy: the
-- seeded lists are placeholders and will be replaced, and an account can
-- be deleted at any time. Neither should leave a like pointing at
-- nothing, because a count that includes ghosts is a wrong count.

alter table public.collection_likes enable row level security;

-- Read your own rows and nobody else's. This is what makes the "who"
-- private; the "how many" comes out of the function below.
drop policy if exists "readers see their own likes" on public.collection_likes;
create policy "readers see their own likes" on public.collection_likes
  for select using (auth.uid() = user_id);

-- Like as yourself, on a public list, and never on your own.
--
-- The last clause is the one with a reason beyond hygiene. The shelf is
-- meant to show what a community prefers; a curator liking their own list
-- is one person voting for themselves, and with a small user base that
-- single vote is enough to decide the order. Enforced here rather than in
-- the app because a rule that orders a public shelf has to hold against
-- anything holding the anon key, not just against our own screens.
drop policy if exists "readers like public collections" on public.collection_likes;
create policy "readers like public collections" on public.collection_likes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.collections c
      where c.id = collection_id
        and c.is_public
        and (c.owner_id is null or c.owner_id <> auth.uid())
    )
  );

drop policy if exists "readers unlike their own" on public.collection_likes;
create policy "readers unlike their own" on public.collection_likes
  for delete using (auth.uid() = user_id);

-- Totals, and nothing else.
--
-- Security definer so it can see past the select policy above, and its
-- return type is the reason that is safe: collection ids and integers,
-- with no way to ask which rows produced them.
--
-- Only public collections appear. A private list's count is nobody's
-- business, and it has no shelf to be ordered on.
create or replace function public.collection_like_counts()
returns table (collection_id uuid, likes integer)
language sql
stable
security definer
set search_path = public
as $$
  select l.collection_id, count(*)::integer
  from public.collection_likes l
  join public.collections c on c.id = l.collection_id
  where c.is_public
  group by l.collection_id;
$$;

revoke all on function public.collection_like_counts() from public;
grant execute on function public.collection_like_counts() to anon, authenticated;
