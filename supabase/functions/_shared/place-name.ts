// Google's display name, made fit for a catalog.
//
// `importPlace` used to write `displayName.text` straight into `name_en`
// and `name_vi`. Google writes that string for a pin on a map, where it is
// invisible until you tap it. City Crew shows it in a vertical list, where
// it is the row. The audit of the week of 13–18 Sep 2026 found 21 names in
// 105 imports that read badly for that reason — see
// `docs/place-naming.md`, which this module implements the mechanical half
// of.
//
// ── what is here, and what deliberately is not ──
//
// Three of the six rules in that doc are decidable from the string alone:
// a ® is always noise, "- Open 24h" is always a column that already
// exists, and Hangul in `name_en` is always unreadable to the reader
// `name_en` is for. Those run here, on every import.
//
// The other three are not, and guessing at them mechanically would do
// damage:
//
// - **Title Case.** Half this catalog is Vietnamese, and Vietnamese shop
//   names are often phrases that take sentence case: `Em có cafe`,
//   `Gạt tàn đời`, `TRỐN để dừng chân`. Title-casing every word turns
//   those into something nobody writes. So this only lifts the first
//   letter when a name opens lower-case — strictly an improvement, never
//   a judgement.
// - **Branch suffixes.** `— Thạnh Mỹ Tây` is right only when a second
//   branch is in the catalog, which is a fact about the catalog, not
//   about the name.
// - **Taglines.** Cutting `- Make dreams taste real` needs someone to see
//   that it is a slogan and not half the shop's name.
//
// Those three stay with the desk. Every mobile import lands `pending` and
// unpublished anyway, so there is a reviewer on the path already; this
// module's job is to stop wasting their attention on the mechanical three.
//
// Plain TypeScript, no imports, no Deno APIs, for the same reason
// `ward.ts` and `classify.ts` are: this runs in an Edge Function and is
// tested from `app/src/lib/placeName.test.ts`.

/** Trademark and service-mark symbols. Always noise in a name. */
const MARKS = /[®™©℠]/g;

/**
 * Script blocks `name_en` has no reader for.
 *
 * Hangul, kana, and Han. Not a judgement about the languages — a Japanese
 * reader is served by `name_ja`, which is where the kana goes. It is that
 * `name_en` is the column the English list renders, and a token in a
 * script that column's reader cannot read is a token that only breaks the
 * row and the A–Z sort.
 *
 * Vietnamese is Latin with marks and is untouched by all of this.
 */
const FOREIGN = /[ᄀ-ᇿ㄰-㆏가-힯぀-ゟ゠-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿]/;

/** Kana. What separates a Japanese sign from a Chinese one — Han alone
 *  could be either, kana could only be Japanese. */
const KANA = /[぀-ゟ゠-ヿㇰ-ㇿ]/;

/**
 * Suffixes that repeat a column the row already has.
 *
 * Matched against a whole trailing segment, never against the middle of a
 * name: `Coffee 24/24` in Bình Thạnh is a shop called that, while
 * `Cà Zone - Nguyễn Gia Trí - Open 24h` is a shop with its hours stapled
 * on. The separator is what tells them apart, so it is required.
 *
 * `opening_hours` carries the real answer in both cases.
 */
const OPERATIONAL = [
  /^open\s*24\s*\/?\s*7?h?$/i,
  /^open\s*24\s*\/\s*24$/i,
  /^24\s*\/\s*24h?$/i,
  /^24h$/i,
  /^mở\s*cửa\s*24.*$/i,
  /^opening\s*hours?.*$/i,
  /^giờ\s*mở\s*cửa.*$/i,
];

/** The separators Google puts between a name and whatever it appended. */
const SEPARATOR = /\s+[-–—]\s+/;

const isForeign = (token: string) => FOREIGN.test(token);

/**
 * Lift the first letter when the name opens lower-case.
 *
 * `toUpperCase` rather than a character map: `đ` → `Đ` and `ă` → `Ă` are
 * both in Unicode's own casing table, so Vietnamese needs nothing special
 * here. A name that already opens with a capital, a digit, or a quote is
 * returned untouched.
 */
const liftFirst = (s: string) => {
  const first = s.slice(0, 1);
  return first.toLowerCase() === first && first.toUpperCase() !== first
    ? first.toUpperCase() + s.slice(1)
    : s;
};

export type CleanName = {
  /** What to write to `name_en` and `name_vi`. */
  name: string;
  /** The Japanese the name carried, when it carried any — `name_ja`.
   *  Null when nothing was dropped, or when what was dropped had no kana
   *  in it and so could as easily be Chinese. */
  ja: string | null;
};

/**
 * Google's display name → what the catalog should show.
 *
 * Never returns an empty name: a name that is *entirely* in another script
 * is left exactly as Google gave it, because a blank row is worse than an
 * unreadable one and the desk can still see what it is.
 */
export function cleanName(raw: string): CleanName {
  const input = (raw ?? "").replace(MARKS, " ").replace(/\s+/g, " ").trim();
  if (!input) return { name: "", ja: null };

  const segments = input.split(SEPARATOR).map((s) => s.trim()).filter(Boolean);

  const kept: string[] = [];
  const dropped: string[] = [];
  for (const segment of segments) {
    const words = segment.split(/\s+/);
    const latin = words.filter((w) => !isForeign(w));
    const foreign = words.filter(isForeign);
    if (foreign.length) dropped.push(foreign.join(" "));
    if (latin.length) kept.push(latin.join(" "));
  }

  // Everything was in another script. Keep the original rather than
  // inventing a name, and claim nothing about `name_ja`.
  if (!kept.length) return { name: input, ja: null };

  // The operational suffix goes only from the end, and only one: a name is
  // not a stack of them, and cutting from the middle would eat a shop
  // called `Coffee 24/24`.
  if (kept.length > 1 && OPERATIONAL.some((re) => re.test(kept[kept.length - 1]))) {
    kept.pop();
  }

  const ja = dropped.length && dropped.some((d) => KANA.test(d))
    ? dropped.join(" - ")
    : null;

  return { name: liftFirst(kept.join(" - ")), ja };
}
