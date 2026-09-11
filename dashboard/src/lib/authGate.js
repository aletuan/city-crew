// The decisions behind the login gate, kept away from React and JSX so they
// can be read — and tested with plain `node --test`, no jsdom, no component
// library — as plain functions over plain state. Same doctrine as
// contributors.js and reports.js: auth.jsx renders off these, it does not
// decide anything itself.

/** Where an emailed link should land: exactly where this app is served, so
 *  it works on the Pages subpath and on localhost alike. Must be
 *  allow-listed under Auth → URL Configuration, or the mail arrives and the
 *  link returns you to this screen having done nothing. */
export const buildRedirectTo = (origin, pathname) => origin + pathname;

/**
 * The gate decision itself, as a pure function of state — the "two gates,
 * not one" auth.jsx's header describes: a session gets you past the first,
 * `public.is_editor()` the second, because the desk is for admins and
 * everyone else who holds an account holds it for the mobile app.
 *
 * Order is the policy, not an accident:
 * - `recovering` is checked before the editor lookup on purpose. Someone
 *   resetting a password should be able to finish doing so whether or not
 *   they curate anything — but only once signed in; a recovery flag with no
 *   session is not a state the app can be in, and reads as signed-out.
 * - An editor check that has not answered yet (`undefined`) blocks the same
 *   as a negative one. A pending check is not a pass.
 */
export function resolveAuthView({ session, editor, recovering }) {
  if (session === undefined) return 'loading';
  if (!session) return 'signed-out';
  if (recovering) return 'recovering';
  if (editor === undefined) return 'checking-editor';
  if (!editor) return 'not-editor';
  return 'authorized';
}
