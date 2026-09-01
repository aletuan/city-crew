// Supabase's auth failures, named.
//
// `lib/auth` used to rethrow `error.message` and nothing else, which put
// "Invalid login credentials" on a screen the reader had set to Vietnamese
// — and threw away `error.code`, the one field that says *which* failure
// this is without reading English prose. This turns the code into a name
// the screens can translate, exactly as `asFail` in `lib/auth` already
// does for Postgres constraint violations.
//
// WHAT IS DELIBERATELY NOT HERE. Anything unrecognised comes back `null`,
// and the screen shows the server's own words. "Invalid login credentials"
// and "Email not confirmed" are different problems, and a layer that
// flattened every unknown into one friendly sentence would leave the
// second person waiting for an email they already have — the rule
// `SignInScreen.ui.test.tsx` was written to hold. Naming a failure is a
// decision to make one at a time, not a net to catch everything in.
//
// No imports, so it runs in a plain Node test — see `place.ts` for why
// that boundary exists.

export type AuthFail =
  | 'credentials'
  | 'unconfirmed'
  | 'email_taken'
  | 'weak_password'
  | 'bad_code'
  | 'rate_limit'
  | 'bad_email'
  | 'same_password'
  | 'bad_input'
  | 'offline';

/**
 * GoTrue's error codes, as far as these three forms can reach them.
 *
 * The codes rather than the messages: a message is prose the server is
 * free to reword between releases, and matching on it means a silent
 * regression the first time somebody there fixes a typo. See
 * `@supabase/auth-js/dist/module/lib/error-codes.d.ts` for the full set.
 *
 * `validation_failed` is the code for a request body the server would not
 * accept. It was left out at first on the grounds that it covers a bad
 * address and a missing password alike, so any sentence naming a field
 * would name the wrong one some of the time — and being wrong in
 * Vietnamese is worse than being right in English.
 *
 * What that argument missed is what the server actually says under it.
 * Submitting the sign-in form empty put "missing email or phone" in front
 * of the reader, and the recovery form "Password recovery requires an
 * email": lower-case, English, and naming a `phone` this app does not
 * have. So it is mapped, to a sentence that names no field at all. The
 * fields those two cases are really about are now checked before anything
 * is sent (see `FormFail` in `components/authUi`), which is both faster
 * and the only way that message could have been in the reader's language.
 */
const BY_CODE: Record<string, AuthFail> = {
  invalid_credentials: 'credentials',
  email_not_confirmed: 'unconfirmed',
  // Two codes, one fact: `user_already_exists` is sign-up finding the
  // address taken, `email_exists` is an account trying to move to one.
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  weak_password: 'weak_password',
  otp_expired: 'bad_code',
  // The general limiter and the mail-specific one. Both reach these
  // screens: the first from repeated sign-in attempts, the second from
  // the resend button on password recovery.
  over_request_rate_limit: 'rate_limit',
  over_email_send_rate_limit: 'rate_limit',
  email_address_invalid: 'bad_email',
  validation_failed: 'bad_input',
  same_password: 'same_password',
};

/**
 * A failed request, as opposed to a refused one.
 *
 * The one case that has to be read off the message: auth-js raises these
 * as `AuthRetryableFetchError`, which passes `undefined` for the code
 * (see its constructor), so there is nothing else to look at. The wording
 * belongs to whichever fetch threw — React Native says "Network request
 * failed", the web build used for quick checks says "Failed to fetch",
 * and Firefox says "NetworkError" — so all three are here rather than
 * only the platform this ships on.
 */
const OFFLINE = /network request failed|failed to fetch|networkerror/i;

/**
 * The failure behind a Supabase auth error, or null if it has no name yet.
 *
 * Takes the two fields rather than the error object, which is what keeps
 * this module import-free and testable without a client.
 */
export function authFail(code: string | undefined, message: string): AuthFail | null {
  // A code that arrived is the answer, including when the answer is that
  // this failure has no name here. Falling through to the message in that
  // case would let a refusal that happens to mention a network read as
  // one — the two are different things to tell somebody.
  if (code) return BY_CODE[code] ?? null;
  return OFFLINE.test(message) ? 'offline' : null;
}

/**
 * A `signUp` that "succeeded" into an address that already has an account.
 *
 * With email confirmation on, GoTrue does not answer `user_already_exists`
 * for a registered address — it returns a fabricated user with an empty
 * identities list and sends no mail, so that the sign-up form cannot be
 * used to enumerate accounts. The reference manual says only that an
 * error "may" try to hide this; the empty-identities shape is how the
 * hiding actually looks, and it is read here in one place so the day it
 * changes there is one place to change.
 *
 * Reading it does not undo the protection: `identities` sits in the HTTP
 * response either way, so anyone probing can read it directly. The only
 * person the obfuscation fools is the real reader, sent to a code screen
 * to wait for a mail that was never sent.
 *
 * `Array.isArray` rather than `?.length === 0`: `identities` is optional,
 * and a response without it must read as "unknown", never as "taken" —
 * wrong towards missing a duplicate, not towards refusing a real
 * sign-up.
 */
export function obfuscatedSignUp(identities: unknown): boolean {
  return Array.isArray(identities) && identities.length === 0;
}

/**
 * Failures the reader fixes by editing a field on the sign-up form.
 *
 * A taken address, a malformed one, a password the server refused — each
 * is about something typed on the form step, and since the account moved
 * to the end of the taste step the request fires one screen after those
 * fields. An error shown where nothing can be edited is an instruction
 * to guess; these are the ones worth walking the reader back for.
 *
 * `rate_limit` and `offline` stay off the list on purpose: nothing on
 * the form fixes either, so bouncing would move the reader away from
 * the button they need to press again.
 */
export function fixedOnForm(fail: string): boolean {
  return fail === 'email_taken' || fail === 'bad_email'
    || fail === 'weak_password' || fail === 'bad_input';
}

/**
 * A server's sentence, started like a sentence.
 *
 * GoTrue is inconsistent about this — "Password recovery requires an
 * email" beside "missing email or phone" — and a lower-case line inside a
 * banner reads as something that leaked rather than something written.
 * Only the first letter is touched: the rest of the string is the
 * server's, and words like `AuthApiError` or a quoted column name are
 * meant to be as they are.
 *
 * It applies to the pass-through path alone. Every sentence this app
 * writes for itself is already a sentence.
 */
export function sentenceCase(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}
