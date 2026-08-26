// Data layer: reads the published catalog straight from Supabase with the
// public client — the same access path (and RLS view) the mockup snapshot
// uses. No app server involved.
//
// ── why this is a directory ──
//
// It was one 1,261-line file with fifty-two exports, holding eight things
// that have nothing to do with each other: the catalog, lists, trips,
// preferences, the history table, friendships, blocks and reports. Nothing
// was wrong with any of it; there was simply no reason for a change to
// trips to sit in the same file as a change to blocks, and no way to read
// one without scrolling past the others.
//
// This barrel is why the split cost no call sites. Every screen imports
// `from '../lib/data'`, which resolved to `data.ts` and now resolves here,
// and the names it re-exports are the same names in the same shapes.
//
// ── the seam that matters ──
//
// `fetch.ts` and `hooks.ts` are React and need a renderer. The other five
// modules are plain async functions over a Supabase client, which is a
// thing `lib/testing.ts` can stand in for — so they can be tested in a
// Node process and held to the coverage gate, which the old single file
// could not be while half of it was hooks. That is the same boundary
// `place.ts` was pulled out along, and for the same reason.

// Shapes and pure helpers live next door, where a Node process can reach
// them without pulling in Supabase and React Native. Re-exported here so
// that `from '../lib/data'` keeps meaning what it always did.
export * from '../types';
export * from '../place';
export * from '../live';

export * from './fetch';
export * from './places';
export * from './collections';
export * from './trips';
export * from './preferences';
export * from './people';
export * from './invites';
export * from './hooks';
