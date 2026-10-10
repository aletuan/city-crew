// What a guest was doing when an account was asked of them.
//
// ── the bug this closes ──
//
// A guest taps a bookmark on a place. The sign-in sheet rises with the
// bookmark in its title, they press Sign in, and `goTo` carries them to
// the Profile tab's form. They sign in, `leaveAuth` lands them on Profile
// home — and that is the end of it. The place was never saved, the tab
// they came from is two taps away, and nothing on screen says either.
// The reader who just made an account to keep a place is the one reader
// the app most needs to finish for.
//
// `sessionNav` already keeps a guest's routes through a sign-in, so the
// place screen is still there under the Places tab. What was missing is
// the memory of *which* tab, and of the act itself.
//
// ── the rule ──
//
// One pending act at a time — the last sheet raised is the one the reader
// answered. It is taken (and so forgotten) by the screen that finishes
// signing in, never by the session appearing: a new account has a session
// before its welcome step, and resuming on the session would pull the
// reader off the page that greets them.
//
// Fifteen minutes, then it is dropped: long enough for a sign-up whose
// code arrives by email, short enough that a bookmark from the morning
// does not open a sheet in the afternoon.
//
// Not every act is re-run. One that writes on a toggle — a heart — is not:
// the new account's likes may not have landed, and "toggle" against an
// unknown starting point can unlike what the reader already liked. Those
// callers leave `run` out and the reader is only taken back to where they
// were, one tap from finishing.
//
// No imports, so a Node test reaches every line.

/** How long a pending act stays worth resuming. */
export const RESUME_TTL_MS = 15 * 60 * 1000;

export type Resume = {
  /** The tab the reader was on when asked, or null when unknown. */
  tab: string | null;
  /** The act to finish, when finishing it is safe to do unasked. */
  run?: () => void;
  /** When it was asked. */
  at: number;
};

let pending: Resume | null = null;

/** Remember this act, replacing any earlier one. */
export function holdResume(r: Resume): void {
  pending = r;
}

/** Forget it: the reader said "not now". */
export function dropResume(): void {
  pending = null;
}

/**
 * The pending act if it is still fresh, forgotten either way.
 *
 * A stamp from the future is refused, as `unpackCache` refuses one: a
 * clock that has moved backwards cannot say how old the act is.
 */
export function takeResume(now: number, ttl: number = RESUME_TTL_MS): Resume | null {
  const r = pending;
  pending = null;
  if (!r || r.at > now || now - r.at > ttl) return null;
  return r;
}

/**
 * The focused tab in a root navigation state, or null.
 *
 * Structural, so this file needs nothing from React Navigation.
 */
export function focusedTab(
  root: { index?: number; routes: readonly { name: string }[] } | undefined,
): string | null {
  if (!root) return null;
  return root.routes[root.index ?? 0]?.name ?? null;
}

/**
 * Where to take the reader back to, or null for nowhere.
 *
 * Profile is nowhere: it is where the sign-in form lives, and `leaveAuth`
 * has already put the reader on its root.
 */
export function returnTab(r: Resume): string | null {
  return r.tab && r.tab !== 'Profile' ? r.tab : null;
}
