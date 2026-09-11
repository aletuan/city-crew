-- One home for a person's public identity: `profiles`, and only there.
--
-- `20260815000000_profiles` moved name, handle, bio, location, interests
-- and avatar out of `auth.users.raw_user_meta_data` into `profiles`, and
-- `handle_new_user` was meant to keep it that way: sign-up hands the name
-- and handle over in the metadata, the trigger copies them into the new
-- profile row and then deletes them from the metadata.
--
-- The delete never stuck. Every account created since still carries its
-- sign-up name and handle in the metadata — ten of them on production when
-- this was written. GoTrue inserts the user, and the AFTER INSERT trigger
-- strips the keys, but GoTrue then writes the user row again from the copy
-- it holds in memory, which still has them. The strip was undone within
-- the same sign-up.
--
-- A copy left there is not harmless. Nothing updates it after sign-up, so
-- it is stale from the first rename in Edit profile, and it is what the
-- Supabase dashboard shows as "Display name" — a second, wrong answer to
-- "what is this person called", sitting next to the right one.
--
-- So the strip moves to where the later write cannot get past it: a BEFORE
-- UPDATE trigger on `auth.users`, which cleans the metadata on its way into
-- the row, whoever is writing. Inserts are left alone, because
-- `handle_new_user` (AFTER INSERT) has to read the values first; it keeps
-- its own strip for the case where nothing writes the row again.
--
-- Other metadata — `email`, `email_verified`, `sub` and whatever GoTrue adds
-- — is untouched. Only the six keys `profiles` owns are removed, and the
-- list lives in one function so the two triggers cannot disagree about it.

-- ── the list, once ──
create or replace function public.strip_profile_metadata(meta jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(meta, '{}'::jsonb)
    - 'handle' - 'full_name' - 'bio' - 'location' - 'interests' - 'avatar_url';
$$;

revoke execute on function public.strip_profile_metadata(jsonb) from public, anon, authenticated;

-- ── every later write ──
-- Security definer, and it has to be. The writer here is GoTrue's own role
-- (`supabase_auth_admin` on a real project), not the owner, and the helper
-- above is closed to everyone but the owner. Running as the invoker, every
-- sign-in's UPDATE would fail on "permission denied for function" — and
-- the test bench, which writes as a superuser, would never see it; see
-- profile_metadata_test.sql, which now writes as a plain role.
create or replace function public.keep_profile_out_of_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only when there is something to remove, so the sign-in that bumps
  -- `last_sign_in_at` does not rewrite the jsonb for nothing.
  if new.raw_user_meta_data ?| array['handle', 'full_name', 'bio', 'location', 'interests', 'avatar_url'] then
    new.raw_user_meta_data := public.strip_profile_metadata(new.raw_user_meta_data);
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_profile_out_of_metadata() from public, anon, authenticated;

drop trigger if exists keep_profile_out_of_metadata on auth.users;
create trigger keep_profile_out_of_metadata
  before update on auth.users
  for each row execute function public.keep_profile_out_of_metadata();

-- ── sign-up, reading the list from the same place ──
-- Same body as before but for the final UPDATE, which now calls the shared
-- list rather than repeating it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := lower(trim(coalesce(new.raw_user_meta_data->>'handle', '')));
  final  text;
begin
  if wanted ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from reserved_handles r where r.handle = wanted)
     and not exists (select 1 from profiles p where lower(p.handle) = wanted) then
    final := wanted;
  else
    loop
      final := random_handle();
      exit when not exists (select 1 from profiles p where lower(p.handle) = final);
    end loop;
  end if;

  insert into profiles (id, handle, full_name, bio, location, interests, avatar_url)
  values (
    new.id,
    final,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'bio', ''),
    coalesce(new.raw_user_meta_data->>'location', ''),
    coalesce(new.raw_user_meta_data->>'interests', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- The metadata was a courier, not a cupboard. This removes the keys for
  -- the sign-ups nothing writes again; the BEFORE UPDATE trigger above
  -- catches the one GoTrue does. Safe from recursion: an UPDATE does not
  -- re-fire an AFTER INSERT trigger.
  update auth.users
     set raw_user_meta_data = public.strip_profile_metadata(raw_user_meta_data)
   where id = new.id;

  return new;
end;
$$;

-- ── the accounts that already carry a copy ──
-- Every profile row exists for them (the sign-up trigger made it), so
-- nothing is lost: `profiles` holds the current values, the metadata held
-- the sign-up ones.
update auth.users
   set raw_user_meta_data = public.strip_profile_metadata(raw_user_meta_data)
 where raw_user_meta_data ?| array['handle', 'full_name', 'bio', 'location', 'interests', 'avatar_url'];

-- ── the backup the first move left behind ──
-- Taken on 2026-08-14 for the two accounts that existed then, before their
-- metadata was moved. Both profiles hold every value it held, checked
-- field by field before this was written, so it is only a second copy of
-- personal data (bio, location, email) with no reader.
drop table if exists public._metadata_backup;
