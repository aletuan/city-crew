-- The catalog's separator becomes the en dash: ` — ` → ` – `, in every
-- name column of every place.
--
-- The rule that the importer writes one dash between a name and its
-- suffix shipped on the morning of 2 Oct 2026 with the em dash
-- (20261002090000_place_import_audit_20261002.sql and the two migrations
-- after it moved 268 names over). The owner read the result in the app
-- that afternoon and found the long bar heavy: a name is set bold at 17pt
-- on a card, and an em dash there is as wide as a short word. The en dash
-- is the mark typography already uses for a pairing — `Hà Nội – Huế` —
-- which is what a brand and its branch are; the em dash is for a break in
-- a sentence, and a name is not one. docs/place-naming.md has the rule;
-- supabase/functions/_shared/place-name.ts writes it from here on.
--
-- A straight replace, not a keyed list: the em dash with a space each
-- side appears in a name only where the importer or a migration of
-- today put it (169 rows in name_en when this was written; name_vi
-- follows name_en; name_ja carries it where a bilingual sign was split).
-- Idempotent — a second run finds nothing to replace. Slugs do not
-- change. Search folds every dash to one (app/src/lib/search.ts), so a
-- reader's saved query lands on the same row before and after.

update public.places
   set name_en = replace(name_en, ' — ', ' – '),
       name_vi = replace(name_vi, ' — ', ' – '),
       name_ja = replace(name_ja, ' — ', ' – ')
 where name_en like '% — %'
    or name_vi like '% — %'
    or name_ja like '% — %';
