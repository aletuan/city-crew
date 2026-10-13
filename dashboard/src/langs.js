// The languages the catalog is written in, in one place.
//
// Every localized value follows one rule, `<field>` in `<lang>`, and until
// 13 Oct 2026 the desk spelled that rule out by hand three times:
// `FORM_FIELDS` in the editor, `EDITABLE` in `api.js`, and a
// `BilingualField` that rendered EN and VI and nothing else. The third
// language had been in the table since 8 Aug 2026 and, because none of
// the three lists mentioned it, the desk could neither show nor save a
// Japanese blurb: 110 published places carried an English blurb and no
// Japanese one, and the only way to write one was a SQL update.
//
// So the rule lives here and the lists are derived. Adding a language is
// one row below — the editor grows a column, the save path accepts it,
// nothing else in `dashboard/` changes.
//
// ── where each language is stored ──
//
// EN and VI are columns (`name_en`, `desc_vi`, …): the pair the catalog
// is written in, that every import produces, that 727 rows carry and
// nothing else. Every language after them lives in `places.i18n`, one
// JSONB object keyed by language then field (migration
// `20261013150000_place_i18n`), so a fourth language is a key and not
// three columns. The form does not know the difference: every language
// is three flat keys (`name_ja`, `desc_ja`, `neighborhood_ja`), unfolded
// from the object on load and folded back into it on Save. Readers of
// the form, the tests and the Threads skill keep selecting by the same
// ids they always did.
//
// Beside the text, the object carries what a column never could:
// `machine: true` on a language whose words came out of `write-blurb`
// and have not been changed by a person since. The fold decides it: a
// draft just taken sets it, a text a person edited clears it, a text
// nobody touched keeps whatever it had.

export const LANGS = [
  { code: 'en', label: 'EN', store: 'column' },
  { code: 'vi', label: 'VI', store: 'column' },
  { code: 'ja', label: 'JA', store: 'i18n' },
];

/** The base names of the values that exist once per language. */
export const LOCALIZED_FIELDS = ['name', 'desc', 'neighborhood'];

export const columnLangs = () => LANGS.filter((l) => l.store === 'column');
export const objectLangs = () => LANGS.filter((l) => l.store === 'i18n');

/** `name_en, name_vi, … neighborhood_vi` — the localized *columns*,
 *  field-major: what the row itself has, and what Save may name. */
export const localizedColumns = (fields = LOCALIZED_FIELDS) =>
  fields.flatMap((field) => columnLangs().map((l) => `${field}_${l.code}`));

/** Every language's flat form keys, columns and object alike. */
export const localizedKeys = (fields = LOCALIZED_FIELDS) =>
  fields.flatMap((field) => LANGS.map((l) => `${field}_${l.code}`));

const text = (s) => (typeof s === 'string' ? s.trim() : '');

/** The object's languages as flat form keys, `null` where the object
 *  holds nothing — the same shape a column gives the form. */
export function unfoldI18n(i18n) {
  const out = {};
  for (const l of objectLangs()) {
    for (const field of LOCALIZED_FIELDS) {
      out[`${field}_${l.code}`] = text(i18n?.[l.code]?.[field]) || null;
    }
  }
  return out;
}

/**
 * The flat form keys folded back into the object, over `base` (the row's
 * object as loaded), with `drafted` naming the blurb text the model
 * produced this session, per language.
 *
 * A language with no text left is dropped whole, flag included — the
 * trigger does the same on a column-side write, so the two agree on
 * what "nothing" looks like. Languages the form does not carry (one
 * written by hand into the object, or a key this desk has no row for)
 * pass through untouched.
 */
export function foldI18n(form, base = {}, drafted = {}) {
  const out = { ...(base ?? {}) };
  for (const l of objectLangs()) {
    const was = base?.[l.code] ?? {};
    const now = {};
    for (const field of LOCALIZED_FIELDS) {
      const v = text(form?.[`${field}_${l.code}`]);
      if (v) now[field] = v;
    }
    if (!Object.keys(now).length) { delete out[l.code]; continue; }
    const unchanged = LOCALIZED_FIELDS.every((field) => (now[field] ?? null) === (text(was[field]) || null));
    const machine = drafted?.[l.code] != null && now.desc === text(drafted[l.code])
      ? true
      : unchanged && was.machine === true;
    const meta = { ...was };
    for (const field of LOCALIZED_FIELDS) delete meta[field];
    delete meta.machine;
    out[l.code] = { ...meta, ...now, ...(machine ? { machine: true } : {}) };
  }
  return out;
}
