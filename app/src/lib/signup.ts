// Whether signing up will end with an emailed code — asked up front, so
// the progress bar can promise the right number of steps.
//
// The flow itself never needs this: `signUp` reveals the answer in its
// own response (`needsConfirm`), and the confirm screen appears exactly
// when it must. What cannot wait for that is the bar at the top of the
// form. It used to promise three marks unconditionally, on the grounds
// that the setting is only known once `signUp` has run — and with email
// confirmation switched off, which is this project's configuration
// today, that promised every single reader one more step than existed.
//
// GoTrue publishes the answer before any account is touched:
// `GET /auth/v1/settings` with the anon key returns, among other things,
// `mailer_autoconfirm` — true when the server confirms addresses by
// itself, which is precisely "no code screen". One small read at the
// moment the sign-up screen opens is what lets the bar tell the truth
// from its first frame.

import { supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * The settings body, read for one field and nothing else.
 *
 * Strict about the shape: only an actual boolean counts, and anything
 * else — the field missing, a string, a reshaped response after a GoTrue
 * release — is `null`, "unknown". The bar treats unknown as its default,
 * so a surprise here costs a promise that is at worst as wrong as the
 * static bar used to be, never wronger. Note the flip: `autoconfirm` is
 * the server saying it needs nothing, so `true` here means *no* code.
 */
export function parseNeedsConfirm(body: unknown): boolean | null {
  const v = (body as { mailer_autoconfirm?: unknown } | null | undefined)?.mailer_autoconfirm;
  return typeof v === 'boolean' ? !v : null;
}

/**
 * How many marks the sign-up bar should promise.
 *
 * Two is the default and the fallback: the form and the taste, the steps
 * that exist in every configuration. Only a definite "a code will be
 * asked for" earns the third mark up front — `null` must not, because a
 * bar that grows late (the confirm screen forces three when it actually
 * appears) merely corrects itself, while a bar that promised a step
 * nobody reaches has lied to everyone.
 */
export function signUpTotal(needsConfirm: boolean | null): 2 | 3 {
  return needsConfirm === true ? 3 : 2;
}

/**
 * Ask the server, best-effort. Every failure — offline, a refused
 * request, a body that is not JSON, a body that is not the expected
 * shape — is the same answer: "unknown", never a throw. A progress bar
 * is not worth an error path.
 */
export async function fetchSignUpNeedsConfirm(): Promise<boolean | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return null;
    return parseNeedsConfirm(await res.json());
  } catch {
    return null;
  }
}
