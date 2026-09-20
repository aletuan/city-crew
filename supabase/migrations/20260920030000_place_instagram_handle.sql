-- A place's own Instagram account, stored the way its Threads account is.
--
-- The column is new; the data is not. Of the 413 published places carrying a
-- `website`, 47 have an instagram.com profile in that field and 121 have a
-- facebook.com one — 41% of what the app calls a website is a social profile
-- filed under the wrong name. The website row renders those as a truncated
-- URL with the tracking string still on it, which is the worst of both: it
-- is not a website, and it is not a handle either.
--
-- So the 47 come out into a column of their own, shaped exactly like
-- `threads_handle` (`20260901140000_place_threads_handle.sql`): bare, no
-- leading "@", lowercase. The @ is punctuation the renderer adds back, and
-- one canonical form is one thing to compare.
--
-- The facebook ones stay where they are. A Facebook page is not a handle in
-- the same sense — `facebook.com/people/<name>/<17-digit-id>` is a third of
-- the set — and inventing a column to hold a numeric id would be a column
-- nobody can read out loud.
--
-- Not the profile-handle rule. `app/src/lib/handle.ts` enforces
-- ^[a-z0-9_]{3,20}$ on our own readers' handles; Instagram allows dots and
-- runs to thirty, and that rule would have rejected most of this set at the
-- first dot — `cab.cafesg`, `sweet.as.hanoi`, `aplusc.coffee.exp`.

alter table public.places
  add column if not exists instagram_handle text;

comment on column public.places.instagram_handle is
  'The venue''s own Instagram username, stored bare (no @, lowercase). Null when the venue has no Instagram account, or when nobody has looked yet.';

alter table public.places
  drop constraint if exists places_instagram_handle_shape;

alter table public.places
  add constraint places_instagram_handle_shape
  check (instagram_handle is null or instagram_handle ~ '^[a-z0-9._]{1,30}$');

-- Normalise on the way in, exactly as `stamp_threads_handle` does.
--
-- A pasted profile URL is the likeliest input — it is what the clipboard
-- holds — so take the handle out of it rather than failing the constraint on
-- punctuation. The backfill below leans on this: it assigns the whole URL and
-- lets the trigger do the extraction, so there is one implementation of the
-- rule rather than two that can drift.
create or replace function public.stamp_instagram_handle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.instagram_handle is not null then
    new.instagram_handle := regexp_replace(
      btrim(new.instagram_handle),
      '^(https?://)?(www\.)?instagram\.com/', '', 'i');
    new.instagram_handle := lower(ltrim(split_part(new.instagram_handle, '/', 1), '@'));
    new.instagram_handle := split_part(split_part(new.instagram_handle, '?', 1), '#', 1);
    if new.instagram_handle = '' then
      new.instagram_handle := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists places_stamp_instagram_handle on public.places;
create trigger places_stamp_instagram_handle
  before insert or update of instagram_handle on public.places
  for each row execute function public.stamp_instagram_handle();

-- The backfill.
--
-- Assigns the website itself and lets the trigger above take the handle out
-- of it, so the extraction rule lives in exactly one place. Guarded twice:
-- only rows whose website is an instagram profile, and only where the result
-- would satisfy the constraint — a link to a post (`instagram.com/p/<id>`)
-- or to `explore` is not a venue's account, and a row that cannot be read as
-- a handle is better left null than guessed at.
--
-- `website` is deliberately left alone. Dropping it here would destroy the
-- only record of where the handle came from, and the screen can decide for
-- itself not to draw the same link twice.
update public.places
   set instagram_handle = website
 where instagram_handle is null
   and website ~* '^(https?://)?(www\.)?instagram\.com/'
   and lower(split_part(split_part(split_part(
         ltrim(regexp_replace(website, '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '@'),
         '/', 1), '?', 1), '#', 1)) ~ '^[a-z0-9._]{1,30}$'
   and lower(split_part(regexp_replace(website, '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '/', 1))
       not in ('p', 'reel', 'reels', 'explore', 'stories', 'tv');
