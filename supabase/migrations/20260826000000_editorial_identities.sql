-- The seed collections wore pen names with nobody behind them: fifteen
-- rows with owner_id NULL and a curator_handle painted on, which the
-- community grid's new avatar lookup exposed as placeholder circles.
-- The identities stay (the owner's call) and become real: one account
-- each, wearing a photograph from its own shelves. The auth rows exist
-- only because profiles.id references auth.users — an empty password
-- hash and a reserved-TLD email make them impossible to sign in to or
-- to mail.
--
-- These seven names are reserved, and both gates take that seriously:
-- the sign-up trigger falls back to a generated handle for a reserved
-- name, and profiles_check_handle refuses one outright. Rather than
-- bypass the gates, the reservations step aside for the length of this
-- transaction and the desk walks in through the front door — the same
-- sign-up path every real account takes, metadata as the courier — and
-- the reservations are back in place before the transaction ends.

create temporary table editorial_reservations as
  select handle, reason from public.reserved_handles
  where handle in ('hanoicrew', 'saigonnights', 'danangcrew', 'quietcorners',
                   'citycrew', 'foodmapvn', 'saigoncaphe');

delete from public.reserved_handles
  where handle in (select handle from editorial_reservations);

-- Avatars are photographs the catalog already serves, one from each
-- identity's own subject matter — no new assets, and they age with the
-- catalog rather than beside it.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current
)
select '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated',
       v.handle || '@editors.citycrew.invalid', '', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object(
         'handle', v.handle, 'full_name', v.full_name, 'bio', v.bio,
         'location', v.location, 'interests', v.interests, 'avatar_url', v.avatar_url),
       '', '', '', '', ''
from (values
  ('5eed0000-0000-4000-8000-000000000001'::uuid, 'hanoicrew', 'Hanoi Crew',
   'Những kệ khởi động cho Hà Nội, từ bàn biên tập cityCrew.', 'Hà Nội', 'cafes, heritage, eats',
   'https://aletuan.github.io/city-crew/media/hanoi-citadel-autumn.jpg'),
  ('5eed0000-0000-4000-8000-000000000002'::uuid, 'saigonnights', 'Saigon Nights',
   'Rooftop, đêm và những tầng cao Sài Gòn.', 'TP. Hồ Chí Minh', 'nightlife, views',
   'https://amdvitzpogaejzzqroco.supabase.co/storage/v1/object/public/place-photos/bitexco-skydeck/1786191235549-518594684_17971676078873776_6887029363925024361_n.jpg'),
  ('5eed0000-0000-4000-8000-000000000003'::uuid, 'danangcrew', 'Da Nang Crew',
   'Đà Nẵng từ sông Hàn ra biển.', 'Đà Nẵng', 'views, nature, nightlife',
   'https://amdvitzpogaejzzqroco.supabase.co/storage/v1/object/public/place-photos/ba-na-hills/1786244487891-Bana-Hill-1.jpg'),
  ('5eed0000-0000-4000-8000-000000000004'::uuid, 'quietcorners', 'Quiet Corners',
   'Công viên, hồ và những góc yên tĩnh.', 'Việt Nam', 'nature, quiet',
   'https://lh3.googleusercontent.com/place-photos/AG9NLjA5uwY09H5jhBZ6g10DtZ36RGLWr1iO5u7zvmPPHa3IPfsMgRHF7kjsaidEvGc04pQSxoriRLgw6V0bzgGNbvAgOIopLQauzMrF0007Ih9nRmB6NWzMirzXvfyK9fDyCfCdToSKENfqjFYv3w=s4800-w800'),
  ('5eed0000-0000-4000-8000-000000000005'::uuid, 'citycrew', 'cityCrew Editors',
   'Kệ khởi động chính thức của cityCrew.', 'Việt Nam', 'classics',
   'https://amdvitzpogaejzzqroco.supabase.co/storage/v1/object/public/place-photos/nguyen-hue-walking-street/1786195818841-walking-1.jpg'),
  ('5eed0000-0000-4000-8000-000000000006'::uuid, 'foodmapvn', 'Food Map VN',
   'Bản đồ món ngon đường phố.', 'Việt Nam', 'eats, street_food',
   'https://lh3.googleusercontent.com/place-photos/AG9NLjBhep9svoT03gD7lILXoencQIYpitW_l1Vi-tzERSJpCMEG2-3FTlIet_WZMxZRWm6YhuTs4Z1qh8IZcABIo784OOTQoAhZ_8hCAVGTntsNLXnfjpmszVHlapqiKBzKNWeZLkgrGDToNaMxigDR0liJ=s4800-w1600'),
  ('5eed0000-0000-4000-8000-000000000007'::uuid, 'saigoncaphe', 'Sài Gòn Cà Phê',
   'Cà phê Sài Gòn, từ vỉa hè đến specialty.', 'TP. Hồ Chí Minh', 'cafes',
   'https://lh3.googleusercontent.com/place-photos/AG9NLjAEFft9_Cm4HgWwXmMYEtE2QsCcNSfmKH-e4e_e_Ef37JtfjE58rpfCh2RLLOn9_J0eoyFrzjrzSoGF5hikz0BpjqJIf5NrDoU-IXoqPW_vb0c_K5qriSh05BXPHPfeGBYPGPqK6dWTT9y769DoNj60Lg=s4800-w800')
) as v(id, handle, full_name, bio, location, interests, avatar_url)
on conflict (id) do nothing;

-- If the sign-up trigger declined the wanted names — its rules are its
-- own and may change — fail here, loudly, rather than publish the house
-- shelves under a userXXXXXXXX byline.
do $$
declare missing text;
begin
  select string_agg(v.handle, ', ') into missing
  from (values ('hanoicrew'), ('saigonnights'), ('danangcrew'), ('quietcorners'),
               ('citycrew'), ('foodmapvn'), ('saigoncaphe')) as v(handle)
  where not exists (select 1 from public.profiles p where p.handle = v.handle);
  if missing is not null then
    raise exception 'editorial profiles missing after seed: %', missing;
  end if;
end $$;

-- The reservations return, reasons and all. The handles they guard are
-- now also taken in profiles, so from here the names are doubly held.
insert into public.reserved_handles (handle, reason)
  select handle, reason from editorial_reservations
on conflict (handle) do nothing;

drop table editorial_reservations;

-- The ownerless seeds take their identity's id; rows a person owns are
-- untouched. stamp_curator re-derives each byline from the new owner's
-- profile on this very write — same name, no longer painted on.
update public.collections c
set owner_id = p.id
from public.profiles p
where c.owner_id is null and c.curator_handle = p.handle;

-- One stale byline: minh renamed from leducminh after publishing, and
-- the denormalised curator_handle kept the old name. The where-clause
-- only picks the rows; stamp_curator writes the truth.
update public.collections set curator_handle = 'minh' where curator_handle = 'leducminh';

-- And the cure for the class, not only the case: a rename now carries
-- its bylines with it. Only public rows — a private list has no byline,
-- and publishing stamps a fresh one anyway. stamp_curator runs on the
-- update this trigger makes, so the byline written is still the one
-- derived from the profile, not the one this function happens to say.
create or replace function public.sync_curator_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.handle is distinct from old.handle then
    update public.collections
    set curator_handle = new.handle
    where owner_id = new.id and is_public;
  end if;
  return new;
end;
$$;

-- A trigger, not an endpoint — the same lesson stamp_curator wrote down.
revoke execute on function public.sync_curator_handle() from anon, authenticated, public;

drop trigger if exists profiles_sync_curator_handle on public.profiles;
create trigger profiles_sync_curator_handle
  after update of handle on public.profiles
  for each row execute function public.sync_curator_handle();
