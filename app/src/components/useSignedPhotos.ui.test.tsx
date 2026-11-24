// @vitest-environment jsdom
//
// Links for check-in photos: one ask for what is not held, nothing with
// the switch off, a link kept until five minutes short of its hour, and
// nothing shown that came back after the screen went.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../uitest/render';
import type { CheckinPhoto } from '../lib/checkin';

const data = vi.hoisted(() => ({
  signCheckinPhotos: vi.fn(async (paths: readonly string[]): Promise<Record<string, string>> =>
    Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`]))),
}));
vi.mock('../lib/data', () => ({ SIGNED_FOR_S: 3600, signCheckinPhotos: data.signCheckinPhotos }));

import { forgetSignedPhotos, useSignedPhotos } from './useSignedPhotos';

const ph = (id: string): CheckinPhoto => ({ id, path: `u1/k1/${id}.jpg`, width: 1, height: 1 });
const settle = () => act(async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); });

beforeEach(() => { forgetSignedPhotos(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-25T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('useSignedPhotos', () => {
  it('asks once for every path, the same one twice as one, and hands each its link', async () => {
    const { result } = renderHook(() => useSignedPhotos([ph('a'), ph('b'), ph('a')], true));
    expect(result.current(ph('a'))).toBeNull();
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenCalledTimes(1);
    expect(data.signCheckinPhotos).toHaveBeenCalledWith(['u1/k1/a.jpg', 'u1/k1/b.jpg']);
    expect(result.current(ph('a'))).toBe('https://signed/u1/k1/a.jpg');
    expect(result.current(ph('z'))).toBeNull();
  });

  it('asks nothing, and hands nothing, with the switch off — even a link it holds', async () => {
    renderHook(() => useSignedPhotos([ph('x')], false));
    await settle();
    expect(data.signCheckinPhotos).not.toHaveBeenCalled();
    renderHook(() => useSignedPhotos([ph('a')], true));
    await settle();
    const { result } = renderHook(() => useSignedPhotos([ph('a')], false));
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenCalledTimes(1);
    expect(result.current(ph('a'))).toBeNull();
  });

  it('asks nothing for no photos', async () => {
    renderHook(() => useSignedPhotos([], true));
    await settle();
    expect(data.signCheckinPhotos).not.toHaveBeenCalled();
  });

  it('asks only for what it does not hold, and again once a link is within five minutes of its hour', async () => {
    const first = renderHook(() => useSignedPhotos([ph('a')], true));
    await settle();
    first.unmount();
    vi.setSystemTime(new Date('2026-11-25T00:54:00Z'));
    const again = renderHook(({ photos }) => useSignedPhotos(photos, true), { initialProps: { photos: [ph('a'), ph('b')] } });
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenLastCalledWith(['u1/k1/b.jpg']);
    again.unmount();
    vi.setSystemTime(new Date('2026-11-25T00:55:01Z'));
    renderHook(() => useSignedPhotos([ph('a'), ph('b')], true));
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenLastCalledWith(['u1/k1/a.jpg']);
    expect(data.signCheckinPhotos).toHaveBeenCalledTimes(3);
  });

  it('keeps a link that came after the screen went, without drawing to it', async () => {
    let answer!: (links: Record<string, string>) => void;
    data.signCheckinPhotos.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    const { unmount } = renderHook(() => useSignedPhotos([ph('a')], true));
    unmount();
    await act(async () => { answer({ 'u1/k1/a.jpg': 'https://late' }); });
    const { result } = renderHook(() => useSignedPhotos([ph('a')], true));
    expect(result.current(ph('a'))).toBe('https://late');
  });

  it('draws the place, as before, when signing fails', async () => {
    data.signCheckinPhotos.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useSignedPhotos([ph('a')], true));
    await settle();
    expect(result.current(ph('a'))).toBeNull();
  });
});
