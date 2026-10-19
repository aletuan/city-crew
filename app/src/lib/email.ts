// The email address, checked where it is typed.
//
// One real sign-up is the reason this file exists: an address arrived as
// "ngotiennam@ gmail.com" — the iOS keyboard slips a space in after an
// autocomplete — sailed through a form that only checked for emptiness,
// and was refused a step later by the server, with `validation_failed`
// and a banner that named no field on a screen that had none to fix.
//
// No imports, so it runs in a plain Node test — the same boundary
// `authfail.ts` keeps, and for the same reason.

/**
 * The address with every whitespace character removed.
 *
 * Not a trim: the space that actually happens lands *inside* the address,
 * after the `@`, where trimming never reaches. Whitespace is never part
 * of an email address, so stripping it as it is typed makes the mistake
 * impossible instead of making it a message — the field never holds a
 * value the shape check below would have to complain about.
 */
export function cleanEmail(raw: string): string {
  return raw.replace(/\s+/g, '');
}

/**
 * Whether the address is shaped like one: something, an `@`, something,
 * a dot, something.
 *
 * Deliberately loose. The full grammar of addresses is famously not a
 * regex, and a strict pattern here would refuse real people to catch
 * imaginary ones — the server still decides, exactly as it does for the
 * handle. What this catches is only what can never be right: no `@`, two
 * of them, whitespace, a domain with no dot. Wrong towards letting the
 * server answer, never towards blocking a real address.
 */
export function emailShapeOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * The form's error once the address has been edited to `next`: the one
 * the edit actually fixes is cleared, every other stands.
 *
 * - `need_email` goes once there is anything in the field;
 * - `bad_email` goes once the address is shaped like one;
 * - `email_taken` goes on any edit — it was about the address that was
 *   in the field, and that address is no longer there.
 *
 * Sign in kept this rule inline, and Sign up and Forgot password kept
 * none: an error said "enter your email" over a field that held
 * qa@example.com until the button was pressed again (19 Oct 2026). One
 * rule here, for all three forms, so they answer the same way.
 */
export function afterEmailEdit(current: string | null, next: string): string | null {
  if (current === 'need_email' && next !== '') return null;
  if (current === 'bad_email' && emailShapeOk(next)) return null;
  if (current === 'email_taken') return null;
  return current;
}
