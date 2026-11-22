// @vitest-environment jsdom
//
// The upload hook on its own, for the paths `GalleryScreen.ui.test.tsx`
// does not walk: the refusals said before the roll opens, a place whose row
// id is not known yet, a photograph small enough to go up unshrunk, and a
// failure that is not an `Error`. The batch, the cover order and the file
// taken back out after a refused row are the screen's tests, where the
// grid that shows them is.
//
// Every refusal is decided by `lib/guide`, which is tested there; what is
// asserted here is that the hook asks it before the roll, names the limit
// in the alert, and opens nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync } from 'expo-image-manipulator';
import { act, renderHook, waitFor } from '../uitest/render';

const state = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  guide: true,
  editor: false,
  counts: { mineHere: 0, mineToday: 0 },
}));
const data = vi.hoisted(() => ({
  fetchMyPhotoCounts: vi.fn(async () => state.counts),
  uploadPlacePhoto: vi.fn(async (_path: string, _body: ArrayBuffer): Promise<string> => 'https://x/p.jpg'),
  addPlacePhoto: vi.fn(async (_row: unknown) => 'photo-new'),
  removePhotoFile: vi.fn(async (_path: string) => {}),
}));

vi.mock('../lib/data', () => data);
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => state.guide, useIsEditor: () => state.editor }));
vi.mock('../lib/auth', () => ({ useSession: () => ({ session: state.uid ? { user: { id: state.uid } } : null }) }));
vi.mock('./ui', () => ({ successHaptic: vi.fn() }));

import { useAddPhoto } from './useAddPhoto';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
const picker = vi.mocked(ImagePicker.launchImageLibraryAsync);
const shrink = vi.mocked(manipulateAsync);
const onAdded = vi.fn();

const mine = { slug: 'cong-caphe', city_id: 'hanoi', submitted_by: 'u1' };

function hook(over: { placeId?: string | null; place?: typeof mine } = {}) {
  return renderHook(() => useAddPhoto({
    place: over.place ?? mine, placeId: over.placeId === undefined ? 'place-uuid' : over.placeId, count: 2, onAdded,
  }));
}

/** The counts the hook reads on mount, settled, so `add` sees them. */
async function settled(over: Parameters<typeof hook>[0] = {}) {
  const h = hook(over);
  if (h.result.current.mayOffer && over.placeId !== null) await waitFor(() => expect(data.fetchMyPhotoCounts).toHaveBeenCalled());
  await act(async () => {});
  return h;
}

const pick = (assets: { width: number; height: number }[]) =>
  picker.mockResolvedValueOnce({ canceled: false, assets: assets.map((a, i) => ({ uri: `file://${i}.jpg`, ...a })) } as never);

beforeEach(() => {
  Object.assign(state, { uid: 'u1', guide: true, editor: false, counts: { mineHere: 0, mineToday: 0 } });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useAddPhoto, refusing before the roll opens', () => {
  it.each([
    ['five on this place', { mineHere: 5, mineToday: 5 }, 'Five photos is the most for one place.'],
    ['ten today', { mineHere: 1, mineToday: 10 }, 'Ten photos a day is the limit.'],
  ])('names the limit when %s are already up', async (_, counts, text) => {
    state.counts = counts;
    const { result } = await settled();
    await act(() => result.current.add());
    expect(alert).toHaveBeenCalledWith(text);
    expect(picker).not.toHaveBeenCalled();
  });

  it('says it is not theirs to someone signed out, and to a guide on somebody else’s place', async () => {
    state.uid = null;
    const out = await settled();
    expect(out.result.current.mayOffer).toBe(false);
    await act(() => out.result.current.add());
    state.uid = 'u1';
    const other = await settled({ place: { ...mine, submitted_by: 'u2' } });
    await act(() => other.result.current.add());

    expect(alert.mock.calls.map((c) => c[0])).toEqual(['This is not yours to add to.', 'This is not yours to add to.']);
    expect(picker).not.toHaveBeenCalled();
  });

  it('refuses an editor nothing, whatever the counts say', async () => {
    Object.assign(state, { editor: true, counts: { mineHere: 9, mineToday: 40 } });
    const { result } = await settled();
    await act(() => result.current.add());
    expect(picker).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('useAddPhoto, after the roll', () => {
  it('uploads nothing before the place’s row id is known, and says so', async () => {
    pick([{ width: 4000, height: 3000 }]);
    const { result } = await settled({ placeId: null });
    await act(() => result.current.add());

    expect(data.fetchMyPhotoCounts).not.toHaveBeenCalled();
    expect(shrink).not.toHaveBeenCalled();
    expect(data.uploadPlacePhoto).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Could not add your photo', 'place_not_found');
    expect(result.current.stage).toBe('idle');
  });

  it('sends a photograph already under the size limit without resizing it', async () => {
    pick([{ width: 1000, height: 800 }]);
    const { result } = await settled();
    await act(() => result.current.add());

    expect(shrink).toHaveBeenCalledWith('file://0.jpg', [], expect.objectContaining({ base64: true }));
    expect(data.addPlacePhoto).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'place-uuid', uid: 'u1', sortOrder: 3 }));
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('says what failed when the failure is not an Error', async () => {
    pick([{ width: 4000, height: 3000 }]);
    data.uploadPlacePhoto.mockRejectedValueOnce('bucket unreachable');
    const { result } = await settled();
    await act(() => result.current.add());

    expect(alert).toHaveBeenCalledWith('Could not add your photo', 'bucket unreachable');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('says the image was unreadable when the resizer hands back no data', async () => {
    pick([{ width: 4000, height: 3000 }]);
    shrink.mockResolvedValueOnce({ uri: 'file://shrunk.jpg', width: 1, height: 1 } as never);
    const { result } = await settled();
    await act(() => result.current.add());

    expect(data.uploadPlacePhoto).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Could not add your photo', 'bad_image');
  });
});
