-- What the desk may do about a report.
--
-- The store's rule is not satisfied by a queue nobody can act on: the
-- ask is to remove offending content and, where warranted, the account
-- that posted it. Removing the account is an auth-schema act and lives
-- in the suspend-user function; removing the content is here.
--
-- ── narrow on purpose ──
--
-- No editor policy is added to `collections` or `profiles`, because a
-- blanket "editors manage everything" would let the desk rewrite a
-- stranger's list — a power nobody asked for and one this app should
-- not hold. These two functions can do exactly three things: hide a
-- public list, blank a bio, drop an avatar. They cannot edit words into
-- somebody's mouth, and they cannot touch anything private, which was
-- never public and so was never reportable.
--
-- Hiding rather than deleting, for the same reason the ban is a ban
-- rather than a delete: the desk is people, people misjudge, and a
-- reversible act keeps the mistake cheap. `is_public = false` returns
-- the list to its owner, intact and invisible to everyone else.

create or replace function public.moderate_collection(target uuid, hide boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor() then
    raise exception 'not an editor';
  end if;
  update public.collections set is_public = not hide where id = target;
end;
$$;

revoke all on function public.moderate_collection(uuid, boolean) from public;
grant execute on function public.moderate_collection(uuid, boolean) to authenticated;

-- Each field on its own flag: a bio that breaks the rules is not a
-- reason to take somebody's photograph, and a desk that can only act
-- wholesale will act wholesale.
create or replace function public.moderate_profile(
  target uuid, clear_bio boolean default false,
  clear_avatar boolean default false, clear_name boolean default false
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
      full_name  = case when clear_name then '' else full_name end
  where id = target;
end;
$$;

revoke all on function public.moderate_profile(uuid, boolean, boolean, boolean) from public;
grant execute on function public.moderate_profile(uuid, boolean, boolean, boolean) to authenticated;
