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

// ── the first language, before anybody chooses one ──
//
// Until 21 Oct 2026 every first launch was in English, whatever the phone
// was set to, and a Vietnamese or Japanese reader had to find the switch
// in Profile before the app spoke to them. Now the first launch speaks
// the phone's language when the app has it; a choice made in Profile
// still wins over it, and is the only thing ever stored.
//
// Chinese is the case that needed thought. `zh` is Simplified, and
// Simplified is not what a reader in Taiwan, Hong Kong or Macau writes:
// handing it to them unasked reads as a statement about where they live,
// not as a convenience. So a Traditional tag is a language the app does
// not speak yet, and the walk moves on to the next one the reader listed
// — English, for most — rather than to the nearest script. A reader who
// wants Simplified can still pick it; the app does not pick it for them.
// When Traditional exists it is one more branch here.

/** Regions whose Chinese is written in Traditional characters when a tag
 *  names no script: `zh-TW` is Traditional though it never says so. */
const TRADITIONAL = new Set(['tw', 'hk', 'mo']);

/**
 * The language to open in for a reader whose device lists `tags`, most
 * preferred first — the first one the app speaks, else English.
 *
 * Tags arrive in two spellings: iOS writes BCP 47 (`zh-Hant-TW`), Android
 * writes Java's `Locale.toString()` (`zh_TW_#Hant`). Both are read.
 */
export function langFromLocales(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const [base, ...rest] = tag.toLowerCase().replace(/[_#]+/g, '-').split('-');
    if (base === 'en' || base === 'vi' || base === 'ja') return base;
    if (base !== 'zh') continue;
    const script = rest.find((p) => p === 'hans' || p === 'hant');
    const traditional = script ? script === 'hant' : rest.some((p) => TRADITIONAL.has(p));
    if (!traditional) return 'zh';
  }
  return 'en';
}
