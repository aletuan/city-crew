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
  /**
   * Draw the price on a place's detail screen. **Off**, and that is a
   * decision rather than an oversight.
   *
   * The fact row is category chips and then the price, and it wraps to a
   * second line whenever a place carries three categories — twelve of the
   * eighteen that do are café + eats + nightlife, which needs 427pt of a
   * 386pt row. Without the price every three-category place fits, the
   * worst of them by a single point.
   *
   * The cost is not small and is worth stating plainly: the detail screen
   * is the *only* surface in this app that has ever shown a price. Hiding
   * it here hides it everywhere, on the 557 published places of 648 that
   * carry one. The data is untouched and the planner still budgets with
   * it; what is gone is the reader's sight of it.
   *
   * So it is a switch rather than a deletion, and this is the key to flip
   * when the price gets a home of its own:
   *
   *     update app_flags set enabled = true where key = 'place_price';
   *
   * Every phone, on the next launch, with no build to publish — which is
   * what a table is for and a constant is not.
   */
  place_price: false,
  /**
   * Draw the Check-in pill on a place's detail screen. **Off** as
   * shipped, because what the pill opens is not built yet: the tap says
   * so, in a sentence, and that is the whole feature today.
   *
   * A placeholder has one job — to be seen, so the idea can be judged in
   * its place rather than in a mockup — and one risk, which is that it
   * outstays its welcome. Hence a switch and not a constant: the row in
   * `app_flags` turns it on for the preview, and turns it off again, on
   * every phone at once, the morning it starts to mislead. See
   * `20261008090000_place_checkin_app_flags.sql` for the row.
   */
  place_checkin: false,
  /**
   * Draw each city's place count at the right edge of its row in the city
   * sheet. **Off** (owner, 21 Oct 2026): 370 beside Sài Gòn and 8 beside
   * Vũng Tàu read as a league table of cities, and the number is the
   * catalog's business, not the reader's reason to pick one. The NEW chip
   * beside a young city stays — it says the same thing kindly, and still
   * reads the count to decide.
   *
   * There is no row for it, so the default is the answer. To bring the
   * numbers back on every phone at the next launch:
   *
   *     insert into app_flags (key, enabled, note) values
   *       ('city_place_counts', true, 'Place counts in the city sheet.')
   *     on conflict (key) do update set enabled = true;
   */
  city_place_counts: false,
  /**
   * Comments on a collection: the count and the two newest on a card,
   * the thread, the composer. **Off** as shipped, and off until the
   * release that carries them has been through App Review.
   *
   * The plan is `docs/comments-plan.md`: eleven pull requests, each
   * merged as it is finished — and every merge to `main` is an update on
   * every phone within the hour. A reader must not meet half of it (a
   * count that opens nothing, a thread nobody can report), and comments
   * are people's own words to each other, which Apple reviews an app for
   * (Guideline 1.2: a filter, a report on every comment, a block). So
   * the pieces land behind this, and the row is what turns them on, for
   * the build the reviewer opens and then for everyone:
   *
   *     insert into app_flags (key, enabled, note) values
   *       ('comments', true, 'Comments on collections.')
   *     on conflict (key) do update set enabled = true;
   *
   * A row rather than a constant for the other direction too: if a
   * thread goes wrong faster than the desk can act, comments can be
   * taken off every phone at the next launch, with no build to publish.
   */
  comments: false,
  /**
   * Photos on a check-in, up to three (`docs/checkin-photos-plan.md`).
   * **Off** as shipped, and off until the release that carries the whole
   * of it — the upload (K3), the cards that show them (K4), the report
   * and the policy's sentence (K5) — has been through App Review, for the
   * reason `comments` is: a photograph a person uploads for others to see
   * is what Guideline 1.2 is about, and every merge reaches every phone
   * within the hour. To try it on one's own phone before then, the row
   * on, a launch, the row off:
   *
   *     insert into app_flags (key, enabled, note) values
   *       ('checkin_photos', true, 'Photos on check-ins.')
   *     on conflict (key) do update set enabled = true;
   */
  checkin_photos: false,
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
  /**
   * Read every known switch from `app_flags`, and — for somebody signed
   * in — the switches turned on for them alone (`app_flag_testers`).
   * Never throws: a switch that cannot be read stays as shipped. Resolves
   * true when this read's answer was applied — what is worth keeping.
   *
   * ── on for one account ──
   *
   * A feature built behind a switch over many merges has to be seen on
   * a phone before the switch is thrown for everybody, and the switch is
   * one row for every phone. `app_flag_testers` is the same switch with
   * a name on it: a row (key, user) turns that key on for that account
   * and nobody else, whatever `app_flags` says. It can only turn a
   * switch on — a tester sees more than the public, never less — and a
   * row can only be written in the SQL editor, as a switch can.
   *
   * The whole answer is worked out and then applied: defaults, then the
   * table's rows, then the reader's own. So signing out puts a tester's
   * switch back where the table has it, and of two reads in flight —
   * the launch's as nobody, then the session's — only the later one
   * asked is applied, whichever lands last.
   */
  load: (client: FlagsClient, signedIn?: boolean) => Promise<boolean>;
  /**
   * The last launch's answer, put on until this launch's arrives (owner,
   * 25 Nov 2026). Every switch used to open as shipped — off — and turn
   * on a few seconds into the launch, when `app_flags` answered: a page
   * drew without its check-ins, then took them in at the top; a visit's
   * photos showed the place's cover, then their own. Kept by
   * `flagsSync`; read once, and never over an answer already in:
   * a fresh answer beats a remembered one. A key the app no longer
   * knows, or a value that is not a boolean, moves nothing.
   *
   * The cost: a switch turned off for everybody is still on for the
   * first seconds of the next launch, until the table answers — the
   * table is still what decides, a beat later than it did.
   */
  restore: (saved: unknown) => void;
  /** Every switch as it stands, for keeping. */
  snapshot: () => Record<FlagKey, boolean>;
  /** Whether the switches are an answer — remembered or read — and not
   *  just as shipped. A page that would draw differently with a switch
   *  on waits for this rather than drawing twice. */
  ready: () => boolean;
  /** Back to the shipped defaults. */
  reset: () => void;
};

export function flagsStore(defaults: Record<FlagKey, boolean> = FLAG_DEFAULTS): Flags {
  const state: Record<FlagKey, boolean> = { ...defaults };
  const subs = new Set<() => void>();
  // Which `load` was asked last — see `Flags.load`.
  let latest = 0;
  // An answer has been applied: a read one, or a remembered one.
  let known = false;
  let read = false;
  const becomeKnown = () => { if (known) return; known = true; subs.forEach((f) => f()); };
  const set = (key: FlagKey, enabled: boolean) => {
    if (state[key] === enabled) return;
    state[key] = enabled;
    subs.forEach((f) => f());
  };
  return {
    get: (key) => state[key],
    subscribe: (f) => { subs.add(f); return () => { subs.delete(f); }; },
    set,
    load: async (client, signedIn = false) => {
      const asked = ++latest;
      try {
        const { data, error } = await client.from('app_flags').select('key, enabled');
        if (error || !Array.isArray(data)) return false;
        const next: Record<FlagKey, boolean> = { ...defaults };
        for (const row of data as { key?: unknown; enabled?: unknown }[]) {
          // A key the app does not know is a switch for a newer app; a
          // value that is not a boolean is a row somebody typed wrong.
          // Neither is allowed to move anything.
          if (typeof row.key === 'string' && row.key in defaults && typeof row.enabled === 'boolean') {
            next[row.key as FlagKey] = row.enabled;
          }
        }
        // The reader's own, which only ever turn a switch on. A read
        // that fails is nobody's switches: the table's answer stands.
        if (signedIn) {
          const own = await client.from('app_flag_testers').select('key');
          if (!own.error && Array.isArray(own.data)) {
            for (const row of own.data as { key?: unknown }[]) {
              if (typeof row.key === 'string' && row.key in defaults) next[row.key as FlagKey] = true;
            }
          }
        }
        // A later ask is on its way or has landed: this answer is old.
        if (asked !== latest) return false;
        read = true;
        (Object.keys(next) as FlagKey[]).forEach((k) => set(k, next[k]));
        becomeKnown();
        return true;
      } catch {
        // No network. The defaults are the answer — or what was
        // remembered, which is a better guess at the table than they are.
        return false;
      }
    },
    restore: (saved) => {
      // Nothing kept — a first launch — is not an answer: the page waits
      // for the table, as long as it waits for anything.
      if (read || !saved || typeof saved !== 'object') return;
      for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
        if (k in defaults && typeof v === 'boolean') set(k as FlagKey, v);
      }
      becomeKnown();
    },
    snapshot: () => ({ ...state }),
    ready: () => known,
    reset: () => {
      (Object.keys(defaults) as FlagKey[]).forEach((k) => set(k, defaults[k]));
      known = false;
      read = false;
    },
  };
}

/** The app's switches. Loaded once by `App.tsx`, read by `useFlag`. */
export const appFlags = flagsStore();
