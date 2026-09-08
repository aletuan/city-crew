// Whether the launch has settled, as a subscription.
//
// "Settled" means one thing: Explore has stopped drawing skeletons and
// committed its content — the hero photograph, the card shelf, the
// weather. That commit is the heaviest moment of a launch, and the one
// the welcome sheet used to rise straight into.
//
// ── why not InteractionManager ──
//
// The sheet waited on `InteractionManager.runAfterInteractions`, which
// its own note described as "the startup burst finishes, then the sheet
// rises on an idle thread". It waits for no such thing. An animation
// only counts as an interaction when it runs on the JS thread —
// `isInteraction` defaults to `!useNativeDriver` — and every animation
// in this app is native-driven, the skeletons' pulse included. A fetch
// is not an interaction, a Fabric commit is not, an image decode is not.
// With nothing to wait for, the callback ran on the next `setImmediate`,
// a few milliseconds after the storage read: the sheet mounted and began
// its spring inside the burst it was written to avoid, and the burst
// showed in the spring as dropped frames. The API is deprecated besides.
//
// So the wait is now an explicit fact that Explore states when it is
// true, in the same effect that marks `explore:content` for the trace.
// Same shape as the hero's `gone` store, for the same reason: a boolean
// one component needs, without a re-render for anyone else.
//
// Plain TypeScript, no imports, tested from `launch.test.ts`.

export type LaunchSettled = {
  /** Explore calls this once its content is on screen. Idempotent. */
  settle: () => void;
  subscribe: (onChange: () => void) => () => void;
  get: () => boolean;
  /** Tests only: back to "not yet". */
  reset: () => void;
};

export function launchStore(): LaunchSettled {
  let settled = false;
  const subs = new Set<() => void>();
  const set = (next: boolean) => {
    if (settled === next) return;
    settled = next;
    subs.forEach((f) => f());
  };
  return {
    settle: () => set(true),
    subscribe: (f) => { subs.add(f); return () => { subs.delete(f); }; },
    get: () => settled,
    reset: () => set(false),
  };
}

/** The app's one launch. */
export const launchSettled = launchStore();
