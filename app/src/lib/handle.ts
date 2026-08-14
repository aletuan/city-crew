// Handle rules, as the app should apply them before asking the server.
//
// These mirror the database's own constraint rather than replacing it.
// The client holds a publishable key and reaches PostgREST directly, so
// anything enforced only here is enforced nowhere — see the check on
// `profiles.handle`. What this buys is a legible message before a round
// trip, not safety.
//
// No imports, so it runs in a plain Node test.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/** Everything the database will accept, and nothing else. */
const SHAPE = /^[a-z0-9_]{3,20}$/;

/** Lower case, trimmed, and with the leading @ people type out of habit. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export type HandleProblem = 'empty' | 'short' | 'long' | 'chars' | null;

/**
 * What is wrong with a handle, or null if nothing is.
 *
 * Separate reasons rather than one boolean: "3–20 characters, letters,
 * numbers and underscores" is a rule to decode, where "too short" is an
 * instruction to follow.
 */
export function handleProblem(input: string): HandleProblem {
  const h = normalizeHandle(input);
  if (!h) return 'empty';
  if (h.length < HANDLE_MIN) return 'short';
  if (h.length > HANDLE_MAX) return 'long';
  if (!SHAPE.test(h)) return 'chars';
  return null;
}

/**
 * A first guess at a handle, from the name someone just typed.
 *
 * From the name and never from the email: an address turned into a
 * handle publishes the half of it in front of the @, which the person
 * accepting the suggestion is unlikely to have thought about.
 *
 * Returns '' when nothing usable survives — a name in Vietnamese script
 * with the diacritics stripped is fine, one in Japanese leaves nothing,
 * and an empty box beats a handle of underscores.
 */
export function suggestHandle(name: string): string {
  const ascii = name
    .normalize('NFD')
    // The combining marks NFD just split off. Escaped rather than typed:
    // a range written as literal combining characters is invisible in a
    // diff and one keystroke from being wrong.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd');
  const h = normalizeHandle(ascii).replace(/[^a-z0-9]/g, '');
  return h.length >= HANDLE_MIN ? h.slice(0, HANDLE_MAX) : '';
}
