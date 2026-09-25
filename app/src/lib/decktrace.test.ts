import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
// `./supabase` reads the channel on the way in, and that read touches
// expo-updates, which a Node process has no native half for. The two
// switches no longer ask it — see `DECK_TRACE` on why they are hand-held
// on — so this only has to keep the import chain standing.
vi.mock('./channel', () => ({ CHANNEL: null, IS_PRODUCTION_CHANNEL: false }));

import {
  buildDeckRow, deckLine, DECK_TRACE, DECK_TRACE_UPLOAD, deckTrace,
  makeDeckReporter, makeDeckTrace, reportDeck, sendDeckRow,
  type DeckEvent, type DeckRow,
} from './decktrace';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const DEVICE = { platform: 'ios', osVersion: '18.1', isDev: false, channel: 'preview' };
const SHAPE = { options: 3, span: 3, still: false };
const ev = (ms: number, over: Partial<DeckEvent> = {}): DeckEvent => ({
  ms, option: 0, slot: 0, what: 'ask', place: 'cong-cafe', ...over,
});

/** A clock the test winds by hand, so every elapsed figure below is one
 *  this file chose rather than one the machine happened to take. */
const clockFrom = (start: number) => {
  let t = start;
  return { now: () => t, wind: (by: number) => { t += by; } };
};

describe('makeDeckTrace', () => {
  it('measures each event from the moment the visit started', () => {
    const c = clockFrom(5_000);
    const trace = makeDeckTrace(true, c.now, () => {});
    trace.start();
    c.wind(2400);
    trace.log({ option: 1, slot: 0, what: 'ask', place: 'cong-cafe' });
    c.wind(60);
    trace.log({ option: 1, slot: 0, what: 'load', place: 'cong-cafe' });
    expect(trace.events()).toEqual([
      { ms: 2400, option: 1, slot: 0, what: 'ask', place: 'cong-cafe' },
      { ms: 2460, option: 1, slot: 0, what: 'load', place: 'cong-cafe' },
    ]);
  });

  // The difference from `makeTrace`, which keeps the first of each name:
  // here the repeats are the measurement. Three plans across three boxes
  // pass the same checkpoints nine times and all nine matter.
  it('keeps every repeat of a checkpoint, where the launch trace keeps one', () => {
    const c = clockFrom(0);
    const trace = makeDeckTrace(true, c.now, () => {});
    trace.start();
    for (const option of [0, 1, 2]) {
      c.wind(100);
      trace.log({ option, slot: 0, what: 'ask', place: 'a' });
    }
    expect(trace.events().map((e) => e.option)).toEqual([0, 1, 2]);
  });

  // Two visits to the screen must not share a clock, or the second one's
  // figures are measured from the first one's arrival.
  it('starts the clock again, and empty, for a second visit', () => {
    const c = clockFrom(0);
    const trace = makeDeckTrace(true, c.now, () => {});
    trace.start();
    c.wind(900);
    trace.log({ option: 0, slot: 0, what: 'ask', place: 'a' });
    c.wind(50_000);
    trace.start();
    c.wind(120);
    trace.log({ option: 0, slot: 0, what: 'ask', place: 'b' });
    expect(trace.events()).toEqual([
      { ms: 120, option: 0, slot: 0, what: 'ask', place: 'b' },
    ]);
  });

  it('stops recording at the cap rather than growing without bound', () => {
    const trace = makeDeckTrace(true, () => 0, () => {}, 3);
    trace.start();
    for (let i = 0; i < 10; i++) trace.log({ option: 0, slot: i, what: 'ask', place: 'a' });
    expect(trace.events()).toHaveLength(3);
  });

  it('disabled, it neither records nor says anything', () => {
    const sink = vi.fn();
    const trace = makeDeckTrace(false, () => 0, sink);
    trace.start();
    trace.log({ option: 0, slot: 0, what: 'ask', place: 'a' });
    expect(trace.events()).toEqual([]);
    expect(sink).not.toHaveBeenCalled();
  });

  it('says each event out loud as it records it', () => {
    const sink = vi.fn();
    const trace = makeDeckTrace(true, () => 0, sink);
    trace.start();
    trace.log({ option: 2, slot: 1, what: 'load', place: 'cong-cafe' });
    expect(sink).toHaveBeenCalledWith('[deck] 0ms opt2 #1 load cong-cafe');
  });

  it('names the deck’s own events without a box or a place', () => {
    expect(deckLine(ev(1800, { slot: null, what: 'option', place: null, option: 1 })))
      .toBe('[deck] 1800ms opt1 option');
  });
});

describe('buildDeckRow', () => {
  it('carries the timeline, what the deck was asked to show, and the last ms', () => {
    const row = buildDeckRow([ev(0, { what: 'option', slot: null, place: null }), ev(2460, { what: 'load' })], SHAPE, DEVICE);
    expect(row).toEqual({
      platform: 'ios',
      os_version: '18.1',
      is_dev: false,
      channel: 'preview',
      options: 3,
      span: 3,
      still: false,
      total_ms: 2460,
      events: [
        { ms: 0, option: 0, slot: null, what: 'option', place: null },
        { ms: 2460, option: 0, slot: 0, what: 'load', place: 'cong-cafe' },
      ],
    });
  });

  // Reduce Motion turns the dissolve off entirely, so a row recorded
  // under it is not evidence about the animation and has to say so.
  it('records that the reader had asked for less motion', () => {
    expect(buildDeckRow([ev(5)], { ...SHAPE, still: true }, DEVICE)!.still).toBe(true);
  });

  it('has nothing to say about a visit that recorded nothing', () => {
    expect(buildDeckRow([], SHAPE, DEVICE)).toBeNull();
  });

  // Which build filed the row is the question the two hand-held switches
  // above turn on, and it has been inferred twice and got wrong once. A
  // build with no stamp — Expo Go, a bare dev build — says so rather than
  // being given a word invented for it.
  it('carries the channel, and null where a build has no stamp', () => {
    expect(buildDeckRow([ev(5)], SHAPE, { ...DEVICE, channel: null })!.channel).toBeNull();
  });
});

describe('makeDeckReporter', () => {
  it('sends once per visit; every later call is a no-op', () => {
    const send = vi.fn(() => Promise.resolve());
    const r = makeDeckReporter(true, send);
    r.report([ev(5)], SHAPE, DEVICE);
    r.report([ev(5), ev(9)], SHAPE, DEVICE);
    expect(send).toHaveBeenCalledOnce();
  });

  // Where this differs from the launch reporter, which files once per
  // process: the launch happens once and this screen can be opened again.
  it('sends again once a new visit has reset it', () => {
    const send = vi.fn(() => Promise.resolve());
    const r = makeDeckReporter(true, send);
    r.report([ev(5)], SHAPE, DEVICE);
    r.reset();
    r.report([ev(9)], SHAPE, DEVICE);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('disabled, it sends nothing at all', () => {
    const send = vi.fn(() => Promise.resolve());
    makeDeckReporter(false, send).report([ev(5)], SHAPE, DEVICE);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not spend its one send on an empty timeline', () => {
    const send = vi.fn(() => Promise.resolve());
    const r = makeDeckReporter(true, send);
    r.report([], SHAPE, DEVICE);
    r.report([ev(5)], SHAPE, DEVICE);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ total_ms: 5 }));
  });

  it('a refused send surfaces nowhere and is not retried', async () => {
    const send = vi.fn((_row: DeckRow) => Promise.reject(new Error('rls said no')));
    const r = makeDeckReporter(true, send);
    r.report([ev(5)], SHAPE, DEVICE);
    await Promise.resolve();
    r.report([ev(5)], SHAPE, DEVICE);
    expect(send).toHaveBeenCalledOnce();
  });
});

describe('the app’s own pair', () => {
  it('reports on a build the policy allows', () => {
    expect(DECK_TRACE).toBe(true);
    expect(DECK_TRACE_UPLOAD).toBe(true);
  });

  /**
   * The one that matters, and the one the assertion above cannot make.
   *
   * `lib/legal` promises a reader, in the policy they can open, that the
   * App Store build "sends no diagnostics or usage analytics of any
   * kind". For a day these two constants were hand-flipped to `true` to
   * get numbers off a production build, and it did.
   *
   * Asserting `true` under the file's non-production mock proves
   * nothing: a hand-flipped literal passes it too. So this one loads the
   * module against a production channel, which is the only arrangement
   * where a literal `true` shows up as what it is.
   *
   * Anything that needs these on in an App Store build needs `lib/legal`
   * changed first, in the same commit. This test is where that argument
   * has to be had.
   */
  it('is silent on the build the policy says is silent', async () => {
    vi.resetModules();
    vi.doMock('./channel', () => ({ CHANNEL: 'production', IS_PRODUCTION_CHANNEL: true }));
    try {
      const shipped = await import('./decktrace');
      expect(shipped.DECK_TRACE).toBe(false);
      expect(shipped.DECK_TRACE_UPLOAD).toBe(false);
    } finally {
      vi.doUnmock('./channel');
      vi.resetModules();
    }
  });

  it('records through the singleton and files the row into deck_traces', async () => {
    fake().replies({ data: null, error: null });
    deckTrace.start();
    deckTrace.log({ option: 0, slot: null, what: 'option', place: null });
    reportDeck.reset();
    reportDeck.report(deckTrace.events(), SHAPE,
      { platform: 'android', osVersion: '35', isDev: true, channel: 'production' });
    await Promise.resolve();
    expect(fake().log).toEqual([
      expect.objectContaining({
        table: 'deck_traces',
        op: 'insert',
        payload: expect.objectContaining({
          platform: 'android', is_dev: true, options: 3, channel: 'production',
        }),
      }),
    ]);
  });

  it('a refusal becomes a rejection, for the reporter to swallow', async () => {
    fake().replies({ data: null, error: { message: 'no such table' } });
    await expect(sendDeckRow(buildDeckRow([ev(5)], SHAPE, DEVICE)!)).rejects.toThrow('no such table');
  });
});
