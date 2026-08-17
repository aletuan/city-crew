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
  /** The Edge Function name, when the call was an invoke rather than a query. */
  fn?: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'invoke';
  /** The row for a write, the body for an invoke, the column list for a read. */
  payload?: unknown;
  filters: [string, unknown][];
  or?: string;
  order?: unknown[];
  single?: boolean;
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
      select: (cols?: unknown) => { asked.payload = cols; return b; },
      insert: (row: unknown) => { asked.op = 'insert'; asked.payload = row; return b; },
      update: (row: unknown) => { asked.op = 'update'; asked.payload = row; return b; },
      delete: () => { asked.op = 'delete'; return b; },
      eq: (k: string, v: unknown) => { asked.filters.push([k, v]); return b; },
      in: (k: string, v: unknown) => { asked.filters.push([k, v]); return b; },
      or: (s: string) => { asked.or = s; return b; },
      order: (...a: unknown[]) => { asked.order = a; return b; },
      single: () => { asked.single = true; return b; },
      // The builder is the promise. supabase-js works the same way, which
      // is why `await supabase.from(...).select(...)` reads as it does.
      then: (ok: (r: Reply) => unknown, no?: (e: unknown) => unknown) => settle().then(ok, no),
    };
    return b;
  };

  return {
    queue,
    log,
    reset() { queue.length = 0; log.length = 0; },
    /** Queue the replies the next awaited calls will get, in order. */
    replies(...r: Reply[]) { queue.push(...r); },
    client: {
      from: build,
      functions: {
        invoke: (fn: string, opts?: { body?: unknown }) => {
          log.push({ fn, op: 'invoke', payload: opts?.body, filters: [] });
          return settle();
        },
      },
    },
  };
}
