-- Who may call what: the definer functions, against the signed-out.
--
-- Supabase grants EXECUTE on every new function to `anon` by name, and a
-- migration's `revoke ... from public` never took that back — so every
-- definer function here was callable signed out, whatever its migration
-- said. This file pins the list of the ones that are *meant* to be, and
-- that the next function does not join it by default.

-- ── the allowlist ──
--
-- Each is either a helper called from a policy written `to public` — a
-- policy is evaluated for every role it names, and one without EXECUTE on
-- a function inside it errors instead of returning no rows — or a read a
-- guest's screen makes. See 20260910150000_close_signed_in_functions_to_anon.
do $$
declare
  allowed text[] := array[
    'is_editor', 'on_trip', 'my_reports_today', 'own_collection_places_today',
    'trip_invite_count', 'collection_like_counts'
  ];
  stray text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into stray
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
    and p.proname <> all (allowed);
  assert stray is null, format('definer functions open to anon and not on the list: %s', stray);
end $$;

-- ── the ones closed, closed only to the signed-out ──
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.block_user(uuid)', 'public.likes_on_mine(timestamptz)',
    'public.moderate_collection(uuid, boolean)',
    'public.moderate_profile(uuid, boolean, boolean, boolean)',
    'public.mutual_saves_counts(uuid[])', 'public.reports_queue()',
    'public.suggested_friends()', 'public.trip_crew_counts(uuid[])'
  ]::regprocedure[] loop
    assert not has_function_privilege('anon', f, 'execute'), format('%s is open to anon', f);
    assert has_function_privilege('authenticated', f, 'execute'), format('%s is closed to readers', f);
  end loop;
end $$;

-- ── and the next one ──
--
-- A function landing after the change is open to readers, as an RPC must
-- be to work, and closed to guests until its migration says otherwise.
create function public._grants_probe() returns int language sql as $$ select 1 $$;
do $$
begin
  assert not has_function_privilege('anon', 'public._grants_probe()', 'execute'),
    'a new function is open to anon by default';
  assert has_function_privilege('authenticated', 'public._grants_probe()', 'execute'),
    'a new function is closed to readers by default';
end $$;
drop function public._grants_probe();

select 'all function grant checks passed' as result;
