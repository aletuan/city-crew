-- Which door a place came in through.
--
-- Four of them, and they behave differently enough that the desk needs to
-- tell them apart: a scan run brings in twenty at once and none of them
-- have been looked at; a phone suggestion is one person vouching for one
-- place; a desk import is an editor who already decided. `submitted_by`
-- answered only the third question — everything that was not a phone
-- suggestion wrote NULL, which put three different origins in one bucket.
--
--   'seed'   the frozen HCMC bootstrap (data/scripts/fetch-places.mjs)
--   'scan'   supabase/functions/scan-city — a batch, by category
--   'desk'   supabase/functions/fetch-place, action 'import'  (an editor)
--   'phone'  supabase/functions/fetch-place, action 'suggest' (anyone)
--
-- Nullable on purpose. A row written before this column existed and after
-- this backfill would otherwise have to claim an origin nobody recorded,
-- and NULL is the honest word for that. New rows always carry one.

alter table public.places
  add column if not exists source text
  check (source is null or source in ('seed', 'scan', 'desk', 'phone'));

comment on column public.places.source is
  'Which pipeline created this row: seed | scan | desk | phone. Null on rows that predate the column and could not be attributed.';

-- ─────────────────────────────── backfill ───────────────────────────────
--
-- Two of the four are recorded fact. Two are derived, and the derivation
-- is written out here rather than left in a commit message, because a
-- column that says "scan" cannot itself say how confident it is.

-- 1. phone — observed. `submitted_by` is stamped inside the Edge Function
--    and never accepted from a request body, so it is not a guess.
update public.places set source = 'phone' where submitted_by is not null;

-- 2. seed — observed. These slugs are the frozen candidate list checked
--    into the repo at data/seeds/candidates.json. Cross-checked against
--    creation time when this was written: all 24 matches were created in
--    the same minute (2026-08-06 11:31Z), and that minute contained no
--    other row. Two independent facts, zero disagreement.
update public.places set source = 'seed'
 where source is null
   and slug in (
     'cafe-apartment','workshop-coffee','cong-caphe-dong-khoi','little-hanoi-egg-coffee',
     'okkio-caffe','shin-coffee','bang-khuang-cafe','cheo-leo-cafe','oromia-coffee',
     'lusine-le-loi','ben-thanh-street-food','secret-garden','banh-mi-huynh-hoa','pho-le',
     'com-tam-ba-ghien','banh-xeo-46a','oc-dao','ho-thi-ky-food-street',
     'vinh-khanh-food-street','lunch-lady','landmark-81-skyview','saigon-night-cruise',
     'chill-skybar','blank-lounge','the-deck-saigon','social-club-rooftop',
     'independence-palace','war-remnants-museum','notre-dame-cathedral',
     'central-post-office','jade-emperor-pagoda','thien-hau-temple','fine-arts-museum',
     'saigon-opera-house','tao-dan-park','book-street','starlight-bridge',
     'nguyen-hue-walking-street','saigon-zoo','vinhomes-central-park','saigon-square',
     'vincom-dong-khoi','takashimaya','the-new-playground','an-dong-market',
     'bui-vien-walking-street','acoustic-bar','broma-not-a-bar','carmen-bar','bitexco-skydeck'
   );

-- 3. scan — derived, from two signals that agree.
--
--    Timing: scan-city imports a whole city in one run, so its rows arrive
--    in a burst. Two bursts exist — Hanoi on 2026-08-08 and Da Nang on
--    2026-08-09 — of 28 and 26 rows over a few minutes each.
--
--    Photographs: scan-city caps at PHOTOS_PER_PLACE = 3; fetch-place asks
--    for 6. Of the 54 rows in those bursts, **none** carries more than
--    three Google photos. Of the 33 rows outside them, 21 do, reaching 6.
--    If the bursts were desk imports, roughly two thirds of them should
--    have exceeded three as well. None did.
--
--    The photo count is used as a veto rather than as proof: it can only
--    rule a row out of 'scan' (Google may simply have had two pictures of
--    a café an editor imported by hand). So the burst window proposes and
--    the photo cap refuses.
update public.places p set source = 'scan'
 where p.source is null
   and (
     (p.created_at >= timestamptz '2026-08-08 06:58Z' and p.created_at < timestamptz '2026-08-08 07:05Z')
     or
     (p.created_at >= timestamptz '2026-08-09 02:01Z' and p.created_at < timestamptz '2026-08-09 02:05Z')
   )
   and (
     select count(*) from public.place_photos ph
      where ph.place_id = p.id and ph.source = 'google'
   ) <= 3;

-- 4. desk — by elimination, and only that. There is no positive evidence
--    for this bucket: it is what is left once the three above are taken
--    out. Anything reaching this line was created by a signed-in editor
--    through some path, and 'desk' is the only one of the four that
--    describes an editor acting one place at a time.
update public.places set source = 'desk' where source is null;

-- The desk asks "what came in from where" per city, so this is the shape
-- that question takes. Not partial: unlike needs_classification, every
-- value here is one somebody may filter on.
create index if not exists places_source_idx on public.places (city_id, source);
