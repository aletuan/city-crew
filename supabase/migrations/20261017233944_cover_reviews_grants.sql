-- A fix applied to the live project and never committed; its change was
-- later folded into the file it fixes. Copied from the live history on
-- 25 Nov 2026, byte for byte, so the two histories name the same rows.
--
-- CI does not run this file: supabase/tests/run.sh picks its files by name.

revoke all on table public.cover_reviews from anon, authenticated;
grant select, insert, update on table public.cover_reviews to authenticated;
