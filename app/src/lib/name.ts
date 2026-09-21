// A place's name as a title and a subtitle, out of the one string Google
// hands over.
//
// ── what the one string holds ──
//
// Google's business name is whatever the owner typed into the listing,
// and in this catalog that is a brand with a qualifier hung off it by a
// dash, in 141 of the 484 rows at the time of writing:
//
//     Bold Brew - Cafe & Work Date Huỳnh Thúc Kháng
//     Every Half Coffee Roasters - Đồng Khởi
//     Bao La - Hidden Bar
//     Đệ Nhất Mì Kéo - Quận 2 (Chi nhánh 8)
//
// The qualifier is one of two things — which branch this is, or what
// kind of place it is — and both are the smaller fact. Set in the
// display face at 26pt the whole string ran to three lines on a phone,
// with the brand on the first and the tagline wrapping under it as if it
// were the name. Split, the brand is the title and the qualifier sits
// beneath it in the body face, where a subtitle goes.
//
// ── where the cut is ──
//
// At the first dash with a space on either side: a hyphen, an en dash
// or an em dash, since all three appear. Spaces on both sides is what
// separates a qualifier from a hyphenated word ("Coffee-N-Bagel",
// "27/16" and "99/81" have no spaces and are not touched). One cut, not
// every dash: "Harbour - Rooftop Eatery & Bar" has one qualifier that
// happens to contain an ampersand, and a second dash in it would still
// belong to the qualifier.
//
// Nothing else is inferred. A name with no such dash is the whole title
// and no subtitle — and so is one where the cut would leave the title
// empty, which is a name that starts with a dash rather than a name
// with a qualifier.
//
// Plain TypeScript, tested from `name.test.ts`.

import { fold } from './address';

const SEPARATOR = /\s+[-–—]\s+/;

/**
 * The street word an address abbreviates and a name spells out.
 *
 * "Every Half Coffee Roasters - Phố Chả Cá" stands at "6B P. Chả Cá,
 * Hoàn Kiếm". Both say Chả Cá; only one says *phố*, and a plain
 * containment test therefore missed it and printed the street twice.
 * Google writes the short form in an address and an owner writes the
 * long one in a business name, so the two never meet.
 *
 * Applied to the subtitle before folding, and that order is the whole
 * care in this constant. `fold` strips tone marks, so it turns both
 * "Ngõ" and "Ngô" into `ngo` — and a rule written against the folded
 * text would cut "Ngô Quyền", a person a street is named after, down to
 * "Quyền". Matched with its tone mark intact, `Ngõ` cannot touch it.
 *
 * Quận and Q. are deliberately absent. "Quận 2" reduced to "2" would
 * find a house number in nearly any address.
 */
const STREET_WORD = /^(?:phố|đường|ngõ|ngách|hẻm|p\.|đ\.|ng\.)\s+/i;

export type SplitName = { title: string; subtitle: string | null };

/** The brand before the first spaced dash, and whatever hung off it. */
export function splitName(name: string): SplitName {
  const m = SEPARATOR.exec(name);
  if (!m) return { title: name.trim(), subtitle: null };
  const title = name.slice(0, m.index).trim();
  const subtitle = name.slice(m.index + m[0].length).trim();
  if (!title || !subtitle) return { title: name.trim(), subtitle: null };
  return { title, subtitle };
}

/**
 * The subtitle worth printing under a title that already has the place
 * written out below it — null when the qualifier only says again what
 * the card is about to say anyway.
 *
 * Two ways that happens, and they are not the same test.
 *
 * ── the neighbourhood line ──
 *
 * "Cafe Slow - Thảo Điền" in Thảo Điền would otherwise read
 *
 *     Cafe Slow
 *     Thảo Điền
 *     ⌖ Thảo Điền
 *
 * and the branch name was only ever there to tell this Cafe Slow from
 * another, which the line below it already does. Equality, because a
 * neighbourhood line is one name and the qualifier either is it or is
 * not.
 *
 * ── the address ──
 *
 * The commoner case by far, and the one equality cannot catch. Of the
 * 250 places in the catalog that show a subtitle, 128 have a qualifier
 * that appears *inside* the address the card prints two rows down:
 *
 *     Bold Brew
 *     Huỳnh Thúc Kháng                    ← this
 *     ĐỊA CHỈ
 *     27/16 Ng. 18 Huỳnh Thúc Kháng, Giảng Võ   ← and this
 *
 * So containment, not equality — the street is a fragment of the
 * address, never the whole of it.
 *
 * `address` must be the address **as printed**, which is `shortAddress`'s
 * output and not the raw column: the raw one still carries the city and
 * the country, and matching against text the reader cannot see would
 * drop a subtitle that is doing its job. (It happens not to change the
 * count here — every one of the 128 survives the shortening — but the
 * contract is the printed string, and a future change to `shortAddress`
 * should move this with it rather than silently diverge.)
 *
 * ── the street word ──
 *
 * One more pass, against the subtitle with a leading `Phố`/`Đường`/`Ngõ`
 * removed, because Google abbreviates those in an address and an owner
 * spells them out in a business name. "Phố Chả Cá" against "6B P. Chả
 * Cá, Hoàn Kiếm" is one such row — the only one in the catalog today,
 * found on a phone rather than by this note.
 *
 * Four characters minimum on what is left, which keeps "Phố cổ" whole:
 * "cổ" would match a syllable in half the streets in Hanoi.
 *
 * ── why plain containment is safe enough ──
 *
 * A substring test can fire on a fragment of a longer word. It does not
 * here: run against the catalog, containment and a word-boundary match
 * both drop exactly 128, and the shortest qualifier dropped is six
 * characters. A boundary regex would buy nothing today and would have to
 * define a word boundary for Vietnamese to do it, so this stays the
 * simpler thing with the number written down.
 *
 * The 122 that survive are the qualifiers that carry something the
 * address does not — "Cocktail Bar", "Omurice & Ramen", "Board Games",
 * and the branch names of places whose ward was renamed under them.
 * Sixteen places are subtitled "Thảo Điền"; all sixteen now carry the
 * ward "An Khánh", in the neighbourhood and in the address alike, and
 * "Thảo Điền" is still what the reader calls it. Fifteen keep the
 * qualifier. The sixteenth stands on a street named Thảo Điền, so its
 * address prints the word and the rule drops it — which is right, and
 * is the rule working rather than an exception to it.
 *
 * Everything is compared folded, so "Thao Dien" and "Thảo Điền" agree,
 * and so do "Yên Hoà" and "Yên Hòa" — which is one real row.
 */
export function subtitleBeside(
  split: SplitName,
  neighborhood: string | null | undefined,
  address: string | null | undefined,
): string | null {
  if (!split.subtitle) return null;
  const sub = fold(split.subtitle);
  if (neighborhood && fold(neighborhood) === sub) return null;
  if (!address) return split.subtitle;
  const addr = fold(address);
  if (addr.includes(sub)) return null;
  // And again without the street word, for the mismatch below.
  const bare = split.subtitle.replace(STREET_WORD, '').trim();
  if (bare !== split.subtitle && bare.length >= 4 && addr.includes(fold(bare))) return null;
  return split.subtitle;
}
