-- The desk's own copy, named.
--
-- `20260922180000` stamped Google's twenty-three and deliberately left the
-- desk's forty-seven null, on the argument that a credit reading "City Crew"
-- under City Crew's own paragraph is not worth a line on the screen. That
-- argument still holds for the app, and it was the wrong argument for the
-- database: null was doing two jobs — "we wrote this" and "nobody has looked
-- yet" — and no query could separate them.
--
-- So 'editorial' is recorded and not rendered. `blurbCredit` returns null for
-- it exactly as it does for a null source, and the desk shows it as "Written
-- by the desk" so an editor can see the field is set rather than blank.
--
-- Same split as before: multilingual and opinionated is ours, English-only
-- and third-person is Google's. Only rows with a blurb are touched; the 611
-- places with nothing written about them keep their null, which here means
-- what it says.

update public.places
set reviewer_source = 'editorial'
where reviewer_source is null
  and (coalesce(desc_en, '') <> '' or coalesce(desc_vi, '') <> '' or coalesce(desc_ja, '') <> '');

comment on column public.places.reviewer_source is
  'Where the blurb (desc_*) came from: ''threads'', ''google'', ''editorial'' (the desk''s own copy), or whatever comes next. Null means no blurb, or a blurb nobody has attributed yet. Deliberately unconstrained.';
