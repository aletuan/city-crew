-- Who suggested a place, and what a collection is allowed to publish.
--
-- Two halves of one rule. A place a user suggests is not live until the
-- desk says so, but it is theirs immediately — it shows in their own
-- Explore and goes into their own lists. What it may not do is reach
-- anybody else, and the place it would otherwise leak through is a
-- published collection.
--
-- Nothing here opens a submission path. `fetch-place` still refuses
-- anyone off the editors list; this is the ground that path will stand
-- on, and it is inert until then.

-- ─────────────────────────────────────────────────────── who submitted

-- `set null` rather than `cascade`, deliberately. A place that has been
-- approved belongs to the catalog, not to the person who pointed at it,
-- and deleting an account should not take a café out of Hanoi. What is
-- lost is the credit, which is the only part that was ever personal.
alter table public.places
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

create index if not exists places_submitted_by_idx on public.places(submitted_by);

-- The vocabulary, written down while it still cannot conflict with
-- anything: every row in the table is `approved` today, and the dashboard
-- already speaks these three — `PlaceEditor` binds a → approved and
-- f → flagged. Pending and flagged both keep a place out of the catalog,
-- and they are not the same thing to the person waiting: one is *wait*,
-- the other is *no*.
alter table public.places drop constraint if exists places_review_status_check;
alter table public.places
  add constraint places_review_status_check
  check (review_status in ('pending', 'approved', 'flagged'));

-- You can see what you suggested, in whatever state it is in. Policies
-- are OR'd, so this widens the public rule rather than replacing it: the
-- catalog is still `is_published and approved` for everyone else.
drop policy if exists "submitters read their own places" on public.places;
create policy "submitters read their own places" on public.places
  for select using (submitted_by = auth.uid());

-- And its photographs, or the card is a name in an empty frame — which
-- is exactly the state the whole pointer-not-content design exists to
-- avoid. `is_hidden` still applies: a photo the desk pulled stays pulled.
drop policy if exists "submitters read their own place photos" on public.place_photos;
create policy "submitters read their own place photos" on public.place_photos
  for select using (
    is_hidden = false
    and exists (
      select 1 from public.places p
      where p.id = place_photos.place_id and p.submitted_by = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────── live-ness

/**
 * Whether a collection holds anything the public cannot see.
 *
 * Two flags, not one. A place is in the catalog when `is_published` AND
 * `review_status = 'approved'`, and they are genuinely independent —
 * three Da Nang rows are approved and unpublished right now. A gate
 * written against approval alone would pass one of those straight
 * through, and visitors would see fewer places than the owner: precisely
 * the state this is here to prevent.
 *
 * `security definer` is load-bearing rather than habitual. The caller is
 * the owner, and the owner cannot see a place somebody else submitted —
 * so under the caller's own RLS the offending member would be invisible
 * and the check would cheerfully return false. The guard has to see the
 * whole collection to be a guard at all.
 */
create or replace function public.collection_has_unlive_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collection_places cp
      join public.places p on p.id = cp.place_id
     where cp.collection_id = cid
       and not (p.is_published and p.review_status = 'approved')
  );
$$;

revoke execute on function public.collection_has_unlive_member(uuid)
  from anon, authenticated, public;

-- ─────────────────────────────────────────────────── the publish gate

/**
 * Refuse to publish a collection that holds something nobody else can
 * see.
 *
 * Only on the transition into public, so an already-published row can
 * still be edited; only on owned rows, because editorial collections are
 * published by seed migrations and have no owner to protect.
 *
 * The message is matched by the app, the way `handle_reserved` already
 * is in `lib/auth.tsx`. It has to name the condition rather than describe
 * it, because the sentence the user reads is written in three languages
 * on the client, not here.
 */
create or replace function public.guard_collection_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public
     and not coalesce(old.is_public, false)
     and new.owner_id is not null
     and public.collection_has_unlive_member(new.id)
  then
    raise exception 'collection_has_pending_places'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_collection_publish() from anon, authenticated, public;

drop trigger if exists collections_guard_publish on public.collections;
create trigger collections_guard_publish
  before update on public.collections
  for each row execute function public.guard_collection_publish();

-- ──────────────────────────────────────────────── falling back private

-- A published collection can acquire an unseeable member from either
-- side, so both sides are covered. In both cases the collection goes
-- quietly back to private rather than staying public and lying about
-- what it contains — and `stamp_curator` takes the byline with it, since
-- that already fires on any unpublish.

/**
 * The owner adds a pending place to a list that is already public.
 *
 * `after insert`, not `before`: the row has to exist for the state to be
 * true, and the collection is a different table from the one being
 * written, so there is nothing to gain by going early.
 */
create or replace function public.unpublish_on_unlive_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.places p
     where p.id = new.place_id
       and not (p.is_published and p.review_status = 'approved')
  ) then
    update public.collections
       set is_public = false
     where id = new.collection_id and is_public and owner_id is not null;
  end if;
  return new;
end;
$$;

revoke execute on function public.unpublish_on_unlive_member() from anon, authenticated, public;

drop trigger if exists collection_places_unpublish on public.collection_places;
create trigger collection_places_unpublish
  after insert on public.collection_places
  for each row execute function public.unpublish_on_unlive_member();

/**
 * The desk flags or unpublishes a place that is already in somebody's
 * published list.
 *
 * This one cannot be done by the collection's owner — the editor is
 * acting on a row belonging to a stranger, and the owner's update policy
 * would refuse it. `security definer` is what makes it possible, and the
 * `where` is narrowed to the collections actually holding this place so
 * that power reaches no further than the fact requires.
 */
create or replace function public.unpublish_collections_of_pulled_place()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.is_published and old.review_status = 'approved')
     and not (new.is_published and new.review_status = 'approved')
  then
    update public.collections c
       set is_public = false
     where c.is_public
       and c.owner_id is not null
       and exists (
         select 1 from public.collection_places cp
          where cp.collection_id = c.id and cp.place_id = new.id
       );
  end if;
  return new;
end;
$$;

revoke execute on function public.unpublish_collections_of_pulled_place()
  from anon, authenticated, public;

drop trigger if exists places_unpublish_collections on public.places;
create trigger places_unpublish_collections
  after update on public.places
  for each row execute function public.unpublish_collections_of_pulled_place();
