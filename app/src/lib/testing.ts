// A Supabase client that answers from a queue and writes down what it was
// asked.
//
// Test-only, and excluded from the coverage gate for that reason — it is
// scaffolding, not shipped code.
//
// Everything in `data.ts`, `suggest.ts` and `findplace.ts` is a shape
// pressed against a network client: which table, which filters, what goes
// in the body, and what each kind of failure means. None of that needs a
// database to check, and none of it can be checked without standing in
// for one — a real client would need a server, and a `vi.fn()` per method
// would assert that the calls happened without ever asserting they were
// *chained into the right query*.
//
// So this is a chainable builder that records. `queue` is what the next
// awaited call resolves to; `log` is what was asked, in order.

export type Reply = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  /**
   * Reject instead of resolving.
   *
   * supabase-js reports a refused query in `error` and a *broken* one — no
   * network, DNS gone, the request never leaving the phone — by throwing.
   * Code that only ever meets the first kind has a `catch` nobody has read.
   */
  throws?: unknown;
};

export type Asked = {
  table?: string;
  /**
   * The function's name, for the two calls that are not table queries: an
   * Edge Function (`op: 'invoke'`) and a Postgres function (`op: 'rpc'`).
   *
   * Kept as separate verbs rather than one, because they fail differently
   * and a test that could not tell them apart would pass for either: an
   * Edge Function is an HTTP round trip that can be missing or unauthorised,
   * an rpc is SQL running under the caller's RLS.
   */
  fn?: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'invoke' | 'rpc';
  /** The row for a write, the body for an invoke, the column list for a read. */
  payload?: unknown;
  /** `eq`, `in`, `gte` and `ilike` in the order they were chained. Anything
   *  that is not equality records the operator alongside the column, because
   *  "created_at at least X" and "created_at is X" are different questions
   *  and a test that could not tell them apart would pass for either. The
   *  markers are Postgres's own: `>=`, and `~~*` for a case-insensitive
   *  match. */
  filters: [string, unknown][];
  or?: string;
  /**
   * The *first* `order` call's arguments — the primary sort.
   *
   * First rather than last, which is what a builder that simply reassigned
   * would leave behind: `fetchCollections` chains two, and the whole point
   * of the code it is asserting is which one leads. A test reading the last
   * one would have passed with the orderings the wrong way round, which is
   * the bug the comment above that query exists to prevent.
   */
  order?: unknown[];
  /** Every `order` call, in the order they were chained, for the queries
   *  where the tie-break is part of the answer. */
  orders?: unknown[][];
  single?: boolean;
  /** `maybeSingle`, which differs from `single` in what it does about no
   *  rows — an error there, a null here. Recorded separately so a test can
   *  assert the query asked the forgiving question. */
  maybe?: boolean;
  /** `upsert` rather than `insert`. The row is the same; what differs is
   *  whether a second write from the same person is a conflict or a change
   *  of mind, which for a one-row-per-person table is the whole design. */
  upsert?: boolean;
  /** The row cap, when one was asked for. A suggestion list that quietly
   *  stopped capping itself is a dropdown that grows without limit. */
  limit?: number;
};

export function fakeSupabase() {
  const queue: Reply[] = [];
  const log: Asked[] = [];

  // An empty queue answers "nothing, and no error". A test that forgot to
  // queue a reply then fails on its assertion rather than on a crash
  // inside the code under test, which is the more useful place to fail.
  const next = (): Reply => (queue.length ? queue.shift()! : { data: null, error: null });

  const settle = (): Promise<Reply> => {
    const r = next();
    return 'throws' in r ? Promise.reject(r.throws) : Promise.resolve(r);
  };

  const build = (table: string) => {
    const asked: Asked = { table, op: 'select', filters: [] };
    log.push(asked);
    const b: Record<string, unknown> = {
      // Only a read records its column list. A write that chains `.select()`
      // to get its own row back — `insert(...).select('id').single()`, which
      // is how every insert here that needs an id is written — would
      // otherwise overwrite the row with the string `'id'`, leaving the one
      // thing a test wants to assert about a write unassertable. `op` is
      // still `'select'` until a verb changes it, so a plain read is
      // unaffected.
      select: (cols?: unknown) => { if (asked.op === 'select') asked.payload = cols; return b; },
      insert: (row: unknown) => { asked.op = 'insert'; asked.payload = row; return b; },
      update: (row: unknown) => { asked.op = 'update'; asked.payload = row; return b; },
      // Recorded as an insert carrying a flag rather than as its own verb:
      // what a test wants to assert about an upsert is the row, and every
      // existing assertion for a write already reads `op: 'insert'`.
      upsert: (row: unknown) => { asked.op = 'insert'; asked.payload = row; asked.upsert = true; return b; },
      delete: () => { asked.op = 'delete'; return b; },
      eq: (k: string, v: unknown) => { asked.filters.push([k, v]); return b; },
      in: (k: string, v: unknown) => { asked.filters.push([k, v]); return b; },
      gte: (k: string, v: unknown) => { asked.filters.push([`${k}>=`, v]); return b; },
      // Case-insensitive match. Recorded distinctly from `eq` because the
      // difference is the point wherever it is used: handles are stored
      // lowercase and typed however the reader felt.
      ilike: (k: string, v: unknown) => { asked.filters.push([`${k}~~*`, v]); return b; },
      limit: (n: number) => { asked.limit = n; return b; },
      or: (s: string) => { asked.or = s; return b; },
      order: (...a: unknown[]) => {
        (asked.orders ??= []).push(a);
        asked.order ??= a;
        return b;
      },
      single: () => { asked.single = true; return b; },
      maybeSingle: () => { asked.maybe = true; return b; },
      // The builder is the promise. supabase-js works the same way, which
      // is why `await supabase.from(...).select(...)` reads as it does.
      then: (ok: (r: Reply) => unknown, no?: (e: unknown) => unknown) => settle().then(ok, no),
    };
    return b;
  };

  // Whoever is listening for sign-in and sign-out. Held as a list so a
  // test can fire an event at the code under test rather than reaching
  // into a provider to fake one — `lib/city` releases a manual pick on
  // SIGNED_OUT, and firing the real event is the only honest way to say so.
  const listeners: ((event: string, session: unknown) => void)[] = [];

  return {
    queue,
    log,
    reset() { queue.length = 0; log.length = 0; listeners.length = 0; },
    /** Queue the replies the next awaited calls will get, in order. */
    replies(...r: Reply[]) { queue.push(...r); },
    /** Tell every listener what just happened to the session. */
    fireAuth(event: string, session: unknown = null) {
      for (const fn of [...listeners]) fn(event, session);
    },
    client: {
      from: build,
      auth: {
        onAuthStateChange(fn: (event: string, session: unknown) => void) {
          listeners.push(fn);
          return {
            data: {
              subscription: {
                unsubscribe() {
                  const at = listeners.indexOf(fn);
                  if (at >= 0) listeners.splice(at, 1);
                },
              },
            },
          };
        },
      },
      /**
       * A Postgres function, which is not a query and not an Edge Function.
       *
       * It answers the same `{ data, error }` shape, so it shares the queue;
       * what a test wants to pin is the name and the arguments, since both
       * are strings the compiler never checks against the migration that
       * declares them.
       */
      rpc: (fn: string, args?: unknown) => {
        log.push({ fn, op: 'rpc', payload: args, filters: [] });
        return settle();
      },
      functions: {
        invoke: (fn: string, opts?: { body?: unknown }) => {
          log.push({ fn, op: 'invoke', payload: opts?.body, filters: [] });
          return settle();
        },
      },
    },
  };
}
