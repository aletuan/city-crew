-- A new account wears one of the bundled animals instead of the blank disc.
--
-- The owner asked on 20 Oct 2026: sign-up left `avatar_url` empty, so a
-- new person showed up in a crew list, on an invite and on their own
-- Profile as a grey circle until they found Edit profile. On production
-- that day 21 of 47 profiles were still blank. The eight animals have
-- shipped inside the app since #1086 (`app/src/lib/avatars.ts`), and a
-- preset is only a name in this column — `preset:koala` — so giving one
-- costs no upload, no Storage object and no request on any phone.
--
-- A BEFORE INSERT trigger on `profiles` rather than a line in
-- `handle_new_user`, the same choice `handle_new_user_preferences` made:
-- restating that whole function to change one value is how its last copy
-- drifted. And it covers every way a profile row is born, not only the
-- GoTrue sign-up. A row that arrives with an avatar — a sign-up whose
-- metadata carried one, a curator identity seeded with a photo — keeps it;
-- only an empty one is filled.
--
-- Uniform over the eight, by `random()`: nothing about a person is known
-- at sign-up that should decide which animal they get, and a hash of the
-- id would only make the same choice harder to change by hand.
--
-- The list must name the same eight keys as `AVATAR_PRESETS` in
-- `app/src/lib/avatars.ts`; `avatars.test.ts` reads this file and fails if
-- they differ. A key the app does not have would draw the blank disc —
-- not broken, but the very thing this exists to stop.
--
-- Clearing it is still the person's choice: Remove photo writes '' with an
-- UPDATE, which this does not touch. Existing blank profiles are left as
-- they are here; filling them is a separate decision.

create or replace function public.default_avatar_preset()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  animals constant text[] := array[
    'koala', 'kangaroo', 'wombat', 'quokka', 'platypus', 'echidna', 'kookaburra', 'emu'
  ];
begin
  if coalesce(new.avatar_url, '') = '' then
    new.avatar_url := 'preset:' || animals[1 + floor(random() * array_length(animals, 1))::int];
  end if;
  return new;
end;
$$;

-- A trigger function, never an RPC.
revoke execute on function public.default_avatar_preset() from public, anon, authenticated;

drop trigger if exists profiles_default_avatar on public.profiles;
create trigger profiles_default_avatar
  before insert on public.profiles
  for each row execute function public.default_avatar_preset();
