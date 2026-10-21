// The languages the app speaks, and the order a reader falls back in —
// without the provider. `i18n.tsx` is React and AsyncStorage; `search`,
// `deadend` and `localized` are pure modules that Node and the tests
// run with neither, and they need exactly these two things from it.

// Simplified Chinese joined on 21 Oct 2026, as the plumbing first: the
// language can be chosen, dates and durations are written its way, and
// every string not yet translated falls back to English, so a screen is
// never blank while the translation catches up. `zh` is Simplified; a
// Traditional script would be its own code.
export type Lang = 'en' | 'vi' | 'ja' | 'zh';

type Str = string | null | undefined;

/**
 * Which variant a reader of `lang` is handed, or null when every slot is
 * empty. The fallback order, written once: Vietnamese falls to English;
 * Japanese and Chinese fall to English, then Vietnamese; English falls to
 * Vietnamese. `t` is this plus a lookup, so the two cannot drift.
 *
 * Chinese falls to English and not to Japanese, though the scripts share
 * characters: a Japanese sentence is not readable Chinese, and English is
 * the language a Chinese visitor to Việt Nam is likeliest to read.
 *
 * Null, not undefined, is "nothing" here — an empty string is a written
 * (if empty) value, exactly as `t`'s `??` has always treated it.
 */
export function spokenIn(lang: Lang, en: Str, vi: Str, ja?: Str, zh?: Str): Lang | null {
  const order: [Lang, Str][] = lang === 'vi'
    ? [['vi', vi], ['en', en]]
    : lang === 'ja'
      ? [['ja', ja], ['en', en], ['vi', vi]]
      : lang === 'zh'
        ? [['zh', zh], ['en', en], ['vi', vi]]
        : [['en', en], ['vi', vi]];
  const hit = order.find(([, s]) => s != null);
  return hit ? hit[0] : null;
}
