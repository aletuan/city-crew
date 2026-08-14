// The emailed one-time code, as the app should treat it.
//
// No imports, so this is reachable from a plain Node test — see
// `place.ts` for why that boundary exists.

/**
 * The longest code Supabase will issue.
 *
 * Its OTP length is a project setting, not a constant: the dashboard
 * allows 6 through 10, and the app has no way to read it. Both screens
 * used to assume six, which is the default — this project turned out to
 * be set to eight, so a field capped at six silently swallowed the last
 * two digits and the code came back "expired or invalid". Accepting the
 * whole range costs nothing and cannot be wrong.
 */
export const OTP_MAX = 10;

/**
 * Everything that is not a digit, removed.
 *
 * The email spaces the digits apart for legibility. That spacing is
 * styling rather than characters, so a copy usually comes back clean —
 * but "usually" is doing work there across mail clients, and a code that
 * fails because an invisible space rode along with it is indistinguishable
 * from a wrong code.
 */
export function cleanOtp(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_MAX);
}
