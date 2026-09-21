// The one word of somebody's name you greet them by.
//
// ── which word, and why it is the last one ──
//
// A Vietnamese name runs family, middle, given — Lê Tuấn Anh is Lê for a
// family and Anh for a person — and Vietnamese addresses people by the
// *given* name, which is the last word. "Chào Anh". Never the family
// name on its own: "Chào Lê" is not cold so much as wrong, the way "Hi
// Smith" is wrong in English.
//
// Which is the whole reason this is a function and not an inline
// `split(' ')[1]`. Asked for "the last name" the English way you get the
// family name, and in Vietnamese that is the first word and the one you
// must not use. The last word is the given name in Vietnamese and the
// given name is also what English greets with, so one rule reads
// naturally in both: Trang stays Trang whether the app is in English or
// not.
//
// Japanese would properly take the family name and a さん, which for a
// name written in this order would be the first word — but the profiles
// this greets are Vietnamese, and a foreign given name with さん is
// ordinary and polite. So the same last word there too.
//
// ── and what makes a word unusable ──
//
// Of the 34 profiles at the time of writing, 12 are a single word (which
// is then both names at once and fine), 3 have a lowercase last word,
// and one does not begin with a letter at all. The first two this can
// fix; the third it cannot, and a card that opens "Chào 2024," is worse
// than one that opens "Chào bạn," — so that one gets null and the panel
// falls back to greeting a stranger.
//
// The longest last word in the catalog is nine characters, which is what
// lets the greeting sit on the one line the panel's title has.

/**
 * The name to greet somebody by, or `null` when there is none worth
 * using. Capitalised at the front and otherwise left exactly as typed:
 * somebody who writes their name in lower case has still written their
 * name, and a greeting is not the place to argue about it.
 */
export function greetingName(fullName: string | null | undefined): string | null {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  // `Array.from`, not `[0]`: a name can begin with a character outside the
  // basic plane, and half a surrogate pair is not a letter in any script.
  const [head, ...rest] = Array.from(last);
  // Anything that does not start with a letter is not a name this can
  // greet — a handle, a year, an emoji. Better a stranger than a wrong
  // guess with somebody's name in it.
  if (head.toLowerCase() === head.toUpperCase()) return null;
  return head.toUpperCase() + rest.join('');
}
