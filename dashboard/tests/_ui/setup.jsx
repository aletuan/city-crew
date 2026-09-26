// What a desk screen needs around it to render in a Node process.
//
// Two things are stood in for, and they are stood in for every test:
//
// ── the API ──
// `src/api.js` is the whole of the desk's traffic to Supabase, and it is
// replaced wholesale with a `vi.fn()` per method. Each starts every test
// with a harmless default (empty lists, zero counts, a resolved save), so
// a screen can mount without a test having to script every call it makes
// on the way up; a test then overrides the one or two it is about, e.g.
// `api.places.mockResolvedValue({ rows, total: 1, pageSize: 24 })`.
// `mockReset` between tests, so an override never leaks into the next
// file's idea of a quiet desk.
//
// ── the client ──
// `src/lib/supabase.js` throws at import when the VITE_ variables are
// unset — which they are here, and should be: the app's tests inserted
// fixtures into a production table for a day before a stand-in was made
// mandatory (see app/src/uitest/setup.tsx). Only `auth.jsx` reaches the
// client directly; its methods are `vi.fn()`s with defaults that describe
// a signed-out desk, and the auth test drives them.
//
// The rest is jsdom's missing pieces: no ResizeObserver, no matchMedia,
// no object URLs, a `scrollTo` that logs "not implemented". Each stub is
// the smallest thing that lets a tree mount — a name, not a behaviour.

import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Hoisted with the mocks, because the factory below reads them and
// `vi.mock` runs before anything else in this file.
const { CITIES, EMPTY_PROGRESS, API_DEFAULTS } = vi.hoisted(() => {
const CITIES = [
  { id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', short_en: 'Saigon', short_vi: 'Sài Gòn' },
  { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', short_en: 'Hanoi', short_vi: 'Hà Nội' },
  { id: 'danang', name_en: 'Da Nang', name_vi: 'Đà Nẵng', short_en: 'Da Nang', short_vi: 'Đà Nẵng' },
];

const EMPTY_PROGRESS = {
  total: 0, by_status: {}, unpublished: 0, unclassified: [],
  by_category: {}, by_category_tag: {}, by_vibe: {}, by_threads: { yes: 0, no: 0 },
};

/** Every method on `api`, with the answer a quiet desk would give. */
const API_DEFAULTS = {
  reports: async () => [],
  markReport: async () => {},
  moderateCollection: async () => {},
  moderateProfile: async () => {},
  suspendUser: async () => ({}),
  categoryTerms: async () => ({}),
  saveCategoryTerms: async (_category, terms) => terms,
  cities: async () => CITIES,
  city: async (id) => ({ id, ...CITIES.find((c) => c.id === id) }),
  saveCityHero: async () => ({ ok: true }),
  setCityHeroPhoto: async () => ({ ok: true, left: [] }),
  clearCityHeroPhoto: async () => ({ ok: true, left: [] }),
  places: async (params = {}) => (params.all ? [] : { rows: [], total: 0, pageSize: 24 }),
  place: async () => { throw new Error('not found'); },
  saveCount: async () => 0,
  savePlace: async () => ({ ok: true }),
  deletePlace: async () => ({ ok: true, removed_uploads: 0, left: [] }),
  deletePlaces: async () => ({ ok: true, deleted: 0, removed_uploads: 0, left: [] }),
  approvePlaces: async () => ({ ok: true, approved: 0 }),
  publishApproved: async () => ({ published: 0 }),
  cityCounts: async () => ({}),
  progress: async () => EMPTY_PROGRESS,
  contributors: async () => ({ rows: [], profiles: {} }),
  localGuides: async () => new Map(),
  setLocalGuide: async (_id, on) => on,
  coverage: async () => [],
  sync: async () => ({}),
  existingByPlaceIds: async () => ({}),
  searchPlaces: async () => ({ candidates: [] }),
  importPlace: async () => ({ slug: 'new-place', photos: 0 }),
  scanCategories: async () => ({ categories: [] }),
  scanCity: async () => ({ imported: [], skipped_existing: 0, errors: [] }),
  patchPhoto: async () => ({ ok: true }),
  reorderPhotos: async () => ({ ok: true }),
  uploadPhoto: async () => ({ id: 'uploaded' }),
  deletePhoto: async () => ({ ok: true, left: [] }),
};
return { CITIES, EMPTY_PROGRESS, API_DEFAULTS };
});
export { CITIES, EMPTY_PROGRESS };

vi.mock('../../src/api.js', () => {
  const api = {};
  for (const name of Object.keys(API_DEFAULTS)) api[name] = vi.fn();
  return { api, resizeImage: vi.fn() };
});

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

// Imported after the mocks are registered, so these are the stand-ins.
import { api, resizeImage } from '../../src/api.js';
import { supabase } from '../../src/lib/supabase.js';

/** Back to the quiet desk. Called before every test; callable from one. */
export function resetApi() {
  for (const [name, impl] of Object.entries(API_DEFAULTS)) {
    api[name].mockReset();
    api[name].mockImplementation(impl);
  }
  resizeImage.mockReset();
  resizeImage.mockImplementation(async (file) => new Blob([file?.name ?? 'x'], { type: 'image/jpeg' }));
}

/** A signed-out client whose listener never fires. */
export function resetSupabase() {
  const { auth } = supabase;
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  supabase.rpc.mockReset();
  supabase.rpc.mockResolvedValue({ data: true, error: null });
}

// ── what jsdom does not have ──

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (media) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
}

if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// React Router prints its v7 migration notice once per router, which is
// once per test here. It is advice about a flag, not a fault in a test.
const warn = console.warn.bind(console);
console.warn = (...args) => {
  if (String(args[0]).includes('React Router Future Flag Warning')) return;
  warn(...args);
};

beforeEach(() => {
  resetApi();
  resetSupabase();
  localStorage.clear();
  window.scrollTo = vi.fn();
  window.confirm = vi.fn(() => true);
  URL.createObjectURL = vi.fn((blob) => `blob:${blob?.name ?? blob?.size ?? 'x'}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
