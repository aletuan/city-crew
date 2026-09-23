-- The blurb's source, for any source.
--
-- The pair added above was Threads-shaped, and the blurb is not: most rows
-- carry Google's own `editorialSummary` (see `import-place.ts` — the field
-- mask asks for editorialSummary, not reviews, so there is no Google author
-- to credit), and a hand-written one has no source at all. Three columns
-- that describe a source instead of one platform:
--
--   reviewer_source  where the words came from. No check constraint on
--                    purpose — the next source should be a row, not a
--                    migration.
--   reviewer_name    the credit as it renders. A Threads handle, bare. Null
--                    for Google, which does not name the author of an
--                    editorial summary; the UI says "Google" from the source
--                    alone.
--   reviewer_url     what a tap opens. The post permalink for Threads. For
--                    Google it may stay null: the place's Maps link is
--                    derivable from `google_place_id` and does not need
--                    storing twice.
--
-- All nullable. A place with no blurb, or a blurb an editor typed, has no
-- source, and that is not a gap to fill.

alter table public.places
  add column if not exists reviewer_source text,
  add column if not exists reviewer_name text,
  add column if not exists reviewer_url text;

update public.places
set reviewer_source = 'threads',
    reviewer_name = reviewer_threads_handle,
    reviewer_url = reviewer_post_url
where reviewer_threads_handle is not null
  and reviewer_source is null;

alter table public.places
  drop column if exists reviewer_threads_handle,
  drop column if exists reviewer_post_url;

comment on column public.places.reviewer_source is
  'Where the blurb (desc_*) came from: ''threads'', ''google'', or whatever comes next. Null means nobody recorded a source. Deliberately unconstrained.';

comment on column public.places.reviewer_name is
  'The credit as it renders — a Threads handle without the @. Null when the source names no author, as Google''s editorial summary does not.';

comment on column public.places.reviewer_url is
  'What a tap on the blurb opens. The post permalink for Threads. Null for Google: build the Maps link from google_place_id instead of storing it twice.';
