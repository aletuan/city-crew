-- The mark a person wears on their page (owner, 16 Nov 2026).
--
-- A local guide and an editor each wear a disc on their own picture, on
-- their own Profile: a star, a medal. It says the desk trusts this
-- account to keep places — to edit them and add photographs. Until now
-- only the account itself could see it, because only the account itself
-- could ask: `local_guides` is read by its own guide (`guides read their
-- own grant`) and `is_editor()` answers about the caller's email.
--
-- A person's page (`PersonScreen`) is where somebody else decides whether
-- to trust what this person keeps, and the mark belongs there. So this
-- answers one narrow question about another account: which mark, if any.
--
--   'editor'  on the desk's list — the app calls it Super User
--   'guide'   a local guide of any city, or of every city
--   null      neither
--
-- Editor first, as the app draws it: the desk's hand keeps every gallery,
-- which includes the ones a guide keeps, and one disc is shown.
--
-- What it does not say, on purpose:
--   - which cities a guide is a guide of, who granted it, or when — the
--     mark is a role, and the rest is the desk's record;
--   - an editor's email. `editors` is keyed by email; the join to the
--     account is made in here and only the word leaves.
--
-- To somebody signed in, as the rest of what a page shows a stranger is
-- (`places_in_common`); a guest is told nothing. And nothing across a
-- block, either way, as that function draws it: a person who blocked the
-- reader is not vouched for to them.
--
-- `security definer`, for the two reads the caller cannot make
-- (`local_guides` of another account, `editors` at all, `auth.users`).

create or replace function public.role_of(person uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or person is null then null
    when exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = person)
         or (b.blocker = person and b.blocked = auth.uid())
    ) then null
    when exists (
      select 1
      from auth.users u
      join public.editors e on e.email = lower(coalesce(u.email, ''))
      where u.id = person
    ) then 'editor'
    when exists (select 1 from public.local_guides g where g.user_id = person) then 'guide'
  end;
$$;

revoke all on function public.role_of(uuid) from public, anon;
grant execute on function public.role_of(uuid) to authenticated;
