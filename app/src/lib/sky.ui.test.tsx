// @vitest-environment jsdom
//
// The weather above Explore's date: one request per city per half hour,
// the old reading shown while a new one is fetched, and nothing at all —
// no spinner, no dash — when there is no answer. How a reply becomes a
// `Sky` is `weather.ts`'s, held at 100% in Node; what is left here is the
// clock, the cache and the network.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '../uitest/render';
import type { Sky } from './weather';

// Open-Meteo's `current` block, which `parseSky` reads.
const reply = (temperature: number) => ({
  current: { temperature_2m: temperature, weather_code: 0, is_day: 1 },
});

let fetchMock: ReturnType<typeof vi.fn>;
let seen: Sky | null = null;

// A fresh module per test: the cache is module-level on purpose (it
// outlives a tab switch), which also means it outlives a test.
async function load() {
  vi.resetModules();
  const { useSky } = await import('./sky');
  const Where = ({ lat, lng }: { lat?: number; lng?: number }) => {
    seen = useSky(lat, lng);
    return null;
  };
  return Where;
}

beforeEach(() => {
  seen = null;
  // The clock only: `waitFor` polls on real timers. The one test about the
  // six-second cap takes the timers too.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
  fetchMock = vi.fn(async () => ({ json: async () => reply(31) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const temp = () => (seen as { temp?: number } | null)?.temp;

describe('the sky over a city', () => {
  it('asks Open-Meteo about the coordinates it was given, and shows the answer', async () => {
    const Where = await load();
    render(<Where lat={21.03} lng={105.85} />);
    await waitFor(() => expect(temp()).toBe(31));
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('latitude=21.03');
    expect(url).toContain('longitude=105.85');
  });

  it('is nothing, and asks nothing, without coordinates', async () => {
    const Where = await load();
    render(<Where />);
    await act(async () => { await Promise.resolve(); });
    expect(seen).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks once per half hour, however often the screen comes back', async () => {
    const Where = await load();
    const first = render(<Where lat={21.03} lng={105.85} />);
    await waitFor(() => expect(temp()).toBe(31));
    first.unmount();
    // A tab switch later, the answer is there at once and nothing is asked.
    render(<Where lat={21.03} lng={105.85} />);
    expect(temp()).toBe(31);
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('shows the old reading while a stale one is refreshed, then the new', async () => {
    const Where = await load();
    const first = render(<Where lat={21.03} lng={105.85} />);
    await waitFor(() => expect(temp()).toBe(31));
    first.unmount();

    vi.setSystemTime(new Date('2026-09-28T09:31:00Z'));
    fetchMock.mockImplementationOnce(async () => ({ json: async () => reply(27) }));
    render(<Where lat={21.03} lng={105.85} />);
    // No flicker to empty: the hour-old number stands until the new lands.
    expect(temp()).toBe(31);
    await waitFor(() => expect(temp()).toBe(27));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a city’s reading to that city', async () => {
    const Where = await load();
    const view = render(<Where lat={21.03} lng={105.85} />);
    await waitFor(() => expect(temp()).toBe(31));
    fetchMock.mockImplementationOnce(async () => ({ json: async () => reply(24) }));
    view.rerender(<Where lat={16.05} lng={108.2} />);
    await waitFor(() => expect(temp()).toBe(24));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The same screen, the city switched back: what shows at once is this
  // city's last reading, not the other city's number under this one's name.
  it('shows a city’s own last reading at once when switched back to it', async () => {
    const Where = await load();
    const view = render(<Where lat={21.03} lng={105.85} />);
    await waitFor(() => expect(temp()).toBe(31));
    fetchMock.mockImplementationOnce(async () => ({ json: async () => reply(24) }));
    view.rerender(<Where lat={16.05} lng={108.2} />);
    await waitFor(() => expect(temp()).toBe(24));

    vi.setSystemTime(new Date('2026-09-28T09:31:00Z'));
    let land: (v: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => { land = r; }));
    view.rerender(<Where lat={21.03} lng={105.85} />);
    await act(async () => { await Promise.resolve(); });
    expect(temp()).toBe(31);
    await act(async () => { land({ json: async () => reply(29) }); await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(temp()).toBe(29));
  });

  // Decoration, not content: a failed or unreadable answer draws nothing,
  // and a missed reading is not retried — the next visit asks again.
  it('stays nothing when the request fails, or the answer is unreadable', async () => {
    const Where = await load();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const view = render(<Where lat={21.03} lng={105.85} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(seen).toBeNull();
    fetchMock.mockImplementationOnce(async () => ({ json: async () => ({ nonsense: true }) }));
    view.rerender(<Where lat={16.05} lng={108.2} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(seen).toBeNull();
  });

  it('gives up after six seconds', async () => {
    // Re-installed rather than widened: a second `useFakeTimers` on top of
    // the first keeps the first one's list of what is faked.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const Where = await load();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => {
      signal = init.signal;
      return new Promise(() => {});
    });
    render(<Where lat={21.03} lng={105.85} />);
    expect(signal!.aborted).toBe(false);
    act(() => { vi.advanceTimersByTime(5999); });
    expect(signal!.aborted).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(signal!.aborted).toBe(true);
  });

  it('abandons the request when the screen goes', async () => {
    const Where = await load();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => {
      signal = init.signal;
      return new Promise(() => {});
    });
    const view = render(<Where lat={21.03} lng={105.85} />);
    view.unmount();
    expect(signal!.aborted).toBe(true);
  });
});
