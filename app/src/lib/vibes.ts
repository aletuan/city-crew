// Vibe taxonomy — the soft, n-to-n signals a place carries ("quiet",
// "kid_friendly"), as opposed to the hard `category` axis.
//
// One source of truth for how a vibe presents itself: its glyph and its
// label in each language. Screens read from here rather than keeping
// their own maps.
//
// ── no colour, since 15 Oct 2026 ──
//
// The app draws a tag in one of three ways, and which one says what kind
// of tag it is (owner's ruling, 15 Oct 2026): a category wears its own
// hue, a judgement about a place wears a neutral glyph, and free words
// wear nothing but themselves. A vibe that says something the category
// does not is a judgement, so it has no colour to give.
//
// The palette that used to live here gave each vibe a dot, and the seven
// that restate a category (`restatesCategory`) a dot in exactly that
// category's hue. Measured that day on the live catalog: 1,152 of 1,350
// vibe tags sat on a place already carrying the category they restate
// (493 of 495 `cafes`). So the card's dot was a category dot reached by
// a second road, and the detail screen, which drew vibes without one,
// said "Cà phê" twice in two styles — glyph in its hue on the cover,
// grey chip below. The rule ends both: the card's pill reads the
// category, and the four judgements reached the detail screen alone —
// until later that day, when the owner took them off it too (123 of 976
// places carry one, so a missing "Quiet" read as a verdict it was not).
// They are the planner's now (`COMPANY_LEAN`), which is what they were
// added for; nothing in the app draws a vibe.

import type Ionicons from '@expo/vector-icons/Ionicons';

export type VibeStyle = {
  icon: keyof typeof Ionicons.glyphMap;
  en: string;
  vi: string;
  ja: string;
};

export const VIBES: Record<string, VibeStyle> = {
  cafes: { icon: 'cafe-outline', en: 'Cafés', vi: 'Cà phê', ja: 'カフェ' },
  food_tour: { icon: 'restaurant-outline', en: 'Food', vi: 'Ăn uống', ja: 'グルメ' },
  nightlife: { icon: 'wine-outline', en: 'Nightlife', vi: 'Về đêm', ja: 'ナイトライフ' },
  views: { icon: 'business-outline', en: 'Views', vi: 'Ngắm cảnh', ja: '眺望' },
  culture: { icon: 'library-outline', en: 'Culture', vi: 'Văn hóa', ja: 'カルチャー' },
  outdoors: { icon: 'leaf-outline', en: 'Nature', vi: 'Thiên nhiên', ja: '自然' },
  chill: { icon: 'happy-outline', en: 'Chill', vi: 'Thư giãn', ja: 'のんびり' },
  shopping: { icon: 'bag-outline', en: 'Shopping', vi: 'Mua sắm', ja: 'ショッピング' },

  // ── suitability, which is what this axis was for ──
  //
  // Measured before these existed: 114 of 198 published places carried
  // vibe_tags fully derivable from their categories by the importer's own
  // mapping, and of the rest, 76 differed only by `chill`. The axis meant
  // to say how a place *feels* was a renamed copy of what it *is* — the
  // one hand-assigned value was the only information on it.
  //
  // These three are the same kind of judgement `chill` is: about a room,
  // not a business type. Google has no type for any of them, `classify`
  // never emits them (asserted in its tests), and only the desk assigns
  // them — which is exactly what made `chill` worth having. Each ships
  // with a consumer already waiting: `COMPANY_LEAN` in the planner reads
  // them, so every tag the desk adds immediately changes somebody's plan.
  //
  // Three, not eight. Every value here is desk work on two hundred rows,
  // and a value nothing consumes is the redundancy this note opens with.
  kid_friendly: { icon: 'balloon-outline', en: 'Kid-friendly', vi: 'Hợp trẻ em', ja: '子連れOK' },
  romantic: { icon: 'heart-outline', en: 'Romantic', vi: 'Lãng mạn', ja: 'ロマンチック' },
  quiet: { icon: 'volume-low-outline', en: 'Quiet', vi: 'Yên tĩnh', ja: '静か' },
};

/**
 * Label for a vibe key. An unknown key is shown as-is rather than dropped —
 * new data stays visible instead of silently disappearing from cards.
 */
export function vibeLabel(key: string, t: (en: string, vi: string, ja?: string) => string): string {
  const v = VIBES[key];
  if (v) return t(v.en, v.vi, v.ja);
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
