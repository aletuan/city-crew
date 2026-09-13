-- The seven editorial identities hand their collections over.
--
-- `20260826000000_editorial_identities.sql` gave the seed lists real
-- accounts, so the community grid had faces to draw. Those accounts cannot
-- be signed in to — empty password hash, reserved-TLD address — which also
-- means nobody can edit what they own: not a cover, not a title, not the
-- order of the places. The owner asked for that control, and the plainest
-- way to have it is to own the rows.
--
-- Two consequences, both intended and both worth stating:
--
-- 1. The byline changes. `collections_stamp_curator` re-stamps
--    `curator_handle` from the owner's profile on any update of a public
--    row, so these lists read "by @<the desk's handle>" from here on. The
--    pen names stop appearing on lists; the identities themselves stay in
--    `profiles`, and their handles stay reserved.
-- 2. The desk's daily caps now count these rows. They already exist, so
--    nothing is refused today; a later bulk edit is what would meet a cap.
--
-- Reversible: every row moved leaves its old owner and old handle in
-- `editorial_collection_origin`. A restore writes `owner_id` first and
-- `curator_handle` second, because the stamp trigger fires on the first
-- write and would otherwise overwrite the handle being restored.

create table if not exists public.editorial_collection_origin (
  collection_id uuid primary key references public.collections(id) on delete cascade,
  previous_owner_id uuid not null,
  previous_curator_handle text,
  moved_at timestamptz not null default now()
);

-- Desk history. Nothing in the app reads it, and the service role reaches
-- it regardless of policy; RLS on with no policy is the closed door.
alter table public.editorial_collection_origin enable row level security;

-- The move itself, as a function rather than a one-off block: it is the
-- only thing here worth testing, the bench can call it against its own
-- seed (see `editorial_adopt_test.sql`), and a later seed batch can be
-- adopted with one call rather than another hand-written migration.
--
-- Idempotent: a row already moved has no editorial owner to match, so a
-- second call moves nothing and returns 0.
create or replace function public.adopt_editorial_collections(target_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  moved int;
begin
  select u.id into target from auth.users u where lower(u.email) = lower(target_email);
  if target is null then
    raise notice 'adopt_editorial_collections: no account for %, nothing moved', target_email;
    return 0;
  end if;

  insert into public.editorial_collection_origin (collection_id, previous_owner_id, previous_curator_handle)
  select c.id, c.owner_id, c.curator_handle
  from public.collections c
  join auth.users u on u.id = c.owner_id
  where u.email like '%@editors.citycrew.invalid'
  on conflict (collection_id) do nothing;

  update public.collections c
  set owner_id = target
  from auth.users u
  where u.id = c.owner_id and u.email like '%@editors.citycrew.invalid';

  get diagnostics moved = row_count;
  return moved;
end $$;

-- Not callable over the wire. A `security definer` function left
-- executable by `anon` is an endpoint at /rest/v1/rpc/… — the lesson the
-- profiles migration wrote down.
revoke execute on function public.adopt_editorial_collections(text) from anon, authenticated, public;

-- The move, on whichever database has the desk's account. A bench has
-- none, so this is a no-op there and the test drives the function itself.
do $$
declare moved int;
begin
  select public.adopt_editorial_collections('anhlt1983@gmail.com') into moved;
  raise notice 'editorial collections adopted: %', moved;
end $$;
