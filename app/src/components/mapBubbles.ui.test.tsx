// @vitest-environment jsdom
//
// What colours the bubbles, and what the crosshair does to the camera.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '../uitest/render';
import { CATEGORIES } from '../lib/categories';
import { MapCorner, useClusterTint } from './mapBubbles';

const acc = vi.hoisted(() => ({ light: '#1F7A63', dark: '#3DBE9A' }));
vi.mock('../theme', async (orig) => ({ ...(await orig<typeof import('../theme')>()), accentHex: acc }));

describe('useClusterTint', () => {
  it('is the pin colour of the one category chosen', () => {
    const { result } = renderHook(() => useClusterTint(['eats']));
    expect(result.current).toEqual({ tint: { pin: CATEGORIES.eats.pin }, tintKey: CATEGORIES.eats.pin });
  });

  it('is the look\'s accent hue with none chosen, or with several', () => {
    const none = renderHook(() => useClusterTint([])).result.current;
    const two = renderHook(() => useClusterTint(['eats', 'cafes'])).result.current;
    expect(none.tint).toEqual({ hue: expect.closeTo(165, -1) });
    expect(two).toEqual(none);
    expect(none.tintKey).toMatch(/^h\d+$/);
  });

  it('is grey when the accent has no hue to give', () => {
    acc.light = '#808080'; acc.dark = '#808080';
    expect(renderHook(() => useClusterTint([])).result.current).toEqual({ tint: null, tintKey: 'grey' });
    acc.light = '#1F7A63'; acc.dark = '#3DBE9A';
  });
});

describe('MapCorner', () => {
  const camera = () => ({ getCamera: vi.fn().mockResolvedValue({ zoom: 12 }), animateCamera: vi.fn() });
  const press = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'My location' })); }); };

  it('puts the map on the reader at the neighbourhood zoom', async () => {
    const cam = camera();
    render(<MapCorner map={{ current: cam }} still={false} onLocate={async () => ({ lat: 10.8, lng: 106.7 })} />);
    await press();
    expect(cam.animateCamera).toHaveBeenCalledWith({ center: { latitude: 10.8, longitude: 106.7 }, zoom: 15 }, { duration: 400 });
  });

  it('keeps a zoom that already shows more, and goes at once for a reader who asked for less motion', async () => {
    const cam = camera();
    cam.getCamera.mockResolvedValue({ zoom: 17 });
    render(<MapCorner map={{ current: cam }} still onLocate={async () => ({ lat: 1, lng: 2 })} />);
    await press();
    expect(cam.animateCamera).toHaveBeenCalledWith({ center: { latitude: 1, longitude: 2 }, zoom: 17 }, { duration: 0 });
  });

  it('takes the neighbourhood zoom when the map cannot say its own', async () => {
    const cam = { animateCamera: vi.fn() };
    render(<MapCorner map={{ current: cam }} still={false} onLocate={async () => ({ lat: 1, lng: 2 })} />);
    await press();
    expect(cam.animateCamera.mock.calls[0][0].zoom).toBe(15);
  });

  it('does not move the map when there is no position, or no map yet', async () => {
    const cam = camera();
    const { rerender } = render(<MapCorner map={{ current: cam }} still={false} onLocate={async () => null} />);
    await press();
    expect(cam.animateCamera).not.toHaveBeenCalled();
    rerender(<MapCorner map={{ current: null }} still={false} onLocate={async () => ({ lat: 1, lng: 2 })} />);
    await press();
    expect(cam.animateCamera).not.toHaveBeenCalled();
  });

  it('has no crosshair without something to ask', () => {
    render(<MapCorner map={{ current: null }} still={false} />);
    expect(screen.queryByRole('button', { name: 'My location' })).toBeNull();
  });
});
