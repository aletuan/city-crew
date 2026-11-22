// Taking the marks off a Vietnamese string, written once (22 Nov 2026).
//
// `search`, `address`, `handle` and `place` each spelled the same three
// steps out for themselves, and had already parted company: two read
// NFKD and one NFD, two wrote the mark range as literal combining
// characters and two escaped it. The steps are the same everywhere; what
// each caller does next — fold dashes, trim, cut a slug — stays with the
// caller, because that part genuinely differs.

/**
 * "Đà Nẵng" → "Da Nang", case kept.
 *
 * NFKD rather than NFD, for the reason `search.fold` gives at length:
 * a business that names itself in mathematical bold (`𝐂𝐫𝐮𝐦𝐛𝐬`) keeps
 * its letters under the compatibility form and loses them under the
 * canonical one, while Vietnamese decomposes identically under both.
 *
 * `đ` and `Đ` get their own rule because they are letters with a stroke,
 * not a base and a mark, and no normalisation form takes them apart.
 *
 * Case is left to the caller: `slugify` has to lower *after* this, since
 * NFKD can hand back a capital that a lowering done first would miss.
 */
export function stripMarks(s: string): string {
  return s
    .normalize('NFKD')
    // Escaped rather than typed: a range written as literal combining
    // characters is invisible in a diff and one keystroke from wrong.
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
