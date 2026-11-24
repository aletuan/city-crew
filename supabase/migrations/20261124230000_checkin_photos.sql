-- Photos on a check-in: the table, the private bucket, who may read, and
-- the caps (K1 of `docs/checkin-photos-plan.md`, owner, 24 Nov 2026).
--
-- Up to three photos a visit, seen by whoever sees the visit. Every
-- account can upload, so the plan is built against abuse first; what this
-- file does of it:
--
--   · the bucket is private, and no client may write to it at all —
--     every write and delete goes through the `checkin-photo` Edge
--     Function (K2), which checks the bytes are a JPEG and strips the
--     metadata before anything is stored;
--   · a client may *read* an object only when the path is a photo row,
--     not hidden, of a visit `checkin_seen` lets it see — and reading is
--     how a signed link is asked for, so a link is never issued to
--     anybody else;
--   · the caps are one function, `checkin_photo_slot`, which the Edge
--     Function asks before it writes.
--
-- Nothing here is reachable from the app until K3, and the app's switch
-- (`checkin_photos`) stays off until a reviewed release.

-- ── the rows ──
--
-- The path is not chosen by anybody: it is the owner, the visit and the
-- row's own id, and the check says so, so a row cannot point at another
-- account's folder or another visit's file. `position` 1–3 is the
-- order on the card; the first is the card's picture.
--
-- `hidden_at` / `hidden_by`: the desk's hand (K5). A hidden photo is not
-- signed for anybody, its owner included.

create table if not exists public.checkin_photos (
  id          uuid primary key default gen_random_uuid(),
  checkin_id  uuid not null references public.checkins(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  position    smallint not null check (position between 1 and 3),
  path        text not null unique,
  width       integer not null check (width between 1 and 1600),
  height      integer not null check (height between 1 and 1600),
  bytes       integer not null check (bytes between 1 and 1048576),
  created_at  timestamptz not null default now(),
  hidden_at   timestamptz,
  hidden_by   uuid references auth.users(id) on delete set null,
  unique (checkin_id, position),
  constraint checkin_photos_path_shape
    check (path = user_id::text || '/' || checkin_id::text || '/' || id::text || '.jpg')
);

-- The caps count an account's photos over a day and in all.
create index if not exists checkin_photos_by_user on public.checkin_photos (user_id, created_at desc);

-- A photo belongs to the visit's owner, whoever writes the row. The Edge
-- Function writes with the service role, which RLS does not stop, so the
-- rule is a trigger and not a policy.
create or replace function public.checkin_photo_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.checkins c where c.id = new.checkin_id and c.user_id = new.user_id) then
    raise exception 'photo:not_yours';
  end if;
  return new;
end;
$$;

drop trigger if exists checkin_photos_owner on public.checkin_photos;
create trigger checkin_photos_owner
  before insert or update of checkin_id, user_id on public.checkin_photos
  for each row execute function public.checkin_photo_owner();

-- Closed to clients but for their own rows, read, and only the columns
-- the app draws: which editor hid a photo is not its owner's to know.
-- Everybody else's photos reach a reader through `person_checkins`.
alter table public.checkin_photos enable row level security;
revoke all on table public.checkin_photos from anon, authenticated;
grant select (id, checkin_id, position, path, width, height, created_at, hidden_at)
  on table public.checkin_photos to authenticated;

drop policy if exists "owners read their check-in photos" on public.checkin_photos;
create policy "owners read their check-in photos" on public.checkin_photos
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ── the caps ──
--
-- Where the next photo of a visit goes, or why it may not: three a
-- visit, fifteen an account in a day, three hundred an account in all.
-- Fifteen and three hundred are chosen, not measured (the plan's open
-- question 3): a day of three full visits and some retries; a long life
-- of the app's use. The real bound on what one account can cost, since
-- check-ins themselves run to fifty a day.
--
-- Counted over the photos that exist. A photo deleted gives its place
-- back, today's included: the cost of a delete-and-add loop is writes,
-- not storage, and the total never passes three hundred.
--
-- For the Edge Function alone, which knows the caller from its token and
-- passes it in; no client can ask on somebody else's behalf.

create or replace function public.checkin_photo_slot(p_user uuid, p_checkin uuid)
returns smallint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  taken smallint[];
  n smallint;
begin
  if not exists (select 1 from public.checkins c where c.id = p_checkin and c.user_id = p_user) then
    raise exception 'photo:not_yours';
  end if;
  if (select count(*) from public.checkin_photos p where p.user_id = p_user) >= 300 then
    raise exception 'photo:account';
  end if;
  if (select count(*) from public.checkin_photos p
       where p.user_id = p_user and p.created_at > now() - interval '1 day') >= 15 then
    raise exception 'photo:day';
  end if;
  select array_agg(p.position) into taken from public.checkin_photos p where p.checkin_id = p_checkin;
  for n in 1..3 loop
    if taken is null or not (n = any (taken)) then
      return n;
    end if;
  end loop;
  raise exception 'photo:full';
end;
$$;

revoke all on function public.checkin_photo_slot(uuid, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.checkin_photo_slot(uuid, uuid) to service_role;
  end if;
end $$;

-- ── the bucket ──
--
-- 1 MB a file: 4,433 local-guide uploads shrunk the same way (1200px,
-- 0.74) average 157 KB and peak at 452 KB, so this is over twice the
-- largest. JPEG alone, as the Edge Function writes nothing else.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Whether the caller may see the object at `name`: a photo row with that
-- path, not hidden, on a visit `checkin_seen` lets them see.
create or replace function public.checkin_photo_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.checkin_photos p
      join public.checkins c on c.id = p.checkin_id
     where p.path = p_name
       and p.hidden_at is null
       and public.checkin_seen(c)
  );
$$;

revoke all on function public.checkin_photo_readable(text) from public, anon;
grant execute on function public.checkin_photo_readable(text) to authenticated;

-- Read only. No insert, update or delete for any client role: there is
-- deliberately no policy for them, and with RLS on none is a refusal.
drop policy if exists "readers of a visit read its photos" on storage.objects;
create policy "readers of a visit read its photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'checkin-photos' and public.checkin_photo_readable(name));

-- ── what a person's page is sent ──
--
-- `person_checkins` (`20261124150000_checkin_friends.sql`) with the
-- visit's photos added: path, size, in order, the hidden left out. The
-- app asks Storage to sign the paths; the policy above decides whether
-- it may.

drop function if exists public.person_checkins(uuid);
create function public.person_checkins(p_person uuid)
returns table (
  id uuid, place_slug text, name_en text, name_vi text, i18n jsonb,
  categories text[], cover text, city_id text,
  day date, note text, audience text,
  likes integer, liked boolean,
  photos jsonb
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
         s.note,
         case when s.user_id = (select auth.uid()) then s.audience end,
         (select count(*)::integer from public.checkin_likes l where l.checkin_id = s.id),
         exists (select 1 from public.checkin_likes l
                  where l.checkin_id = s.id and l.user_id = (select auth.uid())),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', cp.id, 'path', cp.path, 'width', cp.width, 'height', cp.height)
                            order by cp.position)
             from public.checkin_photos cp
            where cp.checkin_id = s.id and cp.hidden_at is null), '[]'::jsonb)
    from seen s
    join public.places p on p.id = s.place_id
    left join public.cities ci on ci.id = s.city_id
   where p.is_published and p.review_status = 'approved'
   order by s.at desc
   limit 60;
$$;

revoke all on function public.person_checkins(uuid) from public, anon;
grant execute on function public.person_checkins(uuid) to authenticated;
