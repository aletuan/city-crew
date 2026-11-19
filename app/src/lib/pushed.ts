// Whether a screen sits over another in its own stack — the question a
// back chevron and "close this page" both ask.
//
// ── not `canGoBack()` ──
//
// `canGoBack()` answers for every navigator above the screen too, and the
// bottom tabs keep the default back behaviour, `firstRoute`: from any
// tab but Explore, "back" means "to Explore". So on the first page of
// Plans, Trips, Collections or the last tab, `canGoBack()` is true with
// nothing under the page. Two screens read it as "I was pushed" (19 Nov
// 2026, found by the Maestro suite): the guest's hub, the last tab's
// first page, drew a back chevron that jumped to Explore (it is now told
// it is home by `MeScreen`, which is surer still — see `ProfileScreen`);
// and the error fallback (`ScreenBoundary`) offered "go back to the
// previous screen" on a tab's first page, where back meant another tab.
//
// The stack's own state answers the question asked: its index is where
// this screen stands in it, and 0 is its first page. A page opened from
// another tab with `initial: false` (`toProfileRoom`) stands over the
// tab's first page, at 1, and is pushed — which is true.

/** The one method read: the state of the navigator that holds the screen. */
export type StackReader = { getState?: () => { index?: number } | undefined };

export function isPushed(navigation: StackReader): boolean {
  return (navigation.getState?.()?.index ?? 0) > 0;
}
