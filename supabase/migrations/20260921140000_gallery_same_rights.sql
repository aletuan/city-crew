-- The guide and the desk, with the same hands on the same gallery.
--
-- ── what changes ──
--
-- `20260921120000_gallery_guide_rpcs.sql` drew a boundary inside a
-- place's photographs — the guide could arrange their own uploads and the
-- importer's, the desk's uploads were view-only, and a photograph the
-- desk hid was not the guide's to show again. It was careful, and it
-- was more than was asked for. The rule now is the plain one:
--
--     on a place a guide brought in, the guide and the desk may do the
--     same things to any photograph, and whoever acts last wins.
--
-- No boundary between kinds of photograph, no veto. Simpler to state,
-- simpler to see on the phone, and the same rule the desk already lives
-- by among its own editors. `hidden_by` stays — it is a fact worth
-- recording — but nothing reads it as permission any more.
--
-- Ordering goes for now. Not because it was wrong but because it is not
-- wanted yet, and a function nobody calls is a surface nobody watches.
--
-- ── the boundary, as one question ──
--
-- Only the place matters: a local guide, on a place they submitted.

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
    );
$$;

comment on function public.guide_may_manage(uuid) is
  'Whether the caller may change this photograph: a local guide, on a place they submitted. Any photograph on the place — the same hands as the desk.';

-- ── hide, and show again — no veto ──

create or replace function public.guide_set_hidden(photo uuid, hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.guide_may_manage(photo) then
    raise exception 'not yours to hide' using errcode = 'insufficient_privilege';
  end if;

  -- Hiding the cover takes the flag with it, so the flag never sits on a
  -- row nobody can see. The app then falls back to the lowest sort_order,
  -- which is the rule the dashboard shares.
  update public.place_photos
     set is_hidden = hidden,
         is_cover  = case when hidden then false else is_cover end
   where id = photo;
end;
$$;

-- ── delete, any photograph on the place ──
--
-- The old policy let an uploader take back their own row and nothing
-- else. The desk deletes anything; so, now, does the guide on their own
-- place. A deleted Google row is gone for good — its `photo_ref` cannot
-- be fetched again cheaply — and that is the guide's call to make, the
-- same as it is the desk's.

drop policy if exists "uploaders remove their own photos" on public.place_photos;
drop policy if exists "guides remove photos on their own places" on public.place_photos;
create policy "guides remove photos on their own places" on public.place_photos
  for delete using (
    public.is_local_guide()
    and exists (
      select 1 from public.places p
      where p.id = place_photos.place_id and p.submitted_by = auth.uid()
    )
  );

-- ── and no ordering, for now ──

drop function if exists public.guide_reorder_photos(uuid, uuid[]);
