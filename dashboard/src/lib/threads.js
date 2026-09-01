// A venue's Threads handle: what we store, what we show, what we accept.
//
// Stored bare and lowercase — see
// `supabase/migrations/20260901140000_place_threads_handle.sql`. The @ is
// punctuation the renderer adds back, and the host lives in exactly one
// constant so it can move when Meta moves it again.

const HOST = 'https://www.threads.com';

// Instagram's username rule, which Threads inherits: letters, digits, dots,
// underscores, up to thirty. Deliberately not the ^[a-z0-9_]{3,20}$ the app
// enforces on our own profile handles — real venue handles have dots and run
// past twenty, and that regex would reject most of them.
const SHAPE = /^[a-z0-9._]{1,30}$/;

/**
 * Takes whatever an editor has in the clipboard and returns the bare handle.
 *
 * In practice that is a pasted profile URL, because nobody retypes a handle
 * they can copy out of the address bar. Accepts the URL with or without
 * scheme or www, on either host, with or without the @, and a bare handle
 * typed by hand.
 */
export function normalizeThreads(input) {
  let s = String(input ?? '').trim();
  if (!s) return '';
  const fromUrl = s.match(/^(?:https?:\/\/)?(?:www\.)?threads\.(?:net|com)\/@?([^/?#]+)/i);
  if (fromUrl) s = fromUrl[1];
  return s.replace(/^@+/, '').trim().toLowerCase();
}

export const threadsUrl = (handle) => `${HOST}/@${handle}`;

/**
 * Null when the value is fine, otherwise a sentence to put beside the field.
 * Empty is fine: "this venue has no Threads account" is a real answer, and the
 * desk should be able to record it by leaving the box alone.
 */
export function threadsProblem(handle) {
  if (!handle) return null;
  if (handle.length > 30) return 'Too long — Threads handles stop at 30 characters.';
  if (!SHAPE.test(handle)) return 'Only lowercase letters, digits, dots and underscores.';
  return null;
}
