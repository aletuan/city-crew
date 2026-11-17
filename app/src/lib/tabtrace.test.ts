import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
// `./channel` reads expo-updates on the way in, which a Node process has
// no native half for. Not production here; the test that matters loads
// the module a second time against a channel that is.
vi.mock('./channel', () => ({ CHANNEL: null, IS_PRODUCTION_CHANNEL: false }));

import {
  buildTabRow, makeTabReporter, makeTabTrace, QUIET_MS, sendTabRow,
  TAB_TRACE, TAB_TRACE_UPLOAD, tabLine, tabSettled, tabTrace,
  type TabRow, type TabSwitch,
} from './tabtrace';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const DEVICE = { platform: 'ios', osVersion: '26.3', isDev: false, channel: null };
const sw = (over: Partial<TabSwitch> = {}): TabSwitch => ({
  from: 'Explore', to: 'Trips', first: true, still: false, press: 84, commit: 131, frame: 150, settle: 512, ...over,
});

/** A clock and a frame the test winds by hand, so every figure below is
 *  one this file chose. `frame()` runs whatever was waiting for one. */
const bench = (cap?: number) => {
  let t = 10_000;
  let waiting: (() => void)[] = [];
  const sink = vi.fn();
  const trace = makeTabTrace(true, () => t, (then) => { waiting.push(then); }, sink, cap);
  return {
    trace,
    sink,
    wind: (by: number) => { t += by; },
    frame: () => { const run = waiting; waiting = []; run.forEach((f) => f()); },
  };
};

/** One whole switch, with the four gaps a test names. */
const journey = (b: ReturnType<typeof bench>, from: string, to: string, gaps = [84, 47, 19, 362]) => {
  b.trace.down(from, to);
  b.wind(gaps[0]);
  b.trace.press();
  b.wind(gaps[1]);
  b.trace.commit(to, false);
  b.wind(gaps[2]);
  b.frame();
  b.wind(gaps[3]);
  b.trace.settle(true);
};

describe('makeTabTrace', () => {
  it('measures press, commit, frame and settle from the finger coming down', () => {
    const b = bench();
    journey(b, 'Explore', 'Trips');
    expect(b.trace.drain()).toEqual([
      { from: 'Explore', to: 'Trips', first: true, still: false, press: 84, commit: 131, frame: 150, settle: 512 },
    ]);
  });

  // The hypothesis this file exists to test is that a first visit costs
  // more than a second, so a row has to be able to tell them apart.
  it('calls a tab’s first showing first, and its second not', () => {
    const b = bench();
    journey(b, 'Explore', 'Trips');
    journey(b, 'Trips', 'Explore');
    journey(b, 'Explore', 'Trips');
    expect(b.trace.drain().map((s) => [s.to, s.first])).toEqual([
      ['Trips', true],
      // Where the reader started was showing before anything was pressed.
      ['Explore', false],
      ['Trips', false],
    ]);
  });

  // The guide walks the reader to Collections with no press. That is not
  // a switch to time, but the tab has been shown, and the press that
  // comes later is not its first visit.
  it('knows a tab was shown by a switch nobody pressed for, and does not time that one', () => {
    const b = bench();
    b.trace.commit('Collections', false);
    b.trace.settle(true);
    expect(b.trace.drain()).toEqual([]);
    journey(b, 'Explore', 'Collections');
    expect(b.trace.drain()[0].first).toBe(false);
  });

  it('does not time a navigation from a touch that never became a press', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.wind(9_000);
    b.trace.commit('Trips', false);
    b.trace.settle(true);
    expect(b.trace.drain()).toEqual([]);
  });

  it('does not time a navigation to some other tab than the one pressed', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.trace.press();
    b.trace.commit('Profile', false);
    b.trace.settle(true);
    expect(b.trace.drain()).toEqual([]);
  });

  it('drops a touch that slid off the cell when the next one lands', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.wind(500);
    journey(b, 'Explore', 'Profile');
    expect(b.trace.drain().map((s) => s.to)).toEqual(['Profile']);
  });

  // The animation's end callback fires for a journey cut short, and it
  // fires after the next one has committed. Taken at its word it would
  // close the wrong switch at once.
  it('keeps an interrupted switch with no settle, and does not let its end close the next', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.wind(80);
    b.trace.press();
    b.wind(40);
    b.trace.commit('Trips', false);
    b.wind(100);
    b.trace.down('Trips', 'Profile');
    b.wind(70);
    b.trace.press();
    b.wind(30);
    b.trace.commit('Profile', false);
    b.trace.settle(false);
    b.wind(400);
    b.trace.settle(true);
    expect(b.trace.drain()).toEqual([
      expect.objectContaining({ to: 'Trips', commit: 120, settle: null }),
      expect.objectContaining({ to: 'Profile', press: 70, commit: 100, settle: 500 }),
    ]);
  });

  // A frame that comes after the next press has restarted the clock is
  // still the first switch's frame, on the first switch's clock.
  it('times a late frame on the clock of the switch it belongs to', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.trace.press();
    b.trace.commit('Trips', false);
    b.wind(200);
    b.trace.down('Trips', 'Profile');
    b.wind(50);
    b.frame();
    expect(b.trace.drain()[0]).toEqual(expect.objectContaining({ to: 'Trips', frame: 250 }));
  });

  it('takes the first press and the first commit, not a repeat of either', () => {
    const b = bench();
    b.trace.down('Explore', 'Trips');
    b.wind(80);
    b.trace.press();
    b.wind(40);
    b.trace.press();
    b.trace.commit('Trips', true);
    b.wind(40);
    b.trace.commit('Trips', false);
    b.trace.settle(true);
    expect(b.trace.drain()[0]).toEqual(expect.objectContaining({ press: 80, commit: 120, still: true }));
  });

  it('ignores a press and an end with no touch before them', () => {
    const b = bench();
    b.trace.press();
    b.trace.settle(true);
    expect(b.trace.drain()).toEqual([]);
  });

  it('hands over what is waiting once, and starts again empty', () => {
    const b = bench();
    journey(b, 'Explore', 'Trips');
    expect(b.trace.drain()).toHaveLength(1);
    expect(b.trace.drain()).toEqual([]);
  });

  it('stops keeping at the cap rather than growing without bound', () => {
    const b = bench(2);
    journey(b, 'Explore', 'Trips');
    journey(b, 'Trips', 'Explore');
    journey(b, 'Explore', 'Trips');
    expect(b.trace.drain()).toHaveLength(2);
    expect(b.sink).toHaveBeenCalledTimes(2);
  });

  it('says each finished switch out loud', () => {
    const b = bench();
    journey(b, 'Explore', 'Trips');
    expect(b.sink).toHaveBeenCalledWith('[tab] Explore→Trips first press 84 commit 131 frame 150 settle 512');
    expect(tabLine(sw({ first: false, settle: null }))).toBe('[tab] Explore→Trips press 84 commit 131 frame 150 settle null');
  });

  it('disabled, it records nothing, asks for no frame and says nothing', () => {
    const sink = vi.fn();
    const nextFrame = vi.fn();
    const trace = makeTabTrace(false, () => 0, nextFrame, sink);
    trace.down('Explore', 'Trips');
    trace.press();
    trace.commit('Trips', false);
    trace.settle(true);
    expect(trace.drain()).toEqual([]);
    expect(nextFrame).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('buildTabRow', () => {
  it('carries the switches and which build filed them', () => {
    expect(buildTabRow([sw()], { ...DEVICE, channel: 'preview' })).toEqual({
      platform: 'ios', os_version: '26.3', is_dev: false, channel: 'preview', switches: [sw()],
    });
  });

  it('has nothing to say when nothing was pressed', () => {
    expect(buildTabRow([], DEVICE)).toBeNull();
  });
});

/** A timer the test fires by hand. */
const timers = () => {
  const set: { then: () => void; ms: number; live: boolean }[] = [];
  return {
    set,
    later: (then: () => void, ms: number) => set.push({ then, ms, live: true }) - 1,
    cancel: (handle: number) => { set[handle].live = false; },
    fire: () => set.filter((x) => x.live).forEach((x) => { x.live = false; x.then(); }),
  };
};

describe('makeTabReporter', () => {
  it('sends once the bar has been quiet, not before', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    makeTabReporter(true, send, t.later, t.cancel).soon(() => [sw()], DEVICE);
    expect(send).not.toHaveBeenCalled();
    expect(t.set[0].ms).toBe(QUIET_MS);
    t.fire();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ switches: [sw()] }));
  });

  // A reader walking the five tabs files one row when they stop.
  it('puts the send off each time the bar moves again', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    const r = makeTabReporter(true, send, t.later, t.cancel);
    r.soon(() => [sw()], DEVICE);
    r.soon(() => [sw()], DEVICE);
    r.soon(() => [sw()], DEVICE);
    expect(t.set.map((x) => x.live)).toEqual([false, false, true]);
    t.fire();
    expect(send).toHaveBeenCalledOnce();
  });

  it('asks for the switches when it sends, not when it was asked', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    let waiting = [sw()];
    makeTabReporter(true, send, t.later, t.cancel).soon(() => waiting, DEVICE);
    waiting = [sw(), sw({ to: 'Profile' })];
    t.fire();
    expect(send.mock.calls[0][0].switches).toHaveLength(2);
  });

  it('sends nothing for a quiet moment with nothing waiting, and does not spend a row on it', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    const r = makeTabReporter(true, send, t.later, t.cancel, 1);
    r.soon(() => [], DEVICE);
    t.fire();
    expect(send).not.toHaveBeenCalled();
    r.soon(() => [sw()], DEVICE);
    t.fire();
    expect(send).toHaveBeenCalledOnce();
  });

  it('stops at its allowance of rows for one run of the app', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    const r = makeTabReporter(true, send, t.later, t.cancel, 2);
    for (let i = 0; i < 5; i++) { r.soon(() => [sw()], DEVICE); t.fire(); }
    expect(send).toHaveBeenCalledTimes(2);
    expect(t.set).toHaveLength(2);
  });

  it('a refused send surfaces nowhere', async () => {
    const send = vi.fn((_row: TabRow) => Promise.reject(new Error('rls said no')));
    const t = timers();
    makeTabReporter(true, send, t.later, t.cancel).soon(() => [sw()], DEVICE);
    t.fire();
    await Promise.resolve();
    expect(send).toHaveBeenCalledOnce();
  });

  it('disabled, it sets no timer and sends nothing', () => {
    const send = vi.fn((_row: TabRow) => Promise.resolve());
    const t = timers();
    makeTabReporter(false, send, t.later, t.cancel).soon(() => [sw()], DEVICE);
    expect(t.set).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('tabSettled', () => {
  it('closes the switch and asks for a row with what is then waiting', () => {
    const b = bench();
    const soon = vi.fn();
    const settled = tabSettled(DEVICE, b.trace, { soon });
    b.trace.down('Explore', 'Trips');
    b.trace.press();
    b.trace.commit('Trips', false);
    b.wind(300);
    settled({ finished: true });
    expect(soon).toHaveBeenCalledWith(b.trace.drain, DEVICE);
    expect(b.trace.drain()).toEqual([expect.objectContaining({ settle: 300 })]);
  });

  // An interrupted journey still means the bar is moving: the send is put
  // off again, and the switch is left for `down` to have closed.
  it('passes on that a journey was cut short', () => {
    const b = bench();
    const soon = vi.fn();
    b.trace.down('Explore', 'Trips');
    b.trace.press();
    b.trace.commit('Trips', false);
    tabSettled(DEVICE, b.trace, { soon })({ finished: false });
    expect(soon).toHaveBeenCalledOnce();
    expect(b.trace.drain()).toEqual([]);
  });
});

describe('the app’s own pair', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('reports on a build the policy allows', () => {
    expect(TAB_TRACE).toBe(true);
    expect(TAB_TRACE_UPLOAD).toBe(true);
  });

  /**
   * The one that matters — `decktrace.test.ts` has the long form of why.
   * `lib/legal` promises that the App Store build sends no diagnostics,
   * and asserting `true` under this file's mock proves nothing about a
   * hand-flipped literal. Loading the module against a production channel
   * is the only arrangement where one shows.
   */
  it('is silent on the build the policy says is silent', async () => {
    vi.resetModules();
    vi.doMock('./channel', () => ({ CHANNEL: 'production', IS_PRODUCTION_CHANNEL: true }));
    try {
      const shipped = await import('./tabtrace');
      expect(shipped.TAB_TRACE).toBe(false);
      expect(shipped.TAB_TRACE_UPLOAD).toBe(false);
    } finally {
      vi.doUnmock('./channel');
      vi.resetModules();
    }
  });

  it('records through the singleton and files the row into tab_traces after the quiet', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (then: () => void) => { then(); return 0; });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fake().replies({ data: null, error: null });
    const settled = tabSettled({ platform: 'android', osVersion: '35', isDev: true, channel: 'preview' });
    tabTrace.down('Explore', 'Trips');
    tabTrace.press();
    tabTrace.commit('Trips', false);
    settled({ finished: true });
    settled({ finished: false });
    expect(fake().log).toEqual([]);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(fake().log).toEqual([
      expect.objectContaining({
        table: 'tab_traces',
        op: 'insert',
        payload: expect.objectContaining({
          platform: 'android', is_dev: true, channel: 'preview',
          switches: [expect.objectContaining({ from: 'Explore', to: 'Trips', first: true })],
        }),
      }),
    ]);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[tab\] Explore→Trips first /));
  });

  it('a refusal becomes a rejection, for the reporter to swallow', async () => {
    fake().replies({ data: null, error: { message: 'no such table' } });
    await expect(sendTabRow(buildTabRow([sw()], DEVICE)!)).rejects.toThrow('no such table');
  });
});
