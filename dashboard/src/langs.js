// The languages the catalog is written in, in one place.
//
// Every localized column in `places` follows one rule — `<field>_<lang>` —
// and until 13 Oct 2026 the desk spelled that rule out by hand three
// times: `FORM_FIELDS` in the editor, `EDITABLE` in `api.js`, and a
// `BilingualField` that rendered EN and VI and nothing else. The third
// language had been in the table since 8 Aug 2026 (migration
// `20260808120000_japanese_content_columns`), and because none of the
// three lists mentioned it, the desk could neither show nor save a
// Japanese blurb: 110 published places carried an English blurb and no
// Japanese one, and the only way to write one was a SQL update.
//
// So the rule lives here and the lists are derived. Adding a language is
// one row below — the editor grows a column, the save path accepts it,
// nothing else in `dashboard/` changes. The database column still has to
// exist; that is a migration, not this file's concern.
//
// The order is the order the editor shows them: English first, because
// it is the fallback every reader gets when their own slot is empty.

export const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'vi', label: 'VI' },
  { code: 'ja', label: 'JA' },
];

/** The base names of the columns that exist once per language. */
export const LOCALIZED_FIELDS = ['name', 'desc', 'neighborhood'];

/** `name_en, name_vi, … neighborhood_ja` — every localized column, field-major. */
export const localizedColumns = (fields = LOCALIZED_FIELDS) =>
  fields.flatMap((field) => LANGS.map((l) => `${field}_${l.code}`));
