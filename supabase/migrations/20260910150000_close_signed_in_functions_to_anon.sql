-- Close the signed-in functions to the signed-out.
--
-- Every definer function in this schema was callable by `anon`, including
-- the ones whose own migration said `revoke all ... from public; grant
-- execute ... to authenticated`. That revoke never did what it read as:
-- Supabase grants EXECUTE on each new function to `anon` *by name*,
-- through the schema's default privileges, and taking it back from PUBLIC
-- leaves a grant made by name standing.
--
-- None of the eight below could be turned against anybody from outside:
-- each is keyed on `auth.uid()`, which is null for a caller with no
-- session, or checks `is_editor()` first. So this is not a breach being
-- closed. It is the gap between what the migrations say and what the
-- database does, closed before a function that is *not* self-guarding
-- lands in it — which, with the defaults as they were, it would have done
-- open to the world.
--
-- ── what stays open to anon, and why ──
--
-- `is_editor`, `on_trip`, `my_reports_today`, `own_collection_places_today`
-- and `trip_invite_count` are called from inside RLS policies written
-- `to public`. A policy is evaluated for every role it applies to, and a
-- role without EXECUTE on a function inside it gets "permission denied"
-- rather than "no rows" — so closing `is_editor` to anon would take the
-- whole catalog away from every guest. Each answers only about the caller,
-- and for a caller with no session the answer is false or zero.
--
-- `collection_like_counts` is read by the guest's Explore shelf, and
-- counts likes on public lists only.
--
-- `supabase/tests/function_grants_test.sql` holds that list: a definer
-- function anon can execute and that is not on it fails the bench.

revoke execute on function public.block_user(uuid) from anon;
revoke execute on function public.likes_on_mine(timestamptz) from anon;
revoke execute on function public.moderate_collection(uuid, boolean) from anon;
revoke execute on function public.moderate_profile(uuid, boolean, boolean, boolean) from anon;
revoke execute on function public.mutual_saves_counts(uuid[]) from anon;
revoke execute on function public.reports_queue() from anon;
revoke execute on function public.suggested_friends() from anon;
revoke execute on function public.trip_crew_counts(uuid[]) from anon;

-- ── and the next function ──
--
-- New functions are no longer executable by anon, or by PUBLIC, unless
-- their migration grants it. Signed-in callers keep the default grant, so
-- an ordinary RPC still works the moment it lands; a function a guest has
-- to reach — including any helper called from a policy written `to
-- public` — must now say `grant execute ... to anon` in so many words.
--
-- Two statements, because the grant comes from two places. `anon` is
-- granted by name in this schema's defaults, and that is revoked per
-- schema. PUBLIC's EXECUTE is Postgres's own global default, and a
-- per-schema revoke cannot take away a global grant — the bench's
-- function_grants_test caught exactly that — so it is revoked globally,
-- for functions this role creates. `authenticated` and `service_role`
-- keep their grants, which the schema's defaults make by name.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges revoke execute on functions from public;
