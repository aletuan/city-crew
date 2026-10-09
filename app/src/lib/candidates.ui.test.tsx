// @vitest-environment jsdom
//
// Who may ask Google, what they are told when it fails, and what becomes
// of each row once several are sent.
//
// `fetch-place` refuses anybody not signed in. Search offered the "Add"
// row to guests anyway, the tap went to the function, and the refusal came
// back as supabase-js's "Edge Function returned a non-2xx status code" in
// an alert. Pinned here: a guest gets the sign-in sheet and no round trip;
// a lapsed session that is refused gets the same sheet; any other failure
// gets a sentence a reader can act on, never the plumbing's message.
//
// The rest is the batch: every outcome the server can give is a state a
// row wears, the daily cap holds what it never attempted rather than
// failing it, and "3 of 5" counts only what was tried.
//
// Everything the hook reads from context is a mutable stand-in on `h`, so
// one test can be a reader in another city, or one with no city at all,
// without a second file of mocks.

import { Alert, Keyboard } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../uitest/render';
import type { Candidate, Known, SuggestOutcome } from './suggest';

type City = { id: string; center_lat: number; center_lng: number; radius_km: number };

// Hoan Kiem, roughly. The figures below are measured with `lib/geo` from
// this centre, and are written as literals so a broken formula cannot
// agree with itself.
const HANOI: City = { id: 'hanoi', center_lat: 21.0285, center_lng: 105.8542, radius_km: 25 };

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  city: null as null | City,
  me: null as null | { lat: number; lng: number },
  askToSignIn: vi.fn(),
  searchPlaces: vi.fn(),
  knownByPlaceId: vi.fn(),
  suggestPlace: vi.fn(),
  // One object for the life of a test, as the real context's value is:
  // a fresh one per render would rebuild `addMany` on every state change
  // and test a churn the app does not have.
  places: { data: [], reload: vi.fn() },
}));

vi.mock('./i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('./auth', () => ({ useAuth: () => ({ session: h.session }) }));
vi.mock('./save', () => ({ useSave: () => ({ askToSignIn: h.askToSignIn }) }));
vi.mock('./city', () => ({
  useCity: () => ({ city: h.city }),
  useMyPosition: () => h.me,
}));
vi.mock('./catalog', () => ({ usePlaces: () => h.places }));
vi.mock('./suggest', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  searchPlaces: h.searchPlaces,
  knownByPlaceId: h.knownByPlaceId,
  suggestPlace: h.suggestPlace,
}));

import { freshOnly, IDLE_BATCH, useCandidates } from './candidates';
import { SignedOutError } from './suggest';

const cand = (place_id: string, at: { lat: number | null; lng: number | null } = { lat: null, lng: null }): Candidate => ({
  place_id, name: place_id, address: '', ...at, rating: null, rating_count: null,
});

/** A promise the test resolves when it chooses — for looking at a run mid-flight. */
function later<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

let alert: ReturnType<typeof vi.spyOn>;
let dismiss: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.session = { user: { id: 'u1' } };
  h.city = HANOI;
  h.me = null;
  h.askToSignIn.mockReset();
  h.searchPlaces.mockReset();
  h.knownByPlaceId.mockReset().mockResolvedValue({});
  h.suggestPlace.mockReset();
  h.places.reload.mockReset();
  alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => { alert.mockRestore(); dismiss.mockRestore(); });

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('asking Google', () => {
  it('opens the sign-in sheet for a guest, and asks nobody', async () => {
    h.session = null;
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.askToSignIn).toHaveBeenCalledTimes(1);
    expect(h.askToSignIn).toHaveBeenCalledWith('search');
    expect(h.searchPlaces).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });

  it('searches for a signed-in reader, trimmed, and puts the keyboard away', async () => {
    h.searchPlaces.mockResolvedValue([cand('g1')]);
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('  le vélo '));
    expect(result.current.searching).toBe(true);
    await settle();

    expect(h.searchPlaces).toHaveBeenCalledWith('le vélo', 'hanoi');
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(result.current.results).toEqual([cand('g1')]);
    expect(result.current.searching).toBe(false);
  });

  it('asks nothing of a blank query, or with no city to search in', async () => {
    const { result, rerender } = renderHook(() => useCandidates());
    act(() => result.current.run('   '));
    h.city = null;
    rerender();
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.searchPlaces).not.toHaveBeenCalled();
    expect(h.askToSignIn).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
  });

  it('ignores a second search while the first is out', async () => {
    const first = later<Candidate[]>();
    h.searchPlaces.mockReturnValue(first.promise);
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    act(() => result.current.run('so coffee'));

    expect(h.searchPlaces).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve([cand('g1')]); });
    await settle();
    expect(result.current.searching).toBe(false);
  });

  it('tells "nothing found" ([]) apart from "not searched yet" (null), and blanks between searches', async () => {
    const { result } = renderHook(() => useCandidates());
    expect(result.current.results).toBeNull();

    h.searchPlaces.mockResolvedValueOnce([]);
    act(() => result.current.run('zzz'));
    await settle();
    expect(result.current.results).toEqual([]);

    // A second search clears the first's rows while it is out, rather than
    // leaving answers to the old query under the new one.
    const second = later<Candidate[]>();
    h.searchPlaces.mockReturnValueOnce(second.promise);
    act(() => result.current.run('le vélo'));
    expect(result.current.results).toBeNull();
    await act(async () => { second.resolve([cand('g2')]); });
    await settle();
    expect(result.current.results).toEqual([cand('g2')]);
  });

  it('labels each result with what the catalog knows, asked by place_id', async () => {
    const seen: Record<string, Known> = { g1: { state: 'live', slug: 'le-velo' }, g2: { state: 'mine' } };
    h.searchPlaces.mockResolvedValue([cand('g1'), cand('g2'), cand('g3')]);
    h.knownByPlaceId.mockResolvedValue(seen);
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.knownByPlaceId).toHaveBeenCalledWith(['g1', 'g2', 'g3']);
    expect(result.current.known).toEqual(seen);
  });

  it('still shows the results when asking what is known fails — every row new', async () => {
    h.searchPlaces.mockResolvedValue([cand('g1')]);
    h.knownByPlaceId.mockRejectedValue(new Error('rls'));
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(result.current.results).toEqual([cand('g1')]);
    expect(result.current.known).toEqual({});
    expect(alert).not.toHaveBeenCalled();
  });

  it('answers a refused session with the sheet, not an alert', async () => {
    h.searchPlaces.mockRejectedValue(new SignedOutError());
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.askToSignIn).toHaveBeenCalledTimes(1);
    expect(h.askToSignIn).toHaveBeenCalledWith('search');
    expect(alert).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });

  it('says what to do when anything else fails, never the raw message', async () => {
    h.searchPlaces.mockRejectedValue(new Error('Edge Function returned a non-2xx status code'));
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(alert).toHaveBeenCalledWith(
      'Search failed',
      'Could not reach Google Maps just now. Try again in a moment.',
    );
    expect(JSON.stringify(alert.mock.calls)).not.toContain('non-2xx');
    expect(h.askToSignIn).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });
});

describe('how far away a result is', () => {
  // 0.0045° of latitude north of the reader is 500 m; 0.0275° is 3.1 km.
  const near = cand('near', { lat: 21.0330, lng: 105.8542 });
  const further = cand('further', { lat: 21.0560, lng: 105.8542 });

  it('measures from the reader when they are in the city', () => {
    h.me = { lat: 21.0285, lng: 105.8542 };
    const { result } = renderHook(() => useCandidates());
    expect(result.current.awayFrom(near)).toBe('500 m');
    expect(result.current.awayFrom(further)).toBe('3.1 km');
  });

  it('says nothing for a result Google gave no coordinates for', () => {
    h.me = { lat: 21.0285, lng: 105.8542 };
    const { result } = renderHook(() => useCandidates());
    expect(result.current.awayFrom(cand('x'))).toBe('');
    expect(result.current.awayFrom(cand('x', { lat: 21.03, lng: null }))).toBe('');
    expect(result.current.awayFrom(cand('x', { lat: null, lng: 105.85 }))).toBe('');
  });

  it('says nothing when the reader is somewhere else — 1,143 km is true and useless', () => {
    h.me = { lat: 10.7769, lng: 106.7009 }; // Saigon
    const { result } = renderHook(() => useCandidates());
    expect(result.current.awayFrom(near)).toBe('');
  });

  it('says nothing when where the reader is is not known, or there is no city', () => {
    const { result, rerender } = renderHook(() => useCandidates());
    expect(result.current.awayFrom(near)).toBe('');
    h.me = { lat: 21.0285, lng: 105.8542 };
    h.city = null;
    rerender();
    expect(result.current.awayFrom(near)).toBe('');
  });
});

describe('adding several', () => {
  it('does nothing with an empty selection, or with no city', async () => {
    const { result, rerender } = renderHook(() => useCandidates());
    let out: unknown;
    await act(async () => { out = await result.current.addMany([]); });
    expect(out).toEqual({ done: 0, skipped: 0, failed: 0, held: 0 });

    h.city = null;
    rerender();
    await act(async () => { out = await result.current.addMany([cand('g1')]); });
    expect(out).toEqual({ done: 0, skipped: 0, failed: 0, held: 0 });
    expect(h.suggestPlace).not.toHaveBeenCalled();
    expect(result.current.batch).toEqual(IDLE_BATCH);
  });

  it('gives every outcome the server can return a state of its own, and reloads the catalog once', async () => {
    const outcomes: Record<string, SuggestOutcome> = {
      a: { ok: true, slug: 'a-slug', photos: 3 },
      b: { ok: false, reason: 'already_live', slug: 'b-slug' },
      c: { ok: false, reason: 'already_known' },
      d: { ok: false, reason: 'error', message: 'Google said no' },
      f: { ok: true, slug: 'f-slug', photos: 0 },
    };
    h.suggestPlace.mockImplementation(async (id: string) => {
      if (id === 'e') throw new Error('network');
      return outcomes[id];
    });
    const { result } = renderHook(() => useCandidates());
    const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => cand(id));
    let out: unknown;
    await act(async () => { out = await result.current.addMany(list); });

    expect(h.suggestPlace).toHaveBeenCalledWith('a', 'hanoi');
    expect(out).toEqual({ done: 2, skipped: 2, failed: 2, held: 0 });
    expect(result.current.batch).toEqual({
      running: false,
      total: 6,
      done: 6,
      state: { a: 'done', b: 'skipped', c: 'skipped', d: 'failed', e: 'failed', f: 'done' },
    });
    // A new place carries its slug, so the row can open it; one somebody
    // else suggested is known but carries nothing it cannot open.
    expect(result.current.known).toEqual({
      a: { state: 'mine', slug: 'a-slug' },
      b: { state: 'live', slug: 'b-slug' },
      c: { state: 'mine' },
      f: { state: 'mine', slug: 'f-slug' },
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Could not add it', 'Google said no');
    expect(h.places.reload).toHaveBeenCalledTimes(1);
    expect(result.current.adding).toBeNull();
  });

  it('does not reload the catalog when nothing was added', async () => {
    h.suggestPlace.mockResolvedValue({ ok: false, reason: 'already_known' });
    const { result } = renderHook(() => useCandidates());
    await act(async () => { await result.current.addMany([cand('a')]); });
    expect(h.places.reload).not.toHaveBeenCalled();
  });

  it('holds, rather than fails or tries, everything from the daily cap on', async () => {
    h.suggestPlace
      .mockResolvedValueOnce({ ok: true, slug: 'a-slug', photos: 1 })
      .mockResolvedValueOnce({ ok: false, reason: 'daily_limit', limit: 10 });
    const { result } = renderHook(() => useCandidates());
    let out: unknown;
    await act(async () => {
      out = await result.current.addMany(['a', 'b', 'c', 'd'].map((id) => cand(id)));
    });

    expect(h.suggestPlace).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ done: 1, skipped: 0, failed: 0, held: 3 });
    expect(result.current.batch.state).toEqual({ a: 'done', b: 'held', c: 'held', d: 'held' });
    // Only what was attempted is progress: the refused one was refused
    // before the server looked at it.
    expect(result.current.batch.done).toBe(1);
    expect(result.current.batch.total).toBe(4);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(
      'That is enough for today',
      'You can suggest 10 places a day. Come back tomorrow.',
    );
  });

  it('starts the next run uncapped — tomorrow the same tap works', async () => {
    h.suggestPlace.mockResolvedValueOnce({ ok: false, reason: 'daily_limit', limit: 10 });
    const { result } = renderHook(() => useCandidates());
    await act(async () => { await result.current.addMany([cand('a'), cand('b')]); });

    h.suggestPlace.mockResolvedValue({ ok: true, slug: 's', photos: 0 });
    let out: unknown;
    await act(async () => { out = await result.current.addMany([cand('b')]); });
    expect(out).toEqual({ done: 1, skipped: 0, failed: 0, held: 0 });
    expect(result.current.batch.state).toEqual({ b: 'done' });
  });

  it('marks the rest queued and the one with the server running, one at a time', async () => {
    const first = later<SuggestOutcome>();
    h.suggestPlace.mockReturnValueOnce(first.promise).mockResolvedValue({ ok: true, slug: 's', photos: 0 });
    const { result } = renderHook(() => useCandidates());
    let run!: Promise<unknown>;
    act(() => { run = result.current.addMany([cand('a'), cand('b')]); });
    await settle();

    expect(result.current.batch).toEqual({
      running: true, total: 2, done: 0, state: { a: 'running', b: 'queued' },
    });
    expect(result.current.adding).toBe('a');
    expect(h.suggestPlace).toHaveBeenCalledTimes(1);

    await act(async () => { first.resolve({ ok: true, slug: 'a-slug', photos: 0 }); await run; });
    expect(result.current.batch.running).toBe(false);
    expect(result.current.adding).toBeNull();
  });
});

describe('clear', () => {
  it('puts the results, what is known and the batch back to before the first search', async () => {
    h.searchPlaces.mockResolvedValue([cand('a')]);
    h.knownByPlaceId.mockResolvedValue({ a: { state: 'live', slug: 'x' } });
    h.suggestPlace.mockResolvedValue({ ok: false, reason: 'already_live', slug: 'x' });
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('a'));
    await settle();
    await act(async () => { await result.current.addMany([cand('a')]); });
    expect(result.current.batch.total).toBe(1);

    act(() => result.current.clear());
    expect(result.current.results).toBeNull();
    expect(result.current.known).toEqual({});
    expect(result.current.batch).toEqual(IDLE_BATCH);
  });
});

describe('freshOnly', () => {
  it('keeps only what the catalog has never heard of', () => {
    const known: Record<string, Known> = {
      live: { state: 'live', slug: 'l' },
      mine: { state: 'mine' },
      none: { state: 'none' },
    };
    const list = ['live', 'mine', 'none', 'unasked'].map((id) => cand(id));
    expect(freshOnly(list, known).map((c) => c.place_id)).toEqual(['none', 'unasked']);
  });
});
