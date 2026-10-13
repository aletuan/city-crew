# i18n expansion — review of the brief, and the plan

Written 13 Oct 2026 against `main` at 77f2b8a and the live project
`amdvitzpogaejzzqroco`. Companion to `i18n-expansion-brief.md`; every
figure below was re-read from the live table today, and where it differs
from the brief the live figure is used.

## 1. What the data actually says

| | live (`is_published`) |
|---|---|
| places | 940 |
| no blurb in any language | **727** |
| EN blurb, no JA | 110 (brief: 112) |
| featured | 21, of which 6 have **no blurb at all** and 15 already have JA |
| in a collection | 216, of which 184 have **no blurb at all**, 12 have EN but no JA, 20 have JA |
| `name_ja` empty | 890 of 940 |
| `neighborhood_ja` empty | 917 of 940 |
| collections without `desc_ja` | 18 of 38 |
| cities without `name_ja` | 0 |

The 110 EN-no-JA rows by source: 42 threads, 34 editorial, 14 google,
20 unrecorded (18 of those are today's `write-blurb` drafts, now stamped
`editorial`).

**Reading.** "112 places missing desc_ja" is the smallest of the three
gaps, not the largest. A Japanese reader of this app today sees English
on 837 of 940 places, and on 727 of them so does everyone else, because
there is no blurb at all. The priority list in the brief ("21 featured,
216 in collections") is, once the rows are opened, "6 featured and 184
in collections with no blurb in any language" — which is `write-blurb`'s
job, not a translation job. Only 12 collection places and 0 featured
places are a pure EN→JA translation.

`name_ja` and `neighborhood_ja` being empty on ~95% of rows is not a
defect to recover: a café's name is its name, and the app already falls
back to EN through `t(name_en, name_vi, name_ja)` on every read site.
Recovering them would mean transliterating 890 proper names into
katakana, which is worse than the Latin name for a Japanese reader who
has to say it to a taxi driver.

## 2. What the code actually says

- **The leak is exactly where the brief says.** `dashboard/src/components/PlaceEditor.jsx`
  lists `FORM_FIELDS` by hand, `BilingualField` renders `[EN, VI]` by
  hand, and `dashboard/src/api.js` `EDITABLE` repeats the list a third
  time. `desc_ja` is not in any of them, so the desk cannot write it and
  the Threads skill says so ("desc_ja can only be written through the
  Supabase MCP"). The city hero editor already does three languages,
  also by hand (`['en','vi','ja']` twice in `CityHero.jsx`).
- **The app reads JA columns in 68 places across 30 files** (brief: ~50
  call sites). 60 of them are the same shape, `t(x.name_en, x.name_vi,
  x.name_ja)`, plus four select-column strings (`PLACE_COLS`,
  `COLLECTION_COLS`, `CITY_COLS`, checkins) and `search.ts`, which joins
  all nine localized columns into one haystack on purpose (a Japanese
  reader typing "pho" must still find Phở 10).
- **`refresh-places` touches only `desc_en`** (Google's editorial
  summary) and never a JA column, so no schema change reaches it unless
  `desc_en` itself moves.
- **RLS is per table, not per column**: `editors manage places` (ALL)
  and `public read published places` (SELECT). Any new table inherits
  nothing and needs both policies written again; a JSONB column on the
  same table inherits both for free.
- **`database.types.ts` is generated** and lists every `_ja` column; it
  is regenerated, not edited, on any schema change.
- **UI strings: 725 inline `t('en','vi','ja')` calls across 60
  non-test files** (brief: 707 on 57). `lib/i18n.tsx` is 60 lines and
  its whole contract is the positional triple.
- **`write-blurb` returns `desc_vi` and `desc_en` only.** Adding
  `desc_ja` to its JSON schema is one line and one more field in the
  prompt; the model is already looking at the photographs.

## 3. The plan, as PRs

### PR 1 — Data Desk writes every language in one list (Step 1)

`dashboard/src/langs.js`: `LANGS = [{code:'en',label:'EN'},{code:'vi',label:'VI'},{code:'ja',label:'JA'}]`,
`LOCALIZED_FIELDS = ['name','desc','neighborhood']`, and
`localizedColumns()` that produces `name_en … neighborhood_ja`.
`PlaceEditor` renders one `LocalizedField` per base field that maps over
`LANGS`; `FORM_FIELDS` and `api.js`'s `EDITABLE` are built from
`localizedColumns()` plus the non-localized tail. The grid becomes
`repeat(auto-fit, minmax(170px, 1fr))` so a fourth language reflows
without a CSS edit. Acceptance test: a test mocks `langs.js` with `ko`
appended and asserts `name_ko`, `desc_ko`, `neighborhood_ko` render and
save. Nothing else in `dashboard/` changes to add a language. The DB
column must exist, which is outside `dashboard/` by design.

Not in PR 1: `CityHero.jsx` (its own `['en','vi','ja']`, same fix, own
PR if wanted) and `write-blurb` emitting JA (PR 4).

### PR 2 — App: say when a blurb is the English fallback (Step 4)

`app/src/lib/i18n.tsx` gains `pick(en, vi, ja): { text, lang }` beside
`t`, so a screen can know *which* variant it got. `PlaceDetailScreen`
shows a small tertiary label under the blurb when `lang !== 'en'` and
`pick(...).lang === 'en'`: "Bản tiếng Anh" / "英語の原文". Only on the
blurb; names and neighbourhoods fall back silently (see §1). Tests with
a mutant check (label absent when a JA blurb exists; absent in EN).

### PR 3 — Content schema for n languages (Step 2): decision first

Two candidates, measured against this codebase rather than in general.

**A. Side table** `place_i18n(place_id, lang, name, desc, neighborhood,
machine boolean, source, updated_at)`, same for `collection_i18n`,
`city_i18n`, plus `languages(code, label, is_active, fallback)`.

- Adding a language: one insert in `languages`. No DDL.
- Per-language metadata (machine-translated, who, when) is a column, which
  Step 3 wants.
- Cut-over: every app read is a PostgREST select string; the embed
  `place_i18n(lang, name, desc, neighborhood)` becomes one more nested
  array per row, and a `localized(place, lang)` helper replaces the 60
  `t(x_en, x_vi, x_ja)` sites. A compatibility *view* keeping `name_en…`
  as columns is possible but it is a join-view: not auto-updatable, so
  the desk's and `AddPlaceScreen`'s writes need `INSTEAD OF` triggers,
  and it must be created `with (security_invoker = true)` or it bypasses
  RLS. PostgREST embedding through a view works but relationship
  detection is the part that breaks silently.
- RLS: two new tables × two policies each, plus the `is_editor()` gate;
  the public-read policy has to re-derive "published and approved" from
  the parent row (a join in the policy, evaluated per row).
- `search.ts`: the haystack is built from a row; it would read the embed
  array instead of nine columns. Same cost, one more shape.
- `refresh-places`: untouched while `desc_en` stays a column; if EN moves
  into the side table too, its `desc_en` write becomes an upsert.
- `database.types.ts`: regenerated; the embed is typed.

**B. JSONB** — one column per localized field (`name_i18n`,
`desc_i18n`, `neighborhood_i18n` as `{"en":…, "vi":…, "ja":…}`), or one
column `i18n` keyed by language then field.

- Adding a language: no DDL, a new key. `languages` table still useful
  for labels and ordering, but optional.
- Per-language metadata: either a parallel `desc_i18n_meta` or the
  per-language object shape `{"ja": {"text":…, "machine": true}}`; the
  latter is the honest one and it is what `i18n` keyed-by-language gives
  for free.
- Cut-over: same table, so RLS is unchanged and the 68 read sites keep
  working through **generated columns** (`name_ja text generated always
  as (i18n->'ja'->>'name') stored`) — reads are compatible on day one,
  and the app migrates its `t(...)` sites at leisure. The catch is
  writes: a generated column is not writable, so the desk's save, the
  `AddPlaceScreen` insert and `import-place.ts` must write JSON in the
  same release that flips the columns. PR 1's `localizedColumns()` is
  the single place the desk writes through, which is the point of doing
  PR 1 first.
- `search.ts`: `Object.values(i18n).flatMap(…)` — simpler than today.
- `refresh-places`: `desc_en` becomes `i18n->'en'->>'desc'`; one line.
- `database.types.ts`: JSONB comes out as `Json`; a hand-written
  `Localized` type and a `localized(row, lang)` helper carry the typing
  the generated file loses. Postgres cannot type-check the shape; a
  `check (jsonb_typeof(i18n) = 'object')` is the most it offers.

**Recommendation, to be confirmed:** B, as a single `i18n` column keyed
by language, with `en` and `vi` *staying as physical columns* (they are
the editorial base pair, every write path produces them, and 727 rows
have nothing else) and every further language living in `i18n`. JA
moves in with its 103 blurbs; `name_ja`/`desc_ja`/`neighborhood_ja`
become generated columns so nothing in the app changes on cut-over day.
What rules A out here is not the model — a side table is the textbook
answer — but that this app has no server between the client and the
table: every read is a PostgREST select string and every policy is per
table, so a second table doubles the policies and puts a join inside the
public-read one, for a catalog of 940 rows that fits in one request.

**Correction made while writing PR 3a (13 Oct):** generated columns
cannot be assigned, and three writers assign the `_ja` columns today —
the desk's Save (every form field), `import-place.ts` (`name_ja` from a
kana sign) and ad-hoc SQL. A generated column would have broken the
desk on the day it applied, before the desk change could ship, and the
desk change cannot ship first because its target column would not
exist. So the `_ja` columns stay real and a BEFORE trigger
(`sync_place_i18n`) mirrors both ways, object winning when both change
in one statement; writers move one at a time, and the columns and the
trigger go in a last migration once nothing writes them. The read-side
compatibility the generated column promised is the same.

What would change the recommendation: a plan to let *contributors*
submit translations (per-row ownership and review state per language is
where a side table earns its policies), or a sixth language.

Cost: migration + mirror trigger + SQL test (`supabase/tests`), the
desk's save (one function), `AddPlaceScreen`, `import-place.ts`, the
`write-blurb` save path, `search.ts`, `localized()` helper + the 60 call
sites moved behind it (mechanical), regenerated types. Four PRs,
roughly: 3a schema + mirror (no app change), 3b desk writing JSON with
the `machine` mark, 3c app helper + call sites + types, 3d drop the
`_ja` columns and the trigger.

### UI strings (separate from the content schema)

725 inline triples in 60 files. For `ko`/`zh` the positional triple
cannot grow: `t(en, vi, ja, ko, zh)` on 725 sites is unreadable and
every untranslated site falls to EN silently with no way to list them.

Proposal: **key-based catalog, derived from the existing triples by a
codemod, keyed by the English string.** A script walks the AST, turns
`t('Save','Lưu','保存')` into `t('Save')`, and emits `locales/vi.json`
and `locales/ja.json` with `"Save": "Lưu"`; a `ko.json` starts as a
missing-keys report. The English literal stays the key, so the code
stays readable and nothing is renamed by hand. Pluralisation and
interpolated strings (template literals inside `t(...)`) are the
exceptions the codemod lists rather than converts.

Effort: codemod half a day with the 725-site inventory as its test
(every converted site must round-trip to the same three strings), the
catalog types and the `t` rewrite a day, review of the exceptions a day.
Translating 725 strings into one new language is a separate job and the
catalog makes it a file, not a code change. Adding `ko` becomes:
`LANGS` gains a row, `ko.json` is filled, untranslated keys fall back to
EN by the same rule as today.

### Step 3 — recovering JA, honestly

- The EN→JA translation set is 110 rows, not 112, and only 12 of them
  are collection places. None are featured.
- What machine JA from an EN blurb reads like: the 42 threads blurbs
  were a person's Vietnamese or English, lifted verbatim and credited;
  translating a credited quotation is a different act from translating
  house copy, and a `@handle on Threads` credit under machine Japanese
  misattributes. The 34 editorial and 14 google ones translate cleanly.
  Expect competent, slightly flat Japanese; place names and dish names
  are where it goes wrong (it will render Phở in katakana).
- Mark it: with schema B the mark is `"machine": true` in the JA object;
  before B lands, a `desc_ja_source text` column (`machine`/`human`) is
  the smallest honest mark, and `Coverage.jsx` can count it. The app
  treats a machine JA blurb as a JA blurb (no label — the label in PR 2
  is for *English* shown to a JA reader); the desk lists them for review.
- Order: the 6 featured + 184 collection blanks go through `write-blurb`
  first (PR 4 adds `desc_ja` to its output so new drafts arrive with all
  three), then the 12 collection EN-no-JA by one batch call, then the
  long tail stays on the EN fallback with the PR 2 label.

### PR 4 — `write-blurb` emits JA too

One field in the JSON schema, one rule in the prompt ("desc_ja is
Japanese for a Japanese reader, not a translation of either"), the desk
drops it into the JA field PR 1 created. Marked `machine` by
construction. Cheap, and it stops the backlog growing in two languages
while it shrinks in a third.

## 4. Order

PR 1 (desk) → PR 2 (app label) → PR 4 (write-blurb JA) are independent
and deployable this week. PR 3 waits on the A/B decision above.
