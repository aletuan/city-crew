-- A record of what the desk did, and who did it.
--
-- The desk can hide a public list, blank parts of a profile, and ban an
-- account — reversible acts, chosen so a misjudgement stays cheap. But a
-- reversal needs somebody to notice, and until now nothing wrote any of it
-- down: a list could vanish, a bio be cleared or a person be locked out,
-- and the only trace was the state it left behind. With more than one
-- editor that is also the question nobody could answer: who did this?
--
-- ── append-only ──
--
-- Nothing a client holds can write here, change a row or remove one. The
-- two moderation functions write from inside their own security definer,
-- the ban from the suspend-user function's service role. Editors read it;
-- nobody else does, since a row names the person acted on.

create table public.moderation_log (
  id          bigint generated always as identity primary key,
  actor       uuid not null,
  actor_email text not null,
  action      text not null check (action in (
                'hide_collection', 'show_collection', 'clear_profile', 'suspend', 'unsuspend')),
  target_id   uuid not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index moderation_log_target on public.moderation_log (target_id, created_at desc);

alter table public.moderation_log enable row level security;

create policy "editors read the log" on public.moderation_log
  for select to authenticated using (public.is_editor());

revoke insert, update, delete, truncate on public.moderation_log from anon, authenticated;

-- The ban is written by the suspend-user function, as the service role.
-- Supabase's table defaults would grant this anyway; said here so the
-- function does not depend on them. Guarded because the test bench has no
-- such role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.moderation_log to service_role;
  end if;
end $$;

-- The two content functions, as before, plus the line that says so. The
-- row is written in the same transaction as the change: an act that did
-- not happen is not logged, and one that did cannot go unlogged.

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
  insert into public.moderation_log (actor, actor_email, action, target_id)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')),
    case when hide then 'hide_collection' else 'show_collection' end, target
  );
end;
$$;

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
  insert into public.moderation_log (actor, actor_email, action, target_id, detail)
  values (
    auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), 'clear_profile', target,
    jsonb_build_object('bio', clear_bio, 'avatar', clear_avatar, 'name', clear_name)
  );
end;
$$;

-- `create or replace` keeps the grants the functions already had; stated
-- again so the file reads whole.
revoke all on function public.moderate_collection(uuid, boolean) from public, anon;
grant execute on function public.moderate_collection(uuid, boolean) to authenticated;
revoke all on function public.moderate_profile(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.moderate_profile(uuid, boolean, boolean, boolean) to authenticated;
