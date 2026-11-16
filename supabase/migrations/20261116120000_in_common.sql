-- What two people have in common, on a person's page (owner, 16 Nov 2026).
--
-- A person's page (`PersonScreen`) said "3 mutual saves" beside the count
-- of their lists, to a friend only, as a number nothing opened. The owner
-- asked for a section of its own — what the reader and this person have
-- in common — and named two kinds to begin with:
--
--   - places you both keep in public collections (the number's own
--     meaning, `mutual_saves_counts`, as rows);
--   - public collections you both liked.
--
-- ── who is told (owner, the same day) ──
--
-- Anybody signed in, friend or not; nobody signed out. The owner's worry
-- that day was a stranger seeing too much, and these two were let through
-- it for two reasons, both of which a later kind must also pass:
--
--   1. Only the intersection with the asker. This is not "everything this
--      person liked" — a history of them — but the part of it the asker
--      shares, and the asker learns of a place or a list only what they
--      have already done to it themselves.
--   2. Only from what is already public to that asker. A place is in a
--      *public* list of each; a like on a public list is already named on
--      that list's activity page to anybody signed in
--      (`20261115090000_list_activity_for_readers`). Nothing private is
--      read to compute what is shown — a place saved privately by both
--      would tell the asker what the other keeps private, and is not here.
--
-- Not here, and why: places both checked in at (the policy does not show
-- one person's check-ins to another; that is a decision and a setting of
-- its own), and trips.
--
-- ── the rules both keep ──
--
--   - Nothing for nobody (`auth.uid()` null) and nothing about yourself.
--   - Nothing across a block, either way: a block is a contact policy, and
--     "here is what you two share" is contact.
--   - A like by somebody the list's owner has blocked is not named on that
--     list's page, so it is not counted here either.
--   - Only places that are live (`is_published`, approved), as the count
--     has read them since `20261023010000`.
--   - Thirty rows at most, each. A page draws a row of them, not a
--     catalogue; the cap is also what keeps one call from being a scrape.
--
-- `mutual_saves_counts` is left as it is: Crew's rows and its suggestions
-- read it, for friends, in one call for many people.

create function public.places_in_common(other uuid)
returns table (slug text, name_en text, name_vi text, name_ja text, photo_uri text)
language sql
stable
security definer
set search_path = public
as $$
  with held as (
    select c.owner_id, cp.place_id
    from public.collection_places cp
    join public.collections c on c.id = cp.collection_id
    where c.is_public and c.owner_id in (auth.uid(), other)
  )
  select p.slug, p.name_en, p.name_vi, p.name_ja,
    -- The place's cover, else its first photograph that is not hidden.
    (select ph.photo_uri from public.place_photos ph
      where ph.place_id = p.id and ph.is_hidden = false
      order by ph.is_cover desc, ph.sort_order, ph.created_at
      limit 1)
  from public.places p
  where auth.uid() is not null
    and other is distinct from auth.uid()
    and p.is_published and p.review_status = 'approved'
    and exists (select 1 from held h where h.owner_id = auth.uid() and h.place_id = p.id)
    and exists (select 1 from held h where h.owner_id = other and h.place_id = p.id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = other)
         or (b.blocker = other and b.blocked = auth.uid())
    )
  order by coalesce(p.name_vi, p.name_en), p.slug
  limit 30;
$$;

revoke all on function public.places_in_common(uuid) from public, anon;
grant execute on function public.places_in_common(uuid) to authenticated;

create function public.lists_liked_in_common(other uuid)
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select c.slug
  from public.collections c
  join public.collection_likes mine on mine.collection_id = c.id and mine.user_id = auth.uid()
  join public.collection_likes theirs on theirs.collection_id = c.id and theirs.user_id = other
  where auth.uid() is not null
    and other is distinct from auth.uid()
    and c.is_public
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = other)
         or (b.blocker = other and b.blocked = auth.uid())
    )
    -- Their like is not named on the list's own page to anybody when
    -- the list's owner has blocked them.
    and not exists (
      select 1 from public.blocks b
      where b.blocker = c.owner_id and b.blocked = other
    )
  -- The one most lately liked by either, first.
  order by greatest(mine.created_at, theirs.created_at) desc, c.slug
  limit 30;
$$;

revoke all on function public.lists_liked_in_common(uuid) from public, anon;
grant execute on function public.lists_liked_in_common(uuid) to authenticated;
