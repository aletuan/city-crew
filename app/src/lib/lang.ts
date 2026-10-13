// The languages the app speaks, and the order a reader falls back in —
// without the provider. `i18n.tsx` is React and AsyncStorage; `search`,
// `deadend` and `localized` are pure modules that Node and the tests
// run with neither, and they need exactly these two things from it.

export type Lang = 'en' | 'vi' | 'ja';

type Str = string | null | undefined;

/**
 * Which of the three variants a reader of `lang` is handed, or null when
 * every slot is empty. The fallback order, written once: Vietnamese
 * falls to English; Japanese falls to English, then Vietnamese; English
 * falls to Vietnamese. `t` is this plus a lookup, so the two cannot drift.
 *
 * Null, not undefined, is "nothing" here — an empty string is a written
 * (if empty) value, exactly as `t`'s `??` has always treated it.
 */
export function spokenIn(lang: Lang, en: Str, vi: Str, ja?: Str): Lang | null {
  const order: [Lang, Str][] = lang === 'vi'
    ? [['vi', vi], ['en', en]]
    : lang === 'ja'
      ? [['ja', ja], ['en', en], ['vi', vi]]
      : [['en', en], ['vi', vi]];
  const hit = order.find(([, s]) => s != null);
  return hit ? hit[0] : null;
}
