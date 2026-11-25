-- A fix applied to the live project and never committed; its change was
-- later folded into the file it fixes. Copied from the live history on
-- 25 Nov 2026, byte for byte, so the two histories name the same rows.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

-- random_handle() was pinned to `search_path = public` — the right
-- instinct, aimed a schema short: pgcrypto lives in `extensions` on a
-- real project, so the one path that needs gen_random_bytes — a sign-up
-- without a usable handle in its metadata — failed outright. The bench
-- never saw it because a bare Postgres installs pgcrypto into `public`;
-- it does not any more, and this is the fix it now insists on.
--
-- `extensions` is trusted and postgres-owned, so the pin's point
-- survives: nothing a caller fronts can shadow either schema.
create or replace function public.random_handle()
returns text
language sql
set search_path = public, extensions
as $$
  select 'user' || lower(encode(gen_random_bytes(4), 'hex'));
$$;
