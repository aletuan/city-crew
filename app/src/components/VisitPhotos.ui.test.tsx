// @vitest-environment jsdom
//
// The photos on a visit, the hook and its row together: what an old
// visit opens on, a photo going up in turn and what a refusal or a lost
// network leaves behind, a retry with the same bytes, a removal asked
// first, and the tile's size on the narrowest phone.

import React, { useEffect } from 'react';
import { Alert, type AlertButton } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync } from 'expo-image-manipulator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../uitest/render';
import { PhotoError, type CheckinPhoto, type PhotoRefusal } from '../lib/checkin';

const data = vi.hoisted(() => ({
  fetchCheckinPhotos: vi.fn(async (_id: string): Promise<CheckinPhoto[]> => []),
  signCheckinPhotos: vi.fn(async (_paths: readonly string[]): Promise<Record<string, string>> => ({})),
  uploadCheckinPhoto: vi.fn(async (_id: string, _image: string): Promise<CheckinPhoto> => ({ id: 'p-new', path: 'u1/k1/p-new.jpg', width: 1200, height: 900 })),
  removeCheckinPhoto: vi.fn(async (_id: string) => {}),
}));
vi.mock('../lib/data', () => data);
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));

import VisitPhotos, { TILE, tileFor } from './VisitPhotos';
import { useVisitPhotos, type VisitPhotos as Photos } from './useVisitPhotos';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
const picker = vi.mocked(ImagePicker.launchImageLibraryAsync);
const shrink = vi.mocked(manipulateAsync);

let hook: Photos;
function Harness({ on = true, known = true, id = 'k1' }: { on?: boolean; known?: boolean; id?: string }) {
  const photos = useVisitPhotos(id, on, known);
  useEffect(() => { hook = photos; });
  return <VisitPhotos photos={photos} />;
}
const show = async (props: Parameters<typeof Harness>[0] = {}) => {
  const r = render(<Harness {...props} />);
  await act(async () => {});
  return r;
};
const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
const pick = (...assets: { width?: number; height?: number }[]) =>
  picker.mockResolvedValueOnce({ canceled: false, assets: assets.map((a, i) => ({ uri: `file://${i}.jpg`, ...a })) } as never);
const states = () => screen.queryAllByTestId(/^visit-photo-(done|sending|failed|hidden)$/).map((el) => el.dataset.testid ?? el.getAttribute('data-testid'));
const add = async () => { fireEvent.click(screen.getByTestId('visit-photos-add')); await flush(); };
const buttons = () => alert.mock.calls.at(-1)![2] as AlertButton[];

const STORED: CheckinPhoto[] = [
  { id: 'p1', path: 'u1/k1/p1.jpg', width: 1200, height: 900 },
  { id: 'p2', path: 'u1/k1/p2.jpg', width: 900, height: 1200, hidden: true },
];

beforeEach(() => {
  data.fetchCheckinPhotos.mockImplementation(async () => []);
  data.signCheckinPhotos.mockImplementation(async () => ({}));
  data.uploadCheckinPhoto.mockImplementation(async () => ({ id: 'p-new', path: 'u1/k1/p-new.jpg', width: 1200, height: 900 }));
  data.removeCheckinPhoto.mockImplementation(async () => {});
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('tileFor', () => {
  it('is 72 wherever four tiles fit between the margins, and shrinks where they do not', () => {
    expect(tileFor(375)).toBe(TILE);
    expect(tileFor(430)).toBe(TILE);
    // The first iPhone SE: 320 less 44 of margin and 30 of gaps, in four.
    expect(tileFor(320)).toBe(61);
  });
});

describe('an old visit', () => {
  it('opens on its photos, signs only the ones not hidden, and leaves room for the rest', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED);
    data.signCheckinPhotos.mockResolvedValueOnce({ 'u1/k1/p1.jpg': 'https://s/p1' });
    await show();
    expect(data.fetchCheckinPhotos).toHaveBeenCalledWith('k1');
    expect(data.signCheckinPhotos).toHaveBeenCalledWith(['u1/k1/p1.jpg']);
    expect(states()).toEqual(['visit-photo-done', 'visit-photo-hidden']);
    const labels = screen.getAllByTestId('visit-photo').map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual(['Photo 1', 'Photo 2 was hidden by City Crew']);
    expect(document.querySelector('img[src="https://s/p1"]')).not.toBeNull();
    expect(hook.room).toBe(1);
    expect(screen.getByTestId('visit-photos-add')).toBeTruthy();
  });
  it('draws a photo the bucket would not sign as an empty tile', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    await show();
    expect(states()).toEqual(['visit-photo-done']);
    expect(document.querySelector('img')).toBeNull();
  });
  it('asks nothing for a fresh visit or with the switch off', async () => {
    await show({ known: false });
    cleanup();
    await show({ on: false });
    expect(data.fetchCheckinPhotos).not.toHaveBeenCalled();
    expect(hook.room).toBe(3);
  });
  it('shows nothing it read after the sheet has gone', async () => {
    let answer!: (rows: CheckinPhoto[]) => void;
    data.fetchCheckinPhotos.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    const { unmount } = await show();
    const last = hook;
    unmount();
    await act(async () => { answer(STORED); });
    expect(last.tiles).toEqual([]);
  });
  it('keeps the photos of the visit it is over when an earlier read answers late', async () => {
    let late!: (rows: CheckinPhoto[]) => void;
    data.fetchCheckinPhotos.mockReturnValueOnce(new Promise((r) => { late = r; }));
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    const { rerender } = await show({ id: 'k1' });
    rerender(<Harness id="k2" />);
    await flush();
    await act(async () => { late(STORED); });
    await flush();
    expect(states()).toEqual(['visit-photo-done']);
  });
  it('opens empty when the read fails', async () => {
    data.fetchCheckinPhotos.mockRejectedValueOnce(new Error('offline'));
    await show();
    expect(states()).toEqual([]);
    expect(hook.room).toBe(3);
  });
});

describe('adding', () => {
  it('opens the roll for as many as there is room for, and does nothing when cancelled', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    await show();
    await add();
    expect(picker).toHaveBeenCalledWith({
      mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: 2, orderedSelection: true,
    });
    expect(states()).toEqual(['visit-photo-done']);
  });
  it('shrinks each photo, sends them one after another, and marks the visit changed', async () => {
    await show();
    // The second upload is held until the first answers.
    let first!: (p: CheckinPhoto) => void;
    data.uploadCheckinPhoto.mockReturnValueOnce(new Promise((r) => { first = r; }));
    pick({ width: 4032, height: 3024 }, { width: 800, height: 600 });
    await add();
    expect(shrink).toHaveBeenNthCalledWith(1, 'file://0.jpg', [{ resize: { width: 1200 } }], { compress: 0.74, format: 'jpeg', base64: true });
    // Already small: re-encoded, not enlarged.
    expect(shrink).toHaveBeenNthCalledWith(2, 'file://1.jpg', [], { compress: 0.74, format: 'jpeg', base64: true });
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
    expect(states()).toEqual(['visit-photo-sending', 'visit-photo-sending']);
    expect(hook.sending).toBe(true);
    expect(hook.changed()).toBe(false);
    // Uploading: no ✕, and the label says so.
    expect(screen.queryAllByTestId('visit-photo-remove')).toHaveLength(0);
    expect(screen.getAllByTestId('visit-photo')[0].getAttribute('aria-label')).toBe('Photo 1, uploading');
    await act(async () => { first({ id: 'p-a', path: 'u1/k1/p-a.jpg', width: 1200, height: 900 }); });
    await flush();
    expect(data.uploadCheckinPhoto).toHaveBeenNthCalledWith(2, 'k1', 'AAAA');
    await act(() => hook.settled());
    expect(states()).toEqual(['visit-photo-done', 'visit-photo-done']);
    expect(hook.sending).toBe(false);
    expect(hook.changed()).toBe(true);
    expect(hook.room).toBe(1);
  });
  it('hides the add tile once three are there, and adds nothing past them', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce([...STORED, { id: 'p3', path: 'u1/k1/p3.jpg', width: 10, height: 10 }]);
    await show();
    expect(screen.queryByTestId('visit-photos-add')).toBeNull();
    await act(() => hook.add());
    expect(picker).not.toHaveBeenCalled();
  });
  it('takes no more than there is room for, whatever the roll hands back', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED);
    await show();
    pick({ width: 10, height: 10 }, { width: 10, height: 10 });
    await add();
    await act(() => hook.settled());
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
    expect(states()).toHaveLength(3);
  });
  it('says a photo the phone could not shrink cannot be used, and drops it', async () => {
    await show();
    shrink.mockRejectedValueOnce(new Error('HEIC'));
    shrink.mockResolvedValueOnce({ uri: 'file://x', width: 1, height: 1 } as never);
    pick({ width: 10, height: 10 }, { width: 10, height: 10 });
    await add();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenCalledWith('Could not add your photo', 'This photo cannot be used. Try another one.');
    expect(states()).toEqual([]);
    expect(data.uploadCheckinPhoto).not.toHaveBeenCalled();
  });

  it.each<[PhotoRefusal, string]>([
    ['full', 'A visit can have 3 photos.'],
    ['day', 'You have added 15 photos today. Add more tomorrow.'],
    ['account', 'You have 300 check-in photos. Remove some old ones to add more.'],
    ['image', 'This photo cannot be used. Try another one.'],
    ['signed_out', 'Sign in again to add photos.'],
  ])('says the %s refusal once and drops the tile', async (why, text) => {
    await show();
    data.uploadCheckinPhoto.mockRejectedValueOnce(new PhotoError(why));
    pick({ width: 10, height: 10 });
    await add();
    await act(() => hook.settled());
    expect(alert).toHaveBeenCalledWith('Could not add your photo', text);
    expect(states()).toEqual([]);
    expect(hook.changed()).toBe(false);
  });

  it('keeps a photo the network lost, and a press sends the same bytes again', async () => {
    await show();
    data.uploadCheckinPhoto.mockRejectedValueOnce(new Error('Network request failed'));
    pick({ width: 10, height: 10 });
    await add();
    await act(() => hook.settled());
    expect(alert).not.toHaveBeenCalled();
    expect(states()).toEqual(['visit-photo-failed']);
    const tile = screen.getByTestId('visit-photo');
    expect(tile.getAttribute('aria-label')).toBe('Photo 1 did not upload. Try again');
    fireEvent.click(tile);
    await act(() => hook.settled());
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(2);
    expect(data.uploadCheckinPhoto).toHaveBeenLastCalledWith('k1', 'AAAA');
    expect(states()).toEqual(['visit-photo-done']);
    expect(hook.changed()).toBe(true);
  });
  it('waits, when asked to settle, for the photo still going up', async () => {
    await show();
    let answer!: (p: CheckinPhoto) => void;
    data.uploadCheckinPhoto.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    pick({ width: 10, height: 10 });
    await add();
    let done = false;
    void hook.settled().then(() => { done = true; });
    // A tile on its way is not sent a second time either.
    act(() => { hook.retry(hook.tiles[0]); });
    await flush();
    expect(done).toBe(false);
    await act(async () => { answer({ id: 'p-a', path: 'u1/k1/p-a.jpg', width: 1, height: 1 }); });
    await flush();
    expect(done).toBe(true);
    expect(data.uploadCheckinPhoto).toHaveBeenCalledTimes(1);
  });
  it('retries only a tile that failed and still has its bytes', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    await show();
    act(() => { hook.retry(hook.tiles[0]); hook.retry({ ...hook.tiles[0], state: 'failed' }); });
    await act(() => hook.settled());
    expect(data.uploadCheckinPhoto).not.toHaveBeenCalled();
  });
});

describe('removing', () => {
  it('drops a photo that never went up without asking', async () => {
    await show();
    data.uploadCheckinPhoto.mockRejectedValueOnce(new Error('offline'));
    pick({ width: 10, height: 10 });
    await add();
    await act(() => hook.settled());
    fireEvent.click(screen.getByTestId('visit-photo-remove'));
    expect(alert).not.toHaveBeenCalled();
    expect(data.removeCheckinPhoto).not.toHaveBeenCalled();
    expect(states()).toEqual([]);
  });
  it('asks first, and Cancel keeps the photo', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    await show();
    fireEvent.click(screen.getByTestId('visit-photo-remove'));
    expect(alert).toHaveBeenCalledWith('Remove this photo?', undefined, expect.any(Array));
    expect(buttons().map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Remove', 'destructive']]);
    expect(buttons()[0].onPress).toBeUndefined();
    expect(data.removeCheckinPhoto).not.toHaveBeenCalled();
    expect(states()).toEqual(['visit-photo-done']);
  });
  it('takes it away on Remove and marks the visit changed', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED);
    await show();
    fireEvent.click(screen.getAllByTestId('visit-photo-remove')[1]);
    await act(async () => { buttons()[1].onPress!(); });
    expect(data.removeCheckinPhoto).toHaveBeenCalledWith('p2');
    expect(states()).toEqual(['visit-photo-done']);
    expect(hook.changed()).toBe(true);
  });
  it('keeps the photo and says so when the removal fails', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED.slice(0, 1));
    data.removeCheckinPhoto.mockRejectedValueOnce(new Error('offline'));
    await show();
    fireEvent.click(screen.getByTestId('visit-photo-remove'));
    await act(async () => { buttons()[1].onPress!(); });
    expect(alert).toHaveBeenLastCalledWith('Could not remove the photo');
    expect(states()).toEqual(['visit-photo-done']);
    expect(hook.changed()).toBe(false);
  });
  it('names each ✕ for its photo', async () => {
    data.fetchCheckinPhotos.mockResolvedValueOnce(STORED);
    await show();
    expect(screen.getAllByTestId('visit-photo-remove').map((el) => el.getAttribute('aria-label'))).toEqual(['Remove photo 1', 'Remove photo 2']);
  });
});
