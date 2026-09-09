// The switches the app reads at launch, and what it does without them.
//
// ── why a table and not a constant ──
//
// A constant is flipped by a release. For most decisions that is fine;
// for the one this was written for it is not. `photo_attribution` is
// whether the app draws the photographer's credit over a Google place
// photo. Google's terms ask for that credit wherever its photos appear,
// and turning it off is a deliberate exposure — which means turning it
// back on has to be possible in minutes, on every phone at once,
// including the ones on an App Store build that no OTA update reaches.
// A row in `app_flags` is that: flipped in the SQL editor, read on the
// next launch, no build and nothing to publish.
//
// ── the default is the safe position ──
//
// Every key the app knows has a default here, and a row in the table
// only overrides it. A phone in a tunnel, a table without the row yet,
// a fetch that throws — all of them leave the app as it shipped. For
// the credit that is: shown. The table can only ever be asked to hide
// it; it cannot be relied on to show it.
//
// ── the shape ──
//
// The same external store as `launch.ts` — a value one component reads
// through `useSyncExternalStore`, changed rarely, without a re-render
// for anyone who did not ask. The React hook over it lives in
// `useFlag.tsx`, so this file stays a plain module the coverage gate
// can hold; `load` takes the client as an argument for the same reason
// `suggest.ts` does.

export const FLAG_DEFAULTS = {
  /** Draw the photographer's credit over Google place photos. */
  photo_attribution: true,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

/** The one query this makes, typed to what it needs and nothing else. */
export type FlagsClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
};

export type Flags = {
  get: (key: FlagKey) => boolean;
  subscribe: (onChange: () => void) => () => void;
  /** Override one switch. `load` uses it; tests use it to stand in for a row. */
  set: (key: FlagKey, enabled: boolean) => void;
  /** Read every known switch from `app_flags`. Never throws: a switch
   *  that cannot be read stays as shipped. */
  load: (client: FlagsClient) => Promise<void>;
  /** Back to the shipped defaults. */
  reset: () => void;
};

export function flagsStore(defaults: Record<FlagKey, boolean> = FLAG_DEFAULTS): Flags {
  const state: Record<FlagKey, boolean> = { ...defaults };
  const subs = new Set<() => void>();
  const set = (key: FlagKey, enabled: boolean) => {
    if (state[key] === enabled) return;
    state[key] = enabled;
    subs.forEach((f) => f());
  };
  return {
    get: (key) => state[key],
    subscribe: (f) => { subs.add(f); return () => { subs.delete(f); }; },
    set,
    load: async (client) => {
      try {
        const { data, error } = await client.from('app_flags').select('key, enabled');
        if (error || !Array.isArray(data)) return;
        for (const row of data as { key?: unknown; enabled?: unknown }[]) {
          // A key the app does not know is a switch for a newer app; a
          // value that is not a boolean is a row somebody typed wrong.
          // Neither is allowed to move anything.
          if (typeof row.key === 'string' && row.key in defaults && typeof row.enabled === 'boolean') {
            set(row.key as FlagKey, row.enabled);
          }
        }
      } catch {
        // No network. The defaults are the answer.
      }
    },
    reset: () => { (Object.keys(defaults) as FlagKey[]).forEach((k) => set(k, defaults[k])); },
  };
}

/** The app's switches. Loaded once by `App.tsx`, read by `useFlag`. */
export const appFlags = flagsStore();
