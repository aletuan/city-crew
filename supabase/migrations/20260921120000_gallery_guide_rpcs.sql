-- A local guide keeps the gallery of the place they brought in.
--
-- ── what this opens ──
--
-- `20260919080000_local_guide_photos.sql` gave a guide two writes: add a
-- photograph to a place they submitted, and take their own back. Nothing
-- in between — no cover, no hiding, no order. The desk did all of that
-- from the dashboard, for every place, by hand.
--
-- This lets the guide do it for their own place, within a boundary:
--
--     their own uploads     yes
--     the importer's rows   yes — Google's photographs are nobody's
--     the desk's uploads    no — an editor put that there on purpose
--
-- and with one veto kept for the desk: a photograph the desk has hidden
-- stays hidden. Hiding is moderation, and moderation is not a thing the
-- moderated party gets to undo.
--
-- ── why functions and not a policy ──
--
-- Row security cannot express "you may flip this column only if the
-- previous value was yours" — a policy sees the row as it will be, not as
-- it was. It also cannot express "you may clear the cover on that row
-- because you are setting it on this one": the demoted row may be the
-- desk's, which the guide may not otherwise touch. Both rules need to
-- read one row to decide about another, and that is a function's job.
--
-- So there is still no UPDATE policy for guides. Every change goes
-- through one of three definer functions below, each of which asks the
-- same three questions before it writes:
--
--     is the caller a local guide            is_local_guide()
--     did they submit this place             places.submitted_by = auth.uid()
--     may they touch this photograph         guide_may_manage()
--
-- and raises if any answer is no. A raise, not a silent no-op: the app
-- draws these controls only where it believes they will work, so a
-- refusal here is a bug on one side or the other and should be seen.
--
-- ── the cover, atomically ──
--
-- The dashboard sets a cover in two statements — clear the place, set
-- the row — which leaves a moment with no cover and would leave two if a
-- trigger ever answered the first. `guide_set_cover` does both inside one
-- function so there is no moment in between, and `guide_upload_becomes_
-- cover` (the insert trigger) is unaffected: it fires on INSERT and these
-- only UPDATE.

-- ── who hid it ──
--
-- The veto needs to know whose hand did the hiding, and nothing recorded
-- that. Stamped by a trigger rather than by each writer, so the dashboard
-- keeps working unchanged: an editor is a signed-in account too, and
-- `auth.uid()` names them the same way it names a guide. Cleared on
-- unhide, so a photograph hidden and shown and hidden again carries the
-- latest hand and not the first.

alter table public.place_photos
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

comment on column public.place_photos.hidden_by is
  'Who hid this photograph, when it is hidden. Null when visible. A guide may unhide only what they hid themselves; anything else was the desk''s call.';

create or replace function public.stamp_hidden_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_hidden and not old.is_hidden then
    new.hidden_by := auth.uid();
  elsif not new.is_hidden then
    new.hidden_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists place_photos_stamp_hidden_by on public.place_photos;
create trigger place_photos_stamp_hidden_by
  before update of is_hidden on public.place_photos
  for each row execute function public.stamp_hidden_by();

-- ── the boundary, as one question ──

create or replace function public.guide_may_manage(photo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_local_guide()
    and exists (
      select 1
      from public.place_photos ph
      join public.places p on p.id = ph.place_id
      where ph.id = photo
        and p.submitted_by = auth.uid()
        and (ph.uploaded_by = auth.uid() or ph.source = 'google')
    );
$$;

comment on function public.guide_may_manage(uuid) is
  'Whether the caller may change this photograph: a local guide, on a place they submitted, and the photo is their own upload or an imported one. Never a desk upload.';

-- ── set the cover ──

create or replace function public.guide_set_cover(photo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.place_photos%rowtype;
begin
  if not public.guide_may_manage(photo) then
    raise exception 'not yours to set' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.place_photos where id = photo;
  -- A hidden cover is a place with no picture: `photosOf` filters before
  -- it sorts. Refused rather than quietly unhidden, because unhiding is
  -- its own act with its own veto.
  if target.is_hidden then
    raise exception 'a hidden photograph cannot be the cover' using errcode = 'check_violation';
  end if;

  update public.place_photos
     set is_cover = false
   where place_id = target.place_id and is_cover and id <> photo;
  update public.place_photos
     set is_cover = true
   where id = photo;
end;
$$;

-- ── hide, and show again ──

create or replace function public.guide_set_hidden(photo uuid, hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.place_photos%rowtype;
begin
  if not public.guide_may_manage(photo) then
    raise exception 'not yours to hide' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.place_photos where id = photo;

  -- The desk's veto. A photograph somebody else hid — an editor, or a
  -- writer that left no name — is not the guide's to show again.
  if not hidden and target.is_hidden and target.hidden_by is distinct from auth.uid() then
    raise exception 'hidden by the desk' using errcode = 'insufficient_privilege';
  end if;

  -- Hiding the cover takes the flag with it, so the flag never sits on a
  -- row nobody can see. The app then falls back to the lowest sort_order,
  -- which is the rule the dashboard now shares.
  update public.place_photos
     set is_hidden = hidden,
         is_cover  = case when hidden then false else is_cover end
   where id = photo;
end;
$$;

-- ── the order ──
--
-- The whole gallery, or nothing. A partial list would leave gaps and
-- duplicates in `sort_order` that the next full write would have to
-- guess its way through; asking for every row makes the write total and
-- the check simple. The desk's own uploads are in the list and may be
-- moved — moving is not changing — but they are the same rows, so the
-- set has to match exactly.

create or replace function public.guide_reorder_photos(target_place uuid, ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected int;
  i int;
begin
  if not public.is_local_guide() or not exists (
    select 1 from public.places where id = target_place and submitted_by = auth.uid()
  ) then
    raise exception 'not your place to order' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into expected from public.place_photos where place_id = target_place;
  if coalesce(array_length(ids, 1), 0) <> expected
     or (select count(distinct x) from unnest(ids) x) <> expected
     or exists (
       select 1 from unnest(ids) x
       where not exists (select 1 from public.place_photos where id = x and place_id = target_place)
     )
  then
    raise exception 'the order must name every photograph on the place exactly once'
      using errcode = 'check_violation';
  end if;

  for i in 1 .. expected loop
    update public.place_photos set sort_order = i - 1 where id = ids[i];
  end loop;
end;
$$;

-- Readers may call these; guests may not. New functions land that way by
-- default (see function_grants_test), and this only says so.
revoke execute on function public.guide_may_manage(uuid) from anon;
revoke execute on function public.guide_set_cover(uuid) from anon;
revoke execute on function public.guide_set_hidden(uuid, boolean) from anon;
revoke execute on function public.guide_reorder_photos(uuid, uuid[]) from anon;

-- ── and the guide can see what they may manage ──
--
-- Both read policies on `place_photos` end in `is_hidden = false`, which
-- was right when hiding was the desk's alone: a hidden photograph was
-- gone, and gone for everyone. It is wrong now. A guide who hid a picture
-- has to see it again to show it again, and one the desk hid has to be
-- visible as *hidden* rather than silently missing — a photograph that
-- vanishes without a word is worse than one with a badge on it.
--
-- So the submitter's policy loses that clause. The public one keeps it:
-- a hidden photograph is still hidden from everybody who is not keeping
-- the gallery. `photosOf` filters hidden rows before it sorts, so the
-- detail screen shows nothing new; only the gallery does.

drop policy if exists "submitters read their own place photos" on public.place_photos;
create policy "submitters read their own place photos" on public.place_photos
  for select using (
    exists (
      select 1 from public.places p
      where p.id = place_photos.place_id and p.submitted_by = auth.uid()
    )
  );
