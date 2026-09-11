// @vitest-environment jsdom
//
// Who may ask Google, and what they are told when it fails.
//
// `fetch-place` refuses anybody not signed in. Search offered the "Add"
// row to guests anyway, the tap went to the function, and the refusal came
// back as supabase-js's "Edge Function returned a non-2xx status code" in
// an alert. Pinned here: a guest gets the sign-in sheet and no round trip;
// a lapsed session that is refused gets the same sheet; any other failure
// gets a sentence a reader can act on, never the plumbing's message.

import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../uitest/render';

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  askToSignIn: vi.fn(),
  searchPlaces: vi.fn(),
}));

vi.mock('./i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('./auth', () => ({ useAuth: () => ({ session: h.session }) }));
vi.mock('./save', () => ({ useSave: () => ({ askToSignIn: h.askToSignIn }) }));
vi.mock('./city', () => ({
  useCity: () => ({ city: { id: 'hanoi', center_lat: 21, center_lng: 105.8, radius_km: 25 } }),
  useMyPosition: () => null,
}));
vi.mock('./catalog', () => ({ usePlaces: () => ({ data: [], reload: vi.fn() }) }));
vi.mock('./suggest', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  searchPlaces: h.searchPlaces,
  knownByPlaceId: vi.fn(async () => ({})),
}));

import { useCandidates } from './candidates';
import { SignedOutError } from './suggest';

let alert: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.session = { user: { id: 'u1' } };
  h.askToSignIn.mockReset();
  h.searchPlaces.mockReset();
  alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('asking Google', () => {
  it('opens the sign-in sheet for a guest, and asks nobody', async () => {
    h.session = null;
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.askToSignIn).toHaveBeenCalledTimes(1);
    expect(h.searchPlaces).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });

  it('searches for a signed-in reader', async () => {
    h.searchPlaces.mockResolvedValue([{ place_id: 'g1' }]);
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.searchPlaces).toHaveBeenCalledWith('le vélo', 'hanoi');
    expect(result.current.results).toEqual([{ place_id: 'g1' }]);
  });

  it('answers a refused session with the sheet, not an alert', async () => {
    h.searchPlaces.mockRejectedValue(new SignedOutError());
    const { result } = renderHook(() => useCandidates());
    act(() => result.current.run('le vélo'));
    await settle();

    expect(h.askToSignIn).toHaveBeenCalledTimes(1);
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
  });
});
