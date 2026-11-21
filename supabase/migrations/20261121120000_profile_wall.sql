-- The cover on a person's page, chosen by its owner (W1 of
-- docs/wall-plan.md, owner 21 Nov 2026).
--
-- Two columns, not one: what kind of picture, and which. `wall_kind` null
-- is "automatic" — the page picks, as it always has — and then `wall_ref`
-- is null too. A city and a collection are named by id and resolved on the
-- phone, which already holds the cities and the person's public lists; a
-- collection that has gone private or away is simply not among them, and
-- the page falls back to automatic (decision 4) without the server having
-- to chase it.
--
-- An upload is named by its public URL, as `avatar_url` is, so the stamp
-- that defeats the cache (`?v=`) travels with it. It lives in the
-- `avatars` bucket at `<uid>/wall.jpg`, whose policies already confine a
-- write to the writer's own folder.
--
-- The check is what `avatar_url` never had: the owner writes these columns
-- directly (the "owners update their profile" policy), so without it any
-- URL at all — another person's upload, a page elsewhere — could be named
-- as a cover that everyone sees. An upload must be this project's storage,
-- in this row's own folder. The host is written out: a prefix with a
-- wildcard before it would admit any host that ends in the same path.

alter table public.profiles
  add column if not exists wall_kind text,
  add column if not exists wall_ref text;

alter table public.profiles drop constraint if exists profiles_wall_check;
-- Wrapped in coalesce because a check passes on null: `wall_kind = 'city'
-- and wall_ref ~ …` is null, not false, when `wall_ref` is null, and a
-- null result would have let a kind with nothing named — or a name with no
-- kind — through. The bench caught both.
alter table public.profiles add constraint profiles_wall_check check (coalesce(
  (wall_kind is null and wall_ref is null)
  or (wall_kind = 'city' and wall_ref ~ '^[a-z0-9_-]{1,40}$')
  or (wall_kind = 'collection'
      and wall_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  or (wall_kind = 'upload'
      and starts_with(wall_ref,
        'https://amdvitzpogaejzzqroco.supabase.co/storage/v1/object/public/avatars/'
        || id::text || '/wall.jpg')
      and length(wall_ref) <= 300)
, false));

-- The desk takes a cover down as it takes down a photo: back to automatic,
-- one line in the log. The file stays at `<uid>/wall.jpg` until the owner
-- uploads another or deletes the account; nothing names it any more, and
-- SQL cannot remove a storage object.
--
-- A fifth argument changes the signature, so the four-argument function
-- goes: two overloads would leave the desk's named-argument call
-- ambiguous. Every caller names its arguments, and the new one defaults
-- to false, so each call reads as it did.
drop function if exists public.moderate_profile(uuid, boolean, boolean, boolean);
create or replace function public.moderate_profile(
  target uuid, clear_bio boolean default false,
  clear_avatar boolean default false, clear_name boolean default false,
  clear_wall boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor() then
    raise exception 'not an editor';
  end if;
  update public.profiles
  set bio        = case when clear_bio then '' else bio end,
      avatar_url = case when clear_avatar then '' else avatar_url end,
      full_name  = case when clear_name then '' else full_name end,
      wall_kind  = case when clear_wall then null else wall_kind end,
      wall_ref   = case when clear_wall then null else wall_ref end
  where id = target;
  insert into public.moderation_log (actor, actor_email, action, target_id, detail)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), 'clear_profile', target,
    jsonb_build_object('bio', clear_bio, 'avatar', clear_avatar, 'name', clear_name, 'wall', clear_wall)
  );
end;
$$;

revoke all on function public.moderate_profile(uuid, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.moderate_profile(uuid, boolean, boolean, boolean, boolean) to authenticated;
