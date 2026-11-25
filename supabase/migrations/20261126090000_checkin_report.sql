-- A check-in is reported as one thing, and the desk decides what of it
-- comes down (owner, 25 Nov 2026).
--
-- ── one report, not one a part ──
--
-- K5 (`20261125120000_checkin_photo_desk.sql`) made a check-in *photo*
-- reportable, from the photo viewer: the visit had no other words a
-- stranger could read. Since `20261125200000_checkin_public.sql` its note
-- can be read by anybody signed in, and a note had no report at all. The
-- owner weighed a second report beside the photo's and chose neither:
-- one report, on the visit, as a collection is reported whole and as
-- Threads reports a post and not a picture in it. To a reader the note
-- and the photos are one post; asking which part offends is a question
-- they have no reason to answer, and the desk can see all of it at once
-- — three photos and 280 characters at the most.
--
-- What the desk loses is which photo the reporter meant. Rejected as a
-- reason to keep the photo report: the viewer's flag was the second way
-- to the same sheet, and the owner had it taken out (the app's side of
-- this change). 'checkin_photo' stays a kind the table takes, so the
-- reports already filed under it still reach the queue; the app files
-- no new ones.
--
-- ── what the desk can take down ──
--
-- The note (`note_hidden_at`): shown to nobody but its owner, who is
-- told it was hidden. Rewriting it does not bring it back — that would
-- make the desk's act one edit long; the desk puts it back.
--
-- A photo: `moderate_checkin_photo`, as K5 made it.
--
-- The whole visit (`hidden_at`): `checkin_seen` then lets nobody but the
-- owner through, so the read, the heart and the photos' Storage policy
-- all close at once, whatever its answer. Not by turning it Only me:
-- the owner could turn it straight back, and an answer the owner gave
-- is theirs, not the desk's. The owner still sees it, marked as hidden
-- by City Crew, as a hidden photo is drawn as a gap on its sheet.
--
-- All three are put back the same way they were taken down, and every
-- act is logged with whose visit it was.
--
-- A suspension does not hide an account's visits: a suspended account
-- cannot sign in to make new ones, and what it made is the desk's to
-- look at visit by visit. Its photos are still hidden with it (K5).

alter table public.checkins
  add column if not exists hidden_at      timestamptz,
  add column if not exists hidden_by      uuid references auth.users(id) on delete set null,
  add column if not exists note_hidden_at timestamptz,
  add column if not exists note_hidden_by uuid references auth.users(id) on delete set null;

-- ── the report ──

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports
  add constraint reports_kind_check check (kind in ('collection', 'profile', 'comment', 'checkin_photo', 'checkin'));

-- Your own visit is yours to edit or remove, so not to report. The
-- subquery runs as the caller, under the owners' read policy on
-- `checkins`, which shows a caller their own rows and nobody else's — so
-- it finds one exactly when the visit is theirs (K5's reasoning for a
-- photo, the same here).
drop policy if exists "readers file reports" on public.reports;
create policy "readers file reports" on public.reports
  for insert with check (
    (select auth.uid()) = reporter
    and status = 'new'
    and not (kind = 'profile' and target_id = (select auth.uid()))
    and not (kind = 'checkin_photo' and exists (
      select 1 from public.checkin_photos p where p.id = target_id))
    and not (kind = 'checkin' and exists (
      select 1 from public.checkins c where c.id = target_id))
    and public.my_reports_today() < 20
  );

alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log
  add constraint moderation_log_action_check check (action in (
    'hide_collection', 'show_collection', 'clear_profile', 'suspend', 'unsuspend', 'remove_comment',
    'hide_checkin_photo', 'show_checkin_photo',
    'hide_checkin', 'show_checkin', 'hide_checkin_note', 'show_checkin_note'));

-- ── who sees a visit ──
--
-- `20261125200000_checkin_public.sql`'s, with the desk's hand added: a
-- hidden visit is its owner's alone, whatever it was answered.
create or replace function public.checkin_seen(c public.checkins)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id = (select auth.uid())
      or (c.hidden_at is null
          and ((c.audience = 'friends'
                and public.friends_with(c.user_id)
                and not public.blocked_with(c.user_id))
            or (c.audience = 'public'
                and (select auth.uid()) is not null
                and not public.blocked_with(c.user_id))));
$$;

revoke all on function public.checkin_seen(public.checkins) from public, anon, authenticated;

-- ── what a person's page is sent ──
--
-- Two columns more, for the owner alone: whether the desk hid the visit,
-- and whether it hid the note. A reader who is not the owner never sees
-- a hidden visit, and is sent no note where the note is hidden — and
-- both columns false, which tells them nothing.
drop function if exists public.person_checkins(uuid);
create function public.person_checkins(p_person uuid)
returns table (
  id uuid, place_slug text, name_en text, name_vi text, i18n jsonb,
  categories text[], cover text, city_id text,
  day date, note text, audience text,
  likes integer, liked boolean,
  photos jsonb,
  hidden boolean, note_hidden boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with seen as (
    select distinct on (c.place_id) c.*
      from public.checkins c
     where c.user_id = p_person
       and (select auth.uid()) is not null
       and public.checkin_seen(c)
     order by c.place_id, c.at desc
  )
  select s.id, p.slug, p.name_en, p.name_vi, p.i18n, p.categories,
         (select ph.photo_uri from public.place_photos ph
           where ph.place_id = p.id and not ph.is_hidden
           order by ph.is_cover desc, ph.sort_order
           limit 1),
         s.city_id,
         (s.at at time zone coalesce(ci.tz, 'Asia/Ho_Chi_Minh'))::date,
         case when s.user_id = (select auth.uid()) or s.note_hidden_at is null then s.note end,
         case when s.user_id = (select auth.uid()) then s.audience
              when s.audience = 'public' then 'public' end,
         (select count(*)::integer from public.checkin_likes l where l.checkin_id = s.id),
         exists (select 1 from public.checkin_likes l
                  where l.checkin_id = s.id and l.user_id = (select auth.uid())),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', cp.id, 'path', cp.path, 'width', cp.width, 'height', cp.height)
                            order by cp.position)
             from public.checkin_photos cp
            where cp.checkin_id = s.id and cp.hidden_at is null), '[]'::jsonb),
         s.user_id = (select auth.uid()) and s.hidden_at is not null,
         s.user_id = (select auth.uid()) and s.note_hidden_at is not null
    from seen s
    join public.places p on p.id = s.place_id
    left join public.cities ci on ci.id = s.city_id
   where p.is_published and p.review_status = 'approved'
   order by s.at desc
   limit 60;
$$;

revoke all on function public.person_checkins(uuid) from public, anon;
grant execute on function public.person_checkins(uuid) to authenticated;

-- ── the queue ──
--
-- A visit's row: `title` the place, `body` the note, the owner columns
-- its owner. Four columns more at the end, for a visit alone: its
-- photos (id, path, hidden — the hidden included, so the desk can put
-- one back), whether the visit and the note are hidden, and its answer
-- (a report on a friends visit came from a friend). The return type
-- changes, so the function is made again with its grants.
drop function if exists public.reports_queue();
create function public.reports_queue()
returns table (
  id uuid, kind text, target_id uuid, reason text, note text,
  status text, created_at timestamptz,
  title text, body text, owner_handle text, owner_id uuid,
  wall_kind text, wall_ref text,
  photo_path text, photo_hidden boolean,
  visit_photos jsonb, visit_hidden boolean, visit_note_hidden boolean, visit_audience text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.reason, r.note, r.status, r.created_at,
    case r.kind when 'collection' then c.title_en when 'comment' then on_list.title_en
                when 'checkin_photo' then at_place.name_en when 'checkin' then v_place.name_en
                else p.full_name end,
    case r.kind when 'collection' then c.desc_en when 'comment' then k.body
                when 'checkin_photo' then visit.note when 'checkin' then v.note
                else p.bio end,
    case r.kind when 'collection' then owner.handle when 'comment' then author.handle
                when 'checkin_photo' then taker.handle when 'checkin' then visitor.handle
                else p.handle end,
    case r.kind when 'collection' then c.owner_id when 'comment' then k.author
                when 'checkin_photo' then ph.user_id when 'checkin' then v.user_id
                else p.id end,
    p.wall_kind, p.wall_ref,
    ph.path, ph.hidden_at is not null,
    case when v.id is not null then coalesce((
      select jsonb_agg(jsonb_build_object('id', vp.id, 'path', vp.path, 'hidden', vp.hidden_at is not null)
                       order by vp.position)
        from public.checkin_photos vp where vp.checkin_id = v.id), '[]'::jsonb) end,
    v.hidden_at is not null,
    v.note_hidden_at is not null,
    v.audience
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
  left join public.checkins v on r.kind = 'checkin' and v.id = r.target_id
  left join public.places v_place on v_place.id = v.place_id
  left join public.profiles visitor on visitor.id = v.user_id
  where public.is_editor()
  order by (r.status = 'new') desc, r.created_at desc
  limit 200;
$$;

revoke all on function public.reports_queue() from public, anon;
grant execute on function public.reports_queue() to authenticated;

-- ── the desk's hand ──
--
-- Hide the visit or its note, or put either back. `part` is 'visit' or
-- 'note'. A visit that is not there, or a part already as asked, is not
-- an act and is not logged — `moderate_checkin_photo`'s rule.
create or replace function public.moderate_checkin(target uuid, part text, hide boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.checkins;
begin
  if not public.is_editor() then
    raise exception 'not an editor';
  end if;
  if part is null or part not in ('visit', 'note') then
    raise exception 'checkin:part';
  end if;
  select * into v from public.checkins where id = target;
  if not found then
    return;
  end if;
  if part = 'visit' then
    if (v.hidden_at is not null) = hide then return; end if;
    update public.checkins
       set hidden_at = case when hide then now() end,
           hidden_by = case when hide then auth.uid() end
     where id = target;
  else
    if (v.note_hidden_at is not null) = hide then return; end if;
    update public.checkins
       set note_hidden_at = case when hide then now() end,
           note_hidden_by = case when hide then auth.uid() end
     where id = target;
  end if;
  insert into public.moderation_log (actor, actor_email, action, target_id, detail)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')),
    case when part = 'visit' then case when hide then 'hide_checkin' else 'show_checkin' end
         else case when hide then 'hide_checkin_note' else 'show_checkin_note' end end,
    target,
    jsonb_build_object('owner', v.user_id, 'place', v.place_id)
  );
end;
$$;

revoke all on function public.moderate_checkin(uuid, text, boolean) from public, anon;
grant execute on function public.moderate_checkin(uuid, text, boolean) to authenticated;
