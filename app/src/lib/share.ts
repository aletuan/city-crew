// The system share sheet, and the touch that closes it.
//
// On iOS the share sheet covers the bottom half of the screen, and a tap
// on the dimmed half above it closes it. That tap does not stop at the
// sheet: it carries on into the app underneath. Reported from a phone on
// Profile, where the dimmed half sits over Current city, Language and
// Appearance: closing a share from About City Crew by tapping above it
// opened the language picker, and nobody had asked for it.
//
// So while the sheet is up, and for a moment after it has gone, a shield
// lies over the whole app and takes every touch (`ShareShield`, mounted
// once at the root). The moment after is `SHIELD_GRACE_MS`: the share's
// promise settles when the sheet has finished closing, and the finger
// that closed it may still be lifting.
//
// Every share goes through `shareSafely`. A screen that calls
// `Share.share` itself gets the pass-through back.

import { Share, type ShareContent } from 'react-native';

/**
 * How long the shield stays after the share has settled. The sheet's own
 * close takes about 300ms, and the promise settles at its end; a tap's
 * lift can trail the tap that began it by as much again. 400 covers both
 * and is below what a reader would notice as a dead screen.
 */
export const SHIELD_GRACE_MS = 400;

// A count, not a flag, so two shares in flight cannot lower each other's
// shield.
let raised = 0;
const listeners = new Set<() => void>();
const set = (n: number) => {
  raised = n;
  listeners.forEach((fn) => fn());
};

/** For `useSyncExternalStore`. */
export function subscribeShield(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Whether touches are being held off the app right now. */
export function isShielded(): boolean {
  return raised > 0;
}

/**
 * Open the system share sheet with the shield raised. Resolves when the
 * sheet has settled, however it went. Declined or failed, a share is the
 * reader's business and nothing is said about it.
 */
export function shareSafely(
  content: ShareContent,
  share: (c: ShareContent) => Promise<unknown> = Share.share,
): Promise<void> {
  set(raised + 1);
  return share(content)
    .catch(() => {})
    .then(() => {
      setTimeout(() => set(raised - 1), SHIELD_GRACE_MS);
    });
}
