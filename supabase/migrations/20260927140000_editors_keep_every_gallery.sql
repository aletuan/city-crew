-- An editor keeps every place's gallery from the phone, not only the ones
-- they imported.
--
-- ── why ──
--
-- The desk asked for a "super" account: someone who can tidy any
-- gallery — set the cover, hide, show, delete, add — wherever they are,
-- without opening the dashboard. The account asked for (@trang) is the
-- one editor there is (27 September 2026), and an editor already holds
-- every one of those rights in the database: `editors manage photos` is a
-- policy for all commands, with no caps, which is how the Data Desk
-- works. So "super" is not a new role. It is the desk's hand, reaching
-- the app.
--
-- Granting it to someone else is adding them to `editors`, which also
-- opens the Data Desk to them — the same trust, on purpose. The desk
-- should not have a second, narrower kind of editor to keep track of.
--
-- ── the one place the phone was still shut ──
--
-- `guide_may_manage` answered for the gallery RPCs (`guide_set_cover`,
-- `guide_set_hidden`) with one rule: a guide of this city, on a place
-- they submitted. An editor on anybody else's place was refused there,
-- though a plain UPDATE from the dashboard would have gone through.
--
-- Nothing else needed opening, and this was checked rather than assumed:
-- the row policies (`editors manage photos`, all commands) and the
-- storage ones (`editors upload/read/update/delete place photos`, any
-- folder) already let an editor add, delete and upload anywhere. A first
-- draft of this file also widened the guides' storage policy, until
-- `editor_gallery_test.sql` showed the editors' own policy was there.
--
-- The app is the other half, and changes beside this: it asks
-- `is_editor()` once at launch, with the guide grant, and offers the
-- gallery on every place when the answer is yes. See `lib/guideGrant.ts`.

create or replace function public.guide_may_manage(photo uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.place_photos ph
    join public.places p on p.id = ph.place_id
    where ph.id = photo
      and (
        -- The desk's hand, on any place. Asked once per query rather than
        -- per row, as every policy does since 20260927120000.
        (select public.is_editor())
        or (p.submitted_by = (select auth.uid()) and public.is_local_guide(p.city_id))
      )
  );
$$;

comment on function public.guide_may_manage(uuid) is
  'Whether the caller may change this photograph: an editor, on any place; or a local guide of the place''s city, on a place they submitted.';
