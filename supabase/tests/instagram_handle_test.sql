-- The Instagram handle: what the trigger accepts, and what the backfill
-- refuses to guess.
--
-- Two things are under test and they are different in kind. The trigger is a
-- normaliser — whatever an editor pastes has to come out as the one bare form
-- the constraint allows, or the write fails on punctuation nobody meant to
-- type. The backfill is an inference — it reads a URL somebody filed under
-- `website` and decides it names an account — and the interesting half of an
-- inference is the cases it declines.
--
-- `threads_handle` has carried the same trigger since September with no test
-- at all. This file covers the pair by covering the newer one: they are the
-- same seven lines with one host swapped, so a change that breaks one here
-- would have broken the other silently.

-- --------------------------------------------------------------- the shape

-- Not `security definer`. It writes a column on the row already being
-- written and needs no privilege; a trigger that asks for rights it does not
-- use is a bigger endpoint than it needs to be.
do $$
declare def bool;
begin
  select p.prosecdef into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'stamp_instagram_handle';
  assert def is not null, 'stamp_instagram_handle does not exist';
  assert not def, 'stamp_instagram_handle became security definer; it has no need to see past RLS';
end $$;

-- ------------------------------------------------------------- the trigger

do $$
declare got text;
begin
  -- The likeliest input by a distance: a URL out of the address bar, with
  -- the scheme, the www, and whatever Instagram's share sheet attached.
  insert into public.places (slug, instagram_handle)
    values ('ig-url', 'https://www.instagram.com/cab.cafesg?igsh=MXJod3k3djk0&utm_source=qr')
    returning instagram_handle into got;
  assert got = 'cab.cafesg', format('a pasted URL became %L', got);

  -- Bare, with the punctuation a person types by hand.
  insert into public.places (slug, instagram_handle) values ('ig-at', '@Sweet.As.Hanoi')
    returning instagram_handle into got;
  assert got = 'sweet.as.hanoi', format('an @handle became %L', got);

  -- A trailing slash is a path, and a path is not part of a name.
  insert into public.places (slug, instagram_handle) values ('ig-slash', 'instagram.com/beo.cafe/')
    returning instagram_handle into got;
  assert got = 'beo.cafe', format('a trailing slash became %L', got);

  -- Whitespace from a clipboard, and a fragment from nowhere in particular.
  insert into public.places (slug, instagram_handle) values ('ig-trim', '   @roru.vn#top  ')
    returning instagram_handle into got;
  assert got = 'roru.vn', format('a padded handle became %L', got);

  -- Nothing left after the punctuation is nothing, not an empty string. An
  -- empty string would fail the constraint, which is a confusing way for a
  -- blank field to be reported.
  insert into public.places (slug, instagram_handle) values ('ig-empty', '@')
    returning instagram_handle into got;
  assert got is null, format('a lone @ became %L rather than null', got);
end $$;

-- The constraint still bites for anything the trigger cannot rescue. Thirty
-- is Instagram's own limit; this is thirty-one.
do $$
begin
  begin
    insert into public.places (slug, instagram_handle)
      values ('ig-long', repeat('a', 31));
    assert false, 'a 31-character handle was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ------------------------------------------------------------ the backfill
--
-- Re-run here against rows this bench makes, because the migration's own pass
-- ran against an empty stub. The statement is the migration's, copied — if
-- the two drift, this test is asserting something that is no longer shipped,
-- so keep them together.

insert into public.places (slug, website) values
  ('bf-profile', 'https://www.instagram.com/troncaphe.saigon?utm_source=qr'),
  ('bf-plain',   'instagram.com/phemen.saigon'),
  ('bf-post',    'https://www.instagram.com/p/C8xYzAbCdEf/'),
  ('bf-reel',    'https://instagram.com/reel/C8xYzAbCdEf/'),
  ('bf-explore', 'https://www.instagram.com/explore/tags/hanoi/'),
  ('bf-other',   'https://anticofornaio.com/?utm_source=google');

update public.places
   set instagram_handle = website
 where instagram_handle is null
   and website ~* '^(https?://)?(www\.)?instagram\.com/'
   and lower(split_part(split_part(split_part(
         ltrim(regexp_replace(website, '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '@'),
         '/', 1), '?', 1), '#', 1)) ~ '^[a-z0-9._]{1,30}$'
   and lower(split_part(regexp_replace(website, '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '/', 1))
       not in ('p', 'reel', 'reels', 'explore', 'stories', 'tv');

do $$
declare got text;
begin
  select instagram_handle into got from public.places where slug = 'bf-profile';
  assert got = 'troncaphe.saigon', format('a profile URL backfilled as %L', got);

  select instagram_handle into got from public.places where slug = 'bf-plain';
  assert got = 'phemen.saigon', format('a schemeless profile URL backfilled as %L', got);

  -- The declines. A post, a reel and a tag page all live on instagram.com and
  -- none of them is a venue's account; reading `p` or `explore` as a handle
  -- would put a link to somebody else's photograph on the place.
  select instagram_handle into got from public.places where slug = 'bf-post';
  assert got is null, format('a post URL backfilled as %L', got);

  select instagram_handle into got from public.places where slug = 'bf-reel';
  assert got is null, format('a reel URL backfilled as %L', got);

  select instagram_handle into got from public.places where slug = 'bf-explore';
  assert got is null, format('an explore URL backfilled as %L', got);

  select instagram_handle into got from public.places where slug = 'bf-other';
  assert got is null, format('an ordinary website backfilled as %L', got);

  -- And the website is left where it was. It is the only record of where the
  -- handle came from; the screen decides for itself not to draw it twice.
  select website into got from public.places where slug = 'bf-profile';
  assert got is not null, 'the backfill cleared the website it read';
end $$;

delete from public.places where slug like 'ig-%' or slug like 'bf-%';

select 'all instagram handle checks passed' as result;
