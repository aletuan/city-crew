-- A copy remembers the list it was copied from, and the owner of that
-- list gets to hear about it.
--
-- ── the gap ──
--
-- "Save a copy" is the strongest compliment the app lets one reader pay
-- another's list — stronger than a like, since it is the list they want
-- to keep and change — and until now it left no trace. `copyCollection`
-- created a fresh list; nothing on the row said where it came from, so
-- the curator never heard, and Activity, which exists to tell a reader
-- what others did with their lists, could not say (owner, 7 Oct 2026).
--
-- ── the column ──
--
-- `copied_from` on the copy, nullable, pointing at the original. Set
-- once by the client at the moment the copy is born; `on delete set null`
-- so a curator deleting their list does not take the copies with it —
-- the copy is the copier's, and was from the start. It names a list,
-- never a person: who made the original is read off the original when
-- it is needed, so a change of hands there is not a stale name here.
--
-- ── the function ──
--
-- `copies_of_mine(since)` is `likes_on_mine`'s twin, under the same
-- rules: only the owner of the original can ask, only about originals
-- that are public, never about their own copies of their own lists,
-- never naming anyone they have blocked. The copy's own privacy is not
-- opened: the function returns that a copy was made and by whom, not
-- the copy — a reader who copies a public list into a private one has
-- told its curator exactly what a like tells them, and no more.
--
-- Definer, like its twin, because the copier's row is theirs and the
-- owner's select policy does not reach it; `set search_path` pinned for
-- the reason `search_path_test.sql` enforces on every function here.

alter table public.collections
  add column if not exists copied_from uuid references public.collections(id) on delete set null;

comment on column public.collections.copied_from is
  'The list this one was saved as a copy of, when it was. Set at birth by the client; null for every list made from scratch.';

create index if not exists collections_copied_from on public.collections (copied_from) where copied_from is not null;

create or replace function public.copies_of_mine(since timestamptz)
returns table (collection_id uuid, copied_at timestamptz, copier_handle text, copier_name text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, c.created_at, p.handle, p.full_name
  from public.collections c
  join public.collections o on o.id = c.copied_from
  left join public.profiles p on p.id = c.owner_id
  where o.owner_id = auth.uid()
    and o.is_public
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
