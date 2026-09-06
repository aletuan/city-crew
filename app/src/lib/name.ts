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
 * The subtitle worth printing under a title that already has a place
 * line beneath it — null when the qualifier says the same thing the
 * neighbourhood line is about to say.
 *
 * "Cafe Slow - Thảo Điền" in Thảo Điền would otherwise read
 *
 *     Cafe Slow
 *     Thảo Điền
 *     ⌖ Thảo Điền
 *
 * and the branch name was only ever there to tell this Cafe Slow from
 * another, which the line below it already does. Compared folded, so
 * "Thao Dien" and "Thảo Điền" agree.
 */
export function subtitleBeside(split: SplitName, neighborhood: string | null | undefined): string | null {
  if (!split.subtitle) return null;
  if (neighborhood && fold(neighborhood) === fold(split.subtitle)) return null;
  return split.subtitle;
}
