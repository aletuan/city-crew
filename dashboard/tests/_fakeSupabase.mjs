// A fake Supabase client for testing dashboard/src/api.js without a network
// call or a real project — same spirit as the `bucket()` helper in
// storage.test.mjs, scaled up to the query-builder shape api.js chains.
//
// api.js calls `supabase.from(table).select(...).eq(...)....` and awaits the
// chain directly (postgrest-js builders are themselves thenable), so each
// `.from()`/`.rpc()` call here hands back an object that records every
// chained method call for a test to assert on, and resolves to a
// pre-configured `{ data, error, count }` when awaited.
//
// Responses are consumed in call order, not matched by table name: api.js's
// control flow issues `.from()` calls in a fixed sequence per function, so
// "the 2nd call this test makes" is a stable, readable way to hand back the
// 2nd answer. `record()` after the fact shows what each call actually asked
// (table + method chain), which is what most tests here assert on.
const CHAIN_METHODS = [
  'select', 'update', 'insert', 'delete', 'upsert',
  'eq', 'neq', 'in', 'not', 'is', 'contains', 'or', 'order', 'range', 'limit', 'gte',
];

function chainable(result, record) {
  const builder = {};
  for (const m of CHAIN_METHODS) {
    builder[m] = (...args) => { record.chain.push([m, args]); return builder; };
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  builder.catch = (reject) => Promise.resolve(result).catch(reject);
  return builder;
}

/**
 * @param {Array<{data?: any, error?: any, count?: number}>} responses one
 *   entry per `.from()`/`.rpc()` call, in the order api.js will make them.
 * @param {object} [extra] override `storage` / `functions.invoke`.
 */
export function fakeSupabase(responses = [], extra = {}) {
  const calls = []; // [{ kind: 'from'|'rpc', table, chain: [[method,args],...] }]
  let i = 0;
  const next = () => responses[i++] ?? { data: [], error: null };

  const from = (table) => {
    const record = { kind: 'from', table, chain: [] };
    calls.push(record);
    return chainable(next(), record);
  };

  const rpc = (fn, args) => {
    const record = { kind: 'rpc', fn, args, chain: [] };
    calls.push(record);
    return chainable(next(), record);
  };

  return {
    from,
    rpc,
    calls,
    functions: { invoke: extra.invoke ?? (async () => ({ data: null, error: new Error('not stubbed') })) },
    storage: { from: extra.storageFrom ?? (() => ({ upload: async () => ({ error: null }), remove: async () => ({ data: [], error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) })) },
  };
}
