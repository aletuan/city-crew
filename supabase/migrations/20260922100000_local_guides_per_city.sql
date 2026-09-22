-- A local guide is granted a city, or all of them.
--
-- `local_guides` had `user_id` as its primary key: one row per person,
-- and the grant meant "anywhere". That was right while the catalog was
-- three cities and every guide was somebody the desk knew personally. It
-- is nine cities now, across two countries, and "somebody who knows this
-- neighbourhood" is a claim about a place, not about a person.
--
-- ── how "all cities" is written ──
--
-- `city_id is null`. Not a sentinel row and not one row per city:
--
--   A sentinel ('*', '') could not carry the foreign key to `cities`,
--   which is what stops a grant naming a city that does not exist.
--
--   One row per city would be a snapshot. A guide granted "everywhere"
--   in September would silently not cover a city added in October, and
--   nothing would say so — the grant would look complete and be short.
--
-- NULL cannot sit in a composite primary key, so the key becomes a
-- surrogate and the two shapes of uniqueness are written as partial
-- indexes: at most one all-cities row per person, and at most one row
-- per person per city.
--
-- ── what happens to the rows that exist ──
--
-- They get `city_id is null`, so every grant made before this migration
-- means exactly what it meant yesterday: every city, including ones not
-- added yet. Nothing changes for anybody until the desk deliberately
-- makes a narrower grant.

alter table public.local_guides
  add column if not exists city_id text references public.cities(id) on delete cascade;

comment on column public.local_guides.city_id is
  'The city this grant covers. NULL means every city, including ones added later.';

-- The surrogate key. `gen_random_uuid()` is in core since 13 and already
-- used by `trips` and `reports`.
alter table public.local_guides
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.local_guides'::regclass and contype = 'p'
      and conname = 'local_guides_pkey'
  ) and not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.local_guides'::regclass and i.indisprimary
      and (select attname from pg_attribute
           where attrelid = i.indrelid and attnum = i.indkey[0]) = 'id'
  ) then
    alter table public.local_guides drop constraint local_guides_pkey;
    alter table public.local_guides add constraint local_guides_pkey primary key (id);
  end if;
end $$;

-- One "everywhere" row per person, and one row per person per city. Two
-- partial indexes rather than one over `coalesce(city_id, '')`, because
-- these say two different things and a reader should not have to work
-- out which one a violation meant.
create unique index if not exists local_guides_user_everywhere_idx
  on public.local_guides (user_id) where city_id is null;
create unique index if not exists local_guides_user_city_idx
  on public.local_guides (user_id, city_id) where city_id is not null;

-- ── the question, now asked about a city ──
--
-- Two functions rather than one with a default, because they answer
-- genuinely different questions and the difference matters at the call
-- site:
--
--   is_local_guide()          a guide of somewhere. The storage policy
--                             asks this, because a file lands in the
--                             uploader's own folder before any place is
--                             named and there is no city to check yet.
--                             The row that attaches it to a place is
--                             where the city is enforced.
--
--   is_local_guide(city)      a guide of this city. Everything with a
--                             place in hand asks this one.
--
-- The no-argument version keeps its old body on purpose: it is still
-- "has this person been given the role at all", which is what the
-- storage policy has always meant by it.

create or replace function public.is_local_guide(p_city_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.local_guides
    where user_id = auth.uid()
      and (city_id is null or city_id = p_city_id)
  );
$function$;

comment on function public.is_local_guide(text) is
  'Whether the caller may act as a local guide in this city. An all-cities grant (city_id is null) answers yes for every city.';

-- Supabase grants EXECUTE on every new function to `anon` by name; see
-- `20260910150000_close_signed_in_functions_to_anon` and the rule
-- `function_grants_test.sql` enforces. This one is only ever reached
-- from policies written `to authenticated`.
revoke execute on function public.is_local_guide(text) from anon;

-- ── the policies that have a place, and so have a city ──

drop policy if exists "local guides add photos to their own places" on public.place_photos;
create policy "local guides add photos to their own places" on public.place_photos
  for insert to authenticated
  with check (
    is_local_guide()
    and uploaded_by = auth.uid()
    and source = 'upload'
    and is_cover = false
    and is_hidden = false
    and exists (
      select 1 from public.places p
      where p.id = place_id
        and p.submitted_by = auth.uid()
        -- The city of the place, not of the person. A guide of Đà Nẵng
        -- who submitted something in Huế is, for that place, a reader.
        and public.is_local_guide(p.city_id)
    )
    and public.own_place_photos_today() < 10
    and public.own_photos_on_place(place_id) < 5
  );

drop policy if exists "guides remove photos on their own places" on public.place_photos;
create policy "guides remove photos on their own places" on public.place_photos
  for delete using (
    is_local_guide()
    and exists (
      select 1 from public.places p
      where p.id = place_photos.place_id
        and p.submitted_by = auth.uid()
        and public.is_local_guide(p.city_id)
    )
  );

-- The cover, the hiding and the ordering all go through this one.
create or replace function public.guide_may_manage(photo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.place_photos ph
    join public.places p on p.id = ph.place_id
    where ph.id = photo
      and p.submitted_by = auth.uid()
      and public.is_local_guide(p.city_id)
  );
$$;

comment on function public.guide_may_manage(uuid) is
  'Whether the caller may change this photograph: a local guide in the place''s city, on a place they submitted. Any photograph on the place — the same hands as the desk.';
