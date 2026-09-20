// Whether the desk has made this account a local guide — asked once for
// the whole app, and answerable without waiting.
//
// ── the jump this exists to stop ──
//
// `LocalGuidePanel` draws nothing unless the grant says yes, and the
// grant used to arrive from `useIsLocalGuide`, a `useFetch` mounted by
// the panel itself. So every place a guide opened went: render with the
// default `false`, draw the card without the panel, land the answer a
// round trip later, and push the whole info card down the screen. A
// visible jump, once per place, on every place its owner opened.
//
// Two things were wrong with that and only one of them is the latency.
// The other is scope: a grant is a property of the *session*, not of a
// screen. Asking per screen is the same fault `lib/crew` was written to
// cure, and its note says it better than this one could — four places
// asking the same question separately, each re-deriving in front of the
// reader what another had just drawn.
//
// ── why a store and not another hook ──
//
// A fetch hook cannot answer on the first render; that is what a fetch
// is. Even with the answer already in hand it would render once with the
// default and once with the truth, which is the same jump made shorter.
// The cure is a value a component can *read*, synchronously, the moment
// it renders — so this is the shape `lib/flags` already uses here: a
// plain module store, a `useSyncExternalStore` over it, and one load at
// launch.
//
// ── what is deliberately not here ──
//
// No persistence across launches. `useIsLocalGuide` carried that
// reasoning and it still holds: a grant is rare, small and given by
// hand, and a stale `true` kept from last week would draw a control the
// database then refuses — the reader taps Add photo and meets a policy
// error. Loading once per launch removes the jump without taking that
// on, because the request settles while the reader is still looking at
// the city list, long before any place can be opened.

/** The answer, and whose it is. Keyed by uid so that signing into
 *  another account cannot inherit the last one's grant. */
type State = { uid: string | null; granted: boolean; asked: boolean };

export type GuideGrant = {
  /** The grant for this account, as of now. `false` until it is known,
   *  which is the answer that draws nothing. */
  get: (uid: string | null) => boolean;
  subscribe: (onChange: () => void) => () => void;
  /** Ask once per account. Idempotent: a second call for a uid already
   *  asked about does nothing, so mounting this in two places costs one
   *  request. Never throws — a grant that cannot be read is no grant. */
  load: (uid: string | null, ask: () => Promise<boolean>) => Promise<void>;
  /** Back to knowing nothing. For tests, and for signing out. */
  reset: () => void;
};

const EMPTY: State = { uid: null, granted: false, asked: false };

export function guideGrantStore(): GuideGrant {
  let state: State = EMPTY;
  const subs = new Set<() => void>();
  const set = (next: State) => {
    if (next.uid === state.uid && next.granted === state.granted && next.asked === state.asked) return;
    state = next;
    subs.forEach((f) => f());
  };
  return {
    // The uid is checked rather than assumed: a render that happens
    // between one account signing out and the next being asked about
    // would otherwise read the previous account's answer.
    get: (uid) => (!!uid && state.uid === uid && state.granted),
    subscribe: (f) => { subs.add(f); return () => { subs.delete(f); }; },
    load: async (uid, ask) => {
      if (!uid) { set(EMPTY); return; }
      if (state.uid === uid && state.asked) return;
      // Marked asked before the await, so two components mounting in the
      // same frame make one request rather than two.
      //
      // `granted: false` unconditionally, and that is not a lost case:
      // the only state carrying a true grant also carries `asked`, and
      // this line is past the early return that catches those. The one
      // thing that clears `asked` is `reset`, which clears the uid with
      // it, so there is no way to arrive here holding a yes.
      set({ uid, granted: false, asked: true });
      try {
        const granted = await ask();
        set({ uid, granted, asked: true });
      } catch {
        // A signed-out reader, a table that is not there yet, a network
        // that went away: all of them mean "draw no control", which is
        // what the state already says.
      }
    },
    reset: () => set(EMPTY),
  };
}

/** The app's copy. Loaded by `GuideGrantSync`, read by `useIsGuide`. */
export const guideGrant = guideGrantStore();
