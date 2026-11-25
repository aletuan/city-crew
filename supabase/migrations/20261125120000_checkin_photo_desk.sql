-- A check-in photo at the desk (K5 of docs/checkin-photos-plan.md): it
-- can be reported, the desk sees it beside the report and can hide it,
-- and an account the desk suspends has every photo of its hidden with it.
--
-- ── hidden, not deleted ──
--
-- A hidden photo keeps its row and its file. Nobody is signed a link to
-- it (`checkin_photo_readable` reads `hidden_at`), `person_checkins`
-- leaves it out, and its owner's sheet draws it as a gap. The desk can
-- put it back: the desk is people, and people misjudge — the reason a
-- suspension is a ban and not a delete (`suspend-user`). Deleting is the
-- owner's, from the sheet, and that takes the file.
--
-- ── why it was hidden ──
--
-- `hidden_for`: 'report', a photo the desk took down on its own; or
-- 'suspended', every photo of an account it suspended. Kept apart so a
-- lifted suspension puts back what the suspension hid and nothing the
-- desk hid for itself. Not readable by the owner: the columns a client
-- may read are named in 20261124230000, and this is not added to them.
-- The gap on their sheet says "hidden by City Crew",
-- which is the whole of what they are told.
--
-- ── who sees a reported photo ──
--
-- The desk, from the queue, through a signed link like anybody else: an
-- editor may read the bucket (the policy below), as an editor may read
-- `place-photos` to remove one (20260910130000). The queue sends the
-- path, not a link — the page asks Storage, and the link lives an hour.

alter table public.checkin_photos
  add column if not exists hidden_for text;
-- `is not null` spelled out: `null in (...)` is null, and a check that
-- comes out null passes — a hidden photo with no reason would get by.
alter table public.checkin_photos drop constraint if exists checkin_photos_hidden_for;
alter table public.checkin_photos
  add constraint checkin_photos_hidden_for check (
    (hidden_at is null and hidden_for is null)
    or (hidden_at is not null and hidden_for is not null and hidden_for in ('report', 'suspended'))
  );

-- ── the report ──

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports
  add constraint reports_kind_check check (kind in ('collection', 'profile', 'comment', 'checkin_photo'));

-- Your own photo is yours to remove from the sheet, as your own profile
-- is yours to edit: neither is reported. The subquery runs as the caller,
-- under the owners' policy on `checkin_photos`, which shows a caller
-- their own photo rows and nobody else's — so it finds one exactly when
-- the photo is theirs. It names no column but `id`: `user_id` is not one
-- a client is granted. `(select auth.uid())`, as the live policy already
-- reads after `rls_ask_once`: asked once a statement, not once a row.
drop policy if exists "readers file reports" on public.reports;
create policy "readers file reports" on public.reports
  for insert with check (
    (select auth.uid()) = reporter
    and status = 'new'
    and not (kind = 'profile' and target_id = (select auth.uid()))
    and not (kind = 'checkin_photo' and exists (
      select 1 from public.checkin_photos p where p.id = target_id))
    and public.my_reports_today() < 20
  );

alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log
  add constraint moderation_log_action_check check (action in (
    'hide_collection', 'show_collection', 'clear_profile', 'suspend', 'unsuspend', 'remove_comment',
    'hide_checkin_photo', 'show_checkin_photo'));

-- ── the queue ──
--
-- For a photo: `title` the place (where it was taken), `body` the
-- visit's note (said beside it, and as likely the trouble), the owner
-- columns its owner — whom a suspension would reach. Two columns more at
-- the end, for a photo alone: the path to sign, and whether it is
-- hidden already. The return type changes, so the function is made
-- again and its grants stated again with it.
drop function if exists public.reports_queue();
create function public.reports_queue()
returns table (
  id uuid, kind text, target_id uuid, reason text, note text,
  status text, created_at timestamptz,
  title text, body text, owner_handle text, owner_id uuid,
  wall_kind text, wall_ref text,
  photo_path text, photo_hidden boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.reason, r.note, r.status, r.created_at,
    case r.kind when 'collection' then c.title_en when 'comment' then on_list.title_en
                when 'checkin_photo' then at_place.name_en else p.full_name end,
    case r.kind when 'collection' then c.desc_en when 'comment' then k.body
                when 'checkin_photo' then visit.note else p.bio end,
    case r.kind when 'collection' then owner.handle when 'comment' then author.handle
                when 'checkin_photo' then taker.handle else p.handle end,
    case r.kind when 'collection' then c.owner_id when 'comment' then k.author
                when 'checkin_photo' then ph.user_id else p.id end,
    p.wall_kind, p.wall_ref,
    ph.path, ph.hidden_at is not null
  from public.reports r
  left join public.collections c on r.kind = 'collection' and c.id = r.target_id
  left join public.profiles owner on owner.id = c.owner_id
  left join public.profiles p on r.kind = 'profile' and p.id = r.target_id
  left join public.comments k on r.kind = 'comment' and k.id = r.target_id
  left join public.collections on_list on on_list.id = k.collection_id
  left join public.profiles author on author.id = k.author
  left join public.checkin_photos ph on r.kind = 'checkin_photo' and ph.id = r.target_id
  left join public.checkins visit on visit.id = ph.checkin_id
  left join public.places at_place on at_place.id = visit.place_id
  left join public.profiles taker on taker.id = ph.user_id
  where public.is_editor()
  order by (r.status = 'new') desc, r.created_at desc
  limit 200;
$$;

revoke all on function public.reports_queue() from public, anon;
grant execute on function public.reports_queue() to authenticated;

-- ── the desk's hand ──
--
-- Hide one photo, or put it back. A photo that is not there, or already
-- as asked, is not an act and is not logged. Putting back is of any
-- photo, the suspended included: the desk looking at one and finding
-- nothing wrong is an answer about that photo.
create or replace function public.moderate_checkin_photo(target uuid, hide boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ph public.checkin_photos;
begin
  if not public.is_editor() then
    raise exception 'not an editor';
  end if;
  select * into ph from public.checkin_photos where id = target;
  if not found or (ph.hidden_at is not null) = hide then
    return;
  end if;
  update public.checkin_photos
     set hidden_at = case when hide then now() end,
         hidden_by = case when hide then auth.uid() end,
         hidden_for = case when hide then 'report' end
   where id = target;
  insert into public.moderation_log (actor, actor_email, action, target_id, detail)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')),
    case when hide then 'hide_checkin_photo' else 'show_checkin_photo' end, target,
    jsonb_build_object('owner', ph.user_id, 'checkin', ph.checkin_id)
  );
end;
$$;

revoke all on function public.moderate_checkin_photo(uuid, boolean) from public, anon;
grant execute on function public.moderate_checkin_photo(uuid, boolean) to authenticated;

-- Every photo of an account, as a suspension hides them and a lifted one
-- puts them back. For `suspend-user` alone, which has already checked
-- its caller is an editor and logged the act; the count it returns goes
-- back to the desk.
create or replace function public.checkin_photos_suspended(p_user uuid, p_hide boolean, p_by uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_hide then
    update public.checkin_photos
       set hidden_at = now(), hidden_by = p_by, hidden_for = 'suspended'
     where user_id = p_user and hidden_at is null;
  else
    update public.checkin_photos
       set hidden_at = null, hidden_by = null, hidden_for = null
     where user_id = p_user and hidden_for = 'suspended';
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.checkin_photos_suspended(uuid, boolean, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.checkin_photos_suspended(uuid, boolean, uuid) to service_role;
  end if;
end $$;

-- ── the desk reads the bucket ──
drop policy if exists "editors read check-in photos" on storage.objects;
create policy "editors read check-in photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'checkin-photos' and public.is_editor());
