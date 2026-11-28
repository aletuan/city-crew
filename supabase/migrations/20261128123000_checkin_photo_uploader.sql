-- Who attached a check-in's photo, when it was not the visit's owner
-- (owner, 28 Nov 2026).
--
-- The `check-in-review` skill writes a check-in for a handle the desk
-- manages, from a Threads post. The words go in through SQL; the photos
-- could not: `checkin-photo` is the only way into the `checkin-photos`
-- bucket (`20261124230000_checkin_photos.sql`) and it took the caller to
-- be the owner, so an editor attaching to somebody's visit met
-- `photo:not_yours`. The function now lets an editor through (its header
-- has the order), and this column is the record that it did.
--
-- Null is the ordinary case: the owner uploaded it. Set, it names the
-- editor. The row is still the owner's in every other way — `user_id`,
-- the path, the caps `checkin_photo_slot` counts, the trigger that holds
-- `user_id` to the visit's owner — so nothing that reads a photo has a
-- second case to know about.
--
-- It is also what an editor may take back: the function removes for an
-- editor only a photo that has this set, never one the owner uploaded.
--
-- `on delete set null`: an editor's account going must not take the
-- owner's photos with it, and a photo whose uploader is gone reads as
-- the owner's own, which is the safer way to be wrong — the owner can
-- always remove it, and an editor no longer can.
--
-- No grant and no policy change. `authenticated` reads this table by a
-- list of columns (the migration above) and this is not on it, the same
-- as `hidden_by`: which editor attached a photo is not a client's to
-- read. Nothing client-side writes the table at all.
--
-- Weighed and passed over: a second bucket or a second table for desk
-- uploads (every reader — the person page, the shelf, the place's
-- reviews, the prune — would need a second case, for photos that are
-- meant to look like any other); and a boolean (it says that an editor
-- did it and not which, which is the first thing asked when one is
-- wrong).

alter table public.checkin_photos
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

comment on column public.checkin_photos.uploaded_by is
  'Set when someone other than the owner (an editor) attached the photo. Null = the owner uploaded it.';
