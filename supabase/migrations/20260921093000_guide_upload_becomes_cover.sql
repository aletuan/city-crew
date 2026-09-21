-- The photograph a local guide just added becomes the one that stands for
-- the place.
--
-- ── what this supersedes ──
--
-- `20260919080000_local_guide_photos.sql` wrote the opposite into its
-- insert policy, and said why:
--
--     not is_cover            phase one adds to the gallery; which picture
--                             stands for a place stays the desk's call
--
-- This is phase two. The reason it comes now is that the desk has been
-- doing it by hand anyway: of the 236 uploaded rows, 63 have already been
-- promoted to cover from the dashboard. A step taken by hand on a quarter
-- of a set is a default waiting to be written down.
--
-- ── why a trigger and not the app ──
--
-- The app cannot do this. The insert policy pins `is_cover = false`, so a
-- guide cannot file a cover; and there is no update policy for guides at
-- all, so they can neither promote the row afterwards nor demote the one
-- holding the flag. Only `is_editor()` may write those columns. The rule
-- therefore lives where the rows do.
--
-- AFTER insert, not BEFORE. Postgres evaluates a policy's WITH CHECK on
-- the row as the BEFORE triggers leave it, so a BEFORE trigger setting
-- `is_cover = true` would fail the very policy that lets the guide write
-- at all. Inserted false and promoted after is the only order that works.
--
-- `security definer`, because the promotion has to clear the old cover and
-- the guide has no update policy to do it with. The table does not force
-- row security, so the owner's rights are enough.
--
-- ── what it deliberately leaves alone ──
--
-- Desk uploads. The dashboard files photographs with `source = 'upload'`
-- too, and it has its own cover control beside them — promoting those
-- automatically would fight the editor holding the mouse.
--
-- `uploaded_by` is what tells the two apart, and it is not a guess: all
-- 3,511 google rows and all 235 dashboard uploads carry null there, while
-- the app's `addPlacePhoto` has always written `auth.uid()`. The column
-- means "a reader put this here", which is exactly the set this is about.

create or replace function public.guide_upload_becomes_cover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A reader's upload, and one that can actually be seen. The insert
  -- policy already refuses a hidden row; the last check is belt and braces
  -- against a future writer that does not go through it.
  if new.source <> 'upload' or new.uploaded_by is null or new.is_hidden then
    return new;
  end if;

  update public.place_photos
     set is_cover = false
   where place_id = new.place_id and is_cover and id <> new.id;

  update public.place_photos
     set is_cover = true
   where id = new.id;

  return new;
end;
$$;

comment on function public.guide_upload_becomes_cover() is
  'Moves the cover onto a photograph a reader just uploaded. Desk uploads, which carry no uploaded_by, are left to the dashboard''s own cover control.';

drop trigger if exists place_photos_guide_upload_becomes_cover on public.place_photos;

create trigger place_photos_guide_upload_becomes_cover
  after insert on public.place_photos
  for each row execute function public.guide_upload_becomes_cover();

-- The rows that predate the rule.
--
-- One reader upload exists today and it is not its place's cover. Leaving
-- it would make the rule true of every photograph added after this
-- migration and false of the one that prompted it, which is a worse thing
-- to explain than a one-row update.
--
-- Newest per place, so this stays correct if more arrive before it runs.
update public.place_photos p
   set is_cover = (p.id = latest.id)
  from (
    select distinct on (place_id) place_id, id
      from public.place_photos
     where source = 'upload' and uploaded_by is not null and is_hidden = false
     order by place_id, created_at desc, id desc
  ) latest
 where p.place_id = latest.place_id
   and (p.id = latest.id or p.is_cover);
