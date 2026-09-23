-- The blurbs that were already here, attributed.
--
-- `reviewer_source` arrived after 683 places did, so every blurb written
-- before it is unattributed. Two kinds sit in that pile and they are
-- distinguishable by shape:
--
--   Google's editorial summary  English only, because `import-place.ts`
--       writes `desc_en` and nothing else. Third-person, no opinion, heavy
--       on ampersands: "Airy, industrial-chic cafe and micro-roaster serving
--       brunch, sandwiches and specialty teas." Twenty-three of them.
--
--   The desk's own copy  Written in Vietnamese as well, usually Japanese
--       too, and it argues: "cheaper than Landmark 81", "exactly what some
--       nights need", "book the river edge and arrive early". Forty-seven.
--
-- So the English-only ones are Google's and the multilingual ones are ours.
-- Only the first group is stamped. The desk's own writing keeps a null
-- source, which is the honest answer: there is no outside source to credit
-- and nowhere for a tap to go. Calling it 'editorial' would add a credit
-- line to forty-seven screens that reads "City Crew" under City Crew's own
-- paragraph.
--
-- Going forward the import stamps this itself, so this runs once.

update public.places
set reviewer_source = 'google'
where reviewer_source is null
  and google_place_id is not null
  and desc_en is not null and desc_en <> ''
  and coalesce(desc_vi, '') = ''
  and coalesce(desc_ja, '') = '';
