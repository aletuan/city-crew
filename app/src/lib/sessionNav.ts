// What the navigation tree should look like the moment an account ends.
//
// ── the bug this closes ──
//
// Every tab is a stack, and a stack keeps its history across everything
// that happens elsewhere in the app — including a sign-out on the Profile
// tab. Nothing reset them. Every provider under the navigators re-keys
// its data by `userId` the instant the session changes, so the *data* was
// right; the *routes* were a day old. Sign out of one account having left
// the Collections tab on one of your private lists, sign into another,
// tap Collections: the detail screen is still there, asks the new
// account's lists for a slug that was never theirs, and draws an empty
// header over "Collection not found". The Trips tab did the same on a
// trip's screen, and a half-edited list form would have saved into a
// list the server rightly refuses.
//
// ── the rule ──
//
// Only an *ending* resets anything: an account signing out, or being
// replaced by another. A guest who signs in is left exactly where they
// were, on purpose — the save sheet sends a guest to the sign-in form
// mid-bookmark, and the whole point of coming back is to finish saving
// the place they were looking at. A guest can only have opened public
// things, so their routes stay valid under any account.
//
// ── the shape ──
//
// A new root state, not a list of actions. One `resetRoot` with the
// pruned tree keeps the selected tab, keeps every route key (so the
// screens that stay are the same mounted components, not fresh ones),
// and — because the reset lands at the root, where no route is removed
// — skips the `beforeRemove` guards. That last point is the reason this
// is not a `popToTop` per stack: `PlanEditScreen`'s guard would have put
// "Discard your changes?" over the Profile tab in the middle of a
// sign-out. A draft dies with the account that was drafting it, which is
// also what a `key={userId}` on the container would have done, except
// that one would also have thrown the reader back to the first tab and
// fired on the guest sign-in above. Bottom tabs' own `popToTopOnBlur`
// was the other way to never see a stale stack, and was rejected for
// what it costs every day: a tab forgetting its place each time you
// glance at another one, when the copy flow deliberately leaves the
// source list in its tab's history.

import type { NavigationState, PartialState } from '@react-navigation/native';

/** A tab's stack as the root state holds it: settled, or still partial
 *  when it was navigated into before it ever mounted (`goTo`). Both have
 *  routes, which is all the cut below reads. */
type Nested = NavigationState | PartialState<NavigationState>;

/**
 * True when a signed-in account has just ended: signed out, or another
 * account took its place.
 *
 * `undefined` is "not known yet" (see `Auth.userId`): before the session
 * is read, the id is last launch's reader, and that reader landing as the
 * session is confirmation, not an ending. Only a *known* different answer
 * — null for a guest, another string for another person — counts.
 */
export function accountEnded(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return typeof prev === 'string' && next !== undefined && next !== prev;
}

/**
 * The same tree with every tab's stack cut back to its first screen.
 *
 * Null when no stack has history, so the caller can skip the reset — a
 * reset with nothing to change still re-renders every navigator. A tab
 * never opened has no `state` and is passed through as it is.
 */
export function stacksToRoot(root: NavigationState): NavigationState | null {
  let changed = false;
  const routes = root.routes.map((tab) => {
    const s: Nested | undefined = tab.state;
    if (!s || s.routes.length <= 1) return tab;
    changed = true;
    // The cut is the same for a settled stack and a partial one; the cast
    // only tells the compiler that spreading a union keeps it a union.
    const cut = { ...s, index: 0, routes: [s.routes[0]] } as Nested;
    return { ...tab, state: cut };
  });
  return changed ? { ...root, routes } : null;
}
