-- Public identity, split out of auth.users metadata.
--
-- Until now everything about a person lived in `raw_user_meta_data`, which
-- only that person can read. That was safe and it was also a dead end:
-- a collection published to the shelf had no name to carry, and a friend
-- could not be found because there was nothing to look them up by.
--
-- This table is the public half. The private half — email, the auth
-- record itself — stays where it was. Note that "public" is literal:
-- anyone with the publishable key can read every row, which is the point
-- and is also why `location` moving here is a decision rather than a
-- refactor.
--
-- Handles are the reason for most of the machinery below. They have to be
-- unique regardless of case, constrained in shape because they end up in
-- URLs, and closed to the names the editorial collections already use —
-- otherwise the first person to claim `@hanoicrew` publishes under the
-- house account's identity.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text not null,
  full_name    text not null default '',
  bio          text not null default '',
  location     text not null default '',
  interests    text not null default '',
  avatar_url   text not null default '',
  created_at   timestamptz not null default now(),
  -- Lower case only, so the stored value and the URL agree without anyone
  -- having to normalise at the call site. Three characters minimum keeps
  -- the single letters out of reach of whoever asks first.
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$')
);

-- The uniqueness that matters is case-insensitive: without `lower()`,
-- `Hanoicrew` and `hanoicrew` are two rows and impersonation costs one
-- shift key.
create unique index if not exists profiles_handle_lower
  on public.profiles (lower(handle));

-- A table rather than a check constraint, because the list will grow and
-- a constraint would mean a schema change every time it does.
create table if not exists public.reserved_handles (
  handle text primary key,
  reason text not null default ''
);

insert into public.reserved_handles (handle, reason) values
  -- Already in use as curator_handle on the editorial collections. These
  -- are the dangerous ones: they are visible in the app today, so they are
  -- the names worth taking.
  ('citycrew', 'editorial'), ('hanoicrew', 'editorial'), ('danangcrew', 'editorial'),
  ('saigonnights', 'editorial'), ('saigoncaphe', 'editorial'),
  ('quietcorners', 'editorial'), ('foodmapvn', 'editorial'),
  -- Anything that could be read as the house speaking.
  ('admin', 'system'), ('administrator', 'system'), ('support', 'system'),
  ('help', 'system'), ('official', 'system'), ('team', 'system'),
  ('api', 'system'), ('www', 'system'), ('root', 'system'),
  ('city_crew', 'system'), ('crew', 'system')
on conflict (handle) do nothing;

alter table public.reserved_handles enable row level security;
drop policy if exists "anyone reads reserved handles" on public.reserved_handles;
create policy "anyone reads reserved handles" on public.reserved_handles
  for select using (true);

-- Normalise and gate the handle on the way in.
--
-- This lives in the database rather than the app because the app is not
-- the only writer: the client holds a publishable key and reaches
-- PostgREST directly, so anything enforced only in React Native is
-- enforced nowhere.
create or replace function public.check_handle()
returns trigger
language plpgsql
as $$
begin
  new.handle := lower(trim(new.handle));
  if exists (select 1 from public.reserved_handles r where r.handle = new.handle) then
    raise exception 'handle_reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_handle on public.profiles;
create trigger profiles_check_handle
  before insert or update of handle on public.profiles
  for each row execute function public.check_handle();

-- A handle nobody chose, for a row that has to exist before anyone has.
--
-- Deliberately shaped like a placeholder — someone seeing `user7k2m9x` on
-- their own profile knows to change it, where a name derived from their
-- own would look chosen and stay forever.
create or replace function public.random_handle()
returns text
language sql
as $$
  select 'user' || lower(encode(gen_random_bytes(4), 'hex'));
$$;

-- One profile per account, created with the account.
--
-- The handle asked for at sign-up rides along in the metadata. If it is
-- taken by the time this runs, the row still gets made with a generated
-- one: a race over a name is not a reason to fail an account into
-- existence half-formed, and the owner can change it in Edit profile.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Everyone who signed up before this table existed.
do $$
declare
  u record;
  gen text;
begin
  for u in select * from auth.users loop
    if not exists (select 1 from public.profiles p where p.id = u.id) then
      loop
        gen := public.random_handle();
        exit when not exists (select 1 from public.profiles p where lower(p.handle) = gen);
      end loop;
      insert into public.profiles (id, handle, full_name, bio, location, interests, avatar_url)
      values (
        u.id, gen,
        coalesce(u.raw_user_meta_data->>'full_name', ''),
        coalesce(u.raw_user_meta_data->>'bio', ''),
        coalesce(u.raw_user_meta_data->>'location', ''),
        coalesce(u.raw_user_meta_data->>'interests', ''),
        coalesce(u.raw_user_meta_data->>'avatar_url', '')
      );
    end if;
  end loop;
end $$;

alter table public.profiles enable row level security;

-- Readable by anyone, including signed-out visitors: a shared collection
-- has to be able to say who made it, and the person reading it may not
-- have an account yet.
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles
  for select using (true);

-- Yours to change, and only yours. There is no insert policy on purpose —
-- rows come from the trigger, which runs as definer, so the only way to
-- get a profile is to have an account.
drop policy if exists "owners update their profile" on public.profiles;
create policy "owners update their profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
