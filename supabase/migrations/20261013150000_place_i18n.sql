-- Every language beyond the base pair, in one column.
--
-- A place is written in English and Vietnamese: every path that makes a
-- row produces both, 727 live rows carry nothing else, and 68 read sites
-- in the app spell the two out by column. The third language arrived on
-- 8 Aug 2026 as three more columns (`name_ja`, `desc_ja`,
-- `neighborhood_ja`) and the shape showed its cost at once: the desk
-- listed EN and VI by hand and could not show JA for two months (#918),
-- and a fourth language would be three more columns, a migration, four
-- select strings, the search haystack and the generated types — every
-- language a schema change, every schema change a release.
--
-- So from here every language past EN and VI lives in `i18n`, keyed by
-- language, then by field:
--
--   {"ja": {"name": null, "desc": "…", "neighborhood": null, "machine": true}}
--
-- Adding Korean is a key, not DDL. Per-language metadata — `machine`,
-- for a draft `write-blurb` wrote that nobody has read in that language
-- — is a sibling of the text, where a column per language per flag could
-- never go. EN and VI stay as columns, deliberately: they are the pair
-- the catalog is written in, not translations of it.
--
-- A side table (`place_i18n(place_id, lang, …)`) was the other candidate
-- and is the textbook one. It lost on this schema's own terms: every
-- read is a PostgREST select string and every policy is per table, so a
-- second table is two more policies with a join inside the public-read
-- one, for a catalog of 940 rows that fits in one request. See
-- `claude/i18n-expansion-plan.md` for the comparison.
--
-- ── the cut-over, and why it is a trigger and not a generated column ──
--
-- The plan was to turn the three `_ja` columns into generated columns
-- over `i18n`, so the 68 read sites would keep working untouched. They
-- would — and every *write* to those columns would fail, because a
-- generated column cannot be assigned. Three writers do assign them: the
-- desk's Save sends every form field including `name_ja` (and will until
-- its own change ships), `import-place.ts` writes `name_ja` when a sign
-- carries kana, and a SQL update is how the Threads skill wrote `desc_ja`
-- until last week. A generated column would have broken the desk on the
-- day this applied, before the change that stops it writing `_ja` could
-- be deployed — and that change cannot deploy first, because the column
-- it would write to does not exist yet.
--
-- So the `_ja` columns stay real and a trigger keeps the two in step,
-- both ways: a write to `i18n` is copied out to the columns, a write to
-- the columns is copied into `i18n`. Readers of either see the same
-- thing; writers move over one at a time, in whatever order they ship.
-- When nothing writes the columns any more, the columns and the trigger
-- go, in a migration of their own.
--
-- When one statement changes both sides, `i18n` wins. That is the side
-- the future writes to, and the only way both change at once is a
-- caller that has already moved and is sending the old columns out of
-- habit; the new one is the one it meant.

-- ── the shape ──

alter table public.places
  add column if not exists i18n jsonb not null default '{}'::jsonb;

comment on column public.places.i18n is
  'Localized text for every language beyond EN and VI, keyed by language then field: {"ja": {"name","desc","neighborhood","machine"}}. The _ja columns mirror its "ja" entry both ways through sync_place_i18n until nothing writes them.';

-- A CHECK cannot hold a subquery, so the walk over the keys is a function.
-- IMMUTABLE and pure: it reads nothing but its argument, which is what
-- lets Postgres use it in a constraint at all. Keys are two-letter codes,
-- values are objects; what is inside each object is the app's business.
create or replace function public.i18n_well_formed(doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(doc) = 'object'
     and not exists (
       select 1 from jsonb_each(doc) e
        where e.key !~ '^[a-z]{2}$' or jsonb_typeof(e.value) <> 'object'
     );
$$;

alter table public.places
  drop constraint if exists places_i18n_shape;

alter table public.places
  add constraint places_i18n_shape check (public.i18n_well_formed(i18n));

-- ── the mirror ──
--
-- Not `security definer`: it writes the row already being written and
-- needs no privilege of its own.
--
-- An empty string in a text slot is the desk clearing a field, and lands
-- as NULL in the column, as it always has; in the object the key is
-- dropped rather than kept as "" or null, so "nothing written" has one
-- spelling and `i18n->'ja'->>'desc' is null` is the whole test for it.
-- `machine` and any other non-text key in the object are left alone by
-- a column-side write, which is the point of keeping them beside the text.
create or replace function public.sync_place_i18n()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cols_changed boolean;
  json_changed boolean;
  ja jsonb;
begin
  if tg_op = 'INSERT' then
    cols_changed := new.name_ja is not null or new.desc_ja is not null or new.neighborhood_ja is not null;
    json_changed := new.i18n ? 'ja';
  else
    cols_changed := (new.name_ja, new.desc_ja, new.neighborhood_ja)
                    is distinct from (old.name_ja, old.desc_ja, old.neighborhood_ja);
    json_changed := new.i18n -> 'ja' is distinct from old.i18n -> 'ja';
  end if;

  if json_changed then
    new.name_ja         := nullif(btrim(new.i18n -> 'ja' ->> 'name'), '');
    new.desc_ja         := nullif(btrim(new.i18n -> 'ja' ->> 'desc'), '');
    new.neighborhood_ja := nullif(btrim(new.i18n -> 'ja' ->> 'neighborhood'), '');
  elsif cols_changed then
    ja := coalesce(new.i18n -> 'ja', '{}'::jsonb)
          || jsonb_build_object(
               'name',         nullif(btrim(new.name_ja), ''),
               'desc',         nullif(btrim(new.desc_ja), ''),
               'neighborhood', nullif(btrim(new.neighborhood_ja), ''));
    ja := jsonb_strip_nulls(ja);
    -- No text left is no language left: a flag about nothing is dropped
    -- with it, rather than surviving as {"ja": {"machine": true}}.
    if not (ja ? 'name' or ja ? 'desc' or ja ? 'neighborhood') then
      new.i18n := new.i18n - 'ja';
    else
      new.i18n := new.i18n || jsonb_build_object('ja', ja);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists places_sync_i18n on public.places;
create trigger places_sync_i18n
  before insert or update on public.places
  for each row execute function public.sync_place_i18n();

-- ── the backfill ──
--
-- Through the trigger, not around it: assigning the columns to themselves
-- marks nothing changed, so the object is built here and the trigger's
-- `i18n` branch writes the columns back from it — which is the round trip
-- the assertion below checks. 103 live rows carried a `desc_ja` on 13 Oct
-- 2026, 50 a `name_ja`, 23 a `neighborhood_ja`.
update public.places
   set i18n = i18n || jsonb_build_object('ja', jsonb_strip_nulls(jsonb_build_object(
                'name',         nullif(btrim(name_ja), ''),
                'desc',         nullif(btrim(desc_ja), ''),
                'neighborhood', nullif(btrim(neighborhood_ja), ''))))
 where nullif(btrim(name_ja), '') is not null
    or nullif(btrim(desc_ja), '') is not null
    or nullif(btrim(neighborhood_ja), '') is not null;

-- Nothing may read differently through the two doors. Checked here, in
-- the migration, so a project whose columns and object disagree after it
-- is a project where this file did not apply.
do $$
declare n int;
begin
  select count(*) into n from public.places
   where nullif(btrim(name_ja), '')         is distinct from (i18n -> 'ja' ->> 'name')
      or nullif(btrim(desc_ja), '')         is distinct from (i18n -> 'ja' ->> 'desc')
      or nullif(btrim(neighborhood_ja), '') is distinct from (i18n -> 'ja' ->> 'neighborhood');
  if n > 0 then
    raise exception 'place_i18n backfill: % row(s) read differently through the columns and the object', n;
  end if;
end $$;
