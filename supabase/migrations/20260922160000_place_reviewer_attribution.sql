-- Who wrote the blurb.
--
-- `threads_handle` is the venue's own account. This is a different person:
-- the Threads user whose post the blurb (desc_*) was lifted from. Two
-- columns rather than one because the handle is the credit that renders and
-- the permalink is the receipt — it is how an editor re-reads the post the
-- words came from, and how a wrong attribution gets caught.
--
-- Nullable on purpose. Most places came in from Google Places with no post
-- behind them, and a post on the venue's own account is not an independent
-- review, so it leaves these empty and fills `threads_handle` instead.

alter table public.places
  add column if not exists reviewer_threads_handle text,
  add column if not exists reviewer_post_url text;

comment on column public.places.reviewer_threads_handle is
  'Threads handle of the person whose post the blurb (desc_*) was taken from, without the @. Profile URL = https://www.threads.com/@<handle>. Distinct from threads_handle, which is the venue''s own account.';

comment on column public.places.reviewer_post_url is
  'Permalink of the specific Threads post the blurb was extracted from.';
