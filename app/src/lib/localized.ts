// Where a localized value is read from, for any row the app shows.
//
// A place's name, blurb and district exist once per language. English
// and Vietnamese are columns (`name_en`, `name_vi`); every language after
// them lives in the row's `i18n` object, keyed by language then field
// (`i18n.ja.name`) — see migration `20261013150000_place_i18n`. Until 13
// Oct 2026 the app spelled the three out at every read:
//
//   t(place.name_en, place.name_vi, place.name_ja)
//
// sixty times, in thirty files, and a fourth language would have been
// sixty edits and a fourth positional argument nobody could read. This is
// that line, once: the object first, then the column of the same name,
// then the provider's own fallback order (`spokenIn`). Collections and
// cities still keep their Japanese in columns and have no object yet;
// they go through the same door, which is why the column is consulted at
// all — and why, when they do get an object, nothing here changes.
//
// Not on the provider. `useI18n()` already hands out `lang`, and a
// function of a row and a language is testable with neither React nor a
// provider under it; fifty-nine screen tests stub the provider with
// `{ lang, t }` and would each have needed a fourth key.

import { type Lang, spokenIn } from './lang';

type Str = string | null | undefined;

/** One language's entry in a row's `i18n` object: the localized fields,
 *  plus `machine` on text a model wrote that nobody has edited since. */
export type I18nEntry = { [field: string]: Str | boolean; machine?: boolean };

/** The whole object: `{ ja: { desc: '…' }, ko: { … } }`. */
export type I18nDoc = Partial<Record<string, I18nEntry | null>>;

/** Any row with localized fields: `<field>_en`, `<field>_vi`, maybe
 *  `<field>_ja`, maybe `i18n`. Structural, so a city and a collection
 *  qualify as readily as a place. */
export type LocalizedRow = { i18n?: I18nDoc | null } & Record<string, unknown>;

/** The row's own value for one field in one language, or null: the
 *  object's entry when there is one, else the column of that name. An
 *  empty string is "nothing" through either door — the desk clears a
 *  field by emptying it, and the trigger drops the key for the same. */
export function slot(row: LocalizedRow, field: string, lang: Lang): string | null {
  const entry = row.i18n?.[lang];
  const fromObject = entry?.[field];
  if (typeof fromObject === 'string' && fromObject.trim()) return fromObject;
  const fromColumn = row[`${field}_${lang}`];
  if (typeof fromColumn === 'string' && fromColumn.trim()) return fromColumn;
  return null;
}

/** Which language the reader will be handed for this field, or null when
 *  every slot is empty — `spokenIn` over the row's slots. */
export function localizedLang(row: LocalizedRow, field: string, lang: Lang): Lang | null {
  return spokenIn(lang, slot(row, field, 'en'), slot(row, field, 'vi'), slot(row, field, 'ja'));
}

/** The value to print: the reader's own language, else the provider's
 *  fallback order, else an empty string — exactly what `t` would have
 *  returned for the three columns. */
export function localized(row: LocalizedRow, field: string, lang: Lang): string {
  const spoken = localizedLang(row, field, lang);
  // `spokenIn` only names a slot it saw text in, so the cast is the
  // whole of the proof — a `?? ''` here would be a branch nothing reaches.
  return spoken ? (slot(row, field, spoken) as string) : '';
}

/** Every localized string the row holds for one field, in any language —
 *  what a search haystack wants, which is all of them at once. */
export function allLocalized(row: LocalizedRow, field: string): string[] {
  const out: string[] = [];
  for (const key of Object.keys(row)) {
    if (key.startsWith(`${field}_`) && key.length === field.length + 3) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) out.push(v);
    }
  }
  for (const entry of Object.values(row.i18n ?? {})) {
    const v = entry?.[field];
    if (typeof v === 'string' && v.trim()) out.push(v);
  }
  return out;
}
