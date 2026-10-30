// Which places are saved, held where a card can ask about one of them.
//
// ── why (owner, 30 Oct 2026) ──
//
// The bookmark's fill was read from the save context, and that context
// carried the whole saved set: a tap on one bookmark handed every
// subscriber a new value, and every card on screen drew again to find
// that its own fill had not changed. A context cannot be asked a narrower
// question than its value, so the set moved here, behind
// `useSyncExternalStore`: a card subscribes with its own slug, its answer
// is a boolean, and React redraws it only when that boolean moves.
//
// The provider owns one of these for its lifetime and hands it the new
// set after each commit (`SaveProvider`). Nothing here is React.

/** The saved set, and who to tell when it is replaced. */
export type SavedStore = {
  /** The set as it stands. Replaced whole, never mutated, so a snapshot
   *  compares by identity. */
  get: () => ReadonlySet<string>;
  /** Take a new set; tell the subscribers only if it is a new one. */
  replace: (next: ReadonlySet<string>) => void;
  /** `useSyncExternalStore`'s subscribe: returns its own unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

export function savedStore(initial: ReadonlySet<string>): SavedStore {
  let set = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => set,
    replace: (next) => {
      if (next === set) return;
      set = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
