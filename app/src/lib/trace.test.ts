import { describe, expect, it, vi } from 'vitest';

// The channel read touches expo-updates, which a Node process has no
// native half for — same stand-in tracereport.test.ts uses. Non-production
// here, so the singleton imported below is the logging one.
vi.mock('./channel', () => ({ CHANNEL: null, IS_PRODUCTION_CHANNEL: false }));

import { makeTrace, startupTrace, traceLine } from './trace';

describe('traceLine', () => {
  it('shows the running total and the gap since the previous mark', () => {
    expect(traceLine('cities:fetched', 812, 640)).toBe('[startup] 812ms (+640) cities:fetched');
  });
});

describe('makeTrace', () => {
  // A clock that can be stepped by hand, so every delta is exact.
  const clockAt = (times: number[]) => {
    let i = 0;
    return () => times[Math.min(i++, times.length - 1)];
  };

  it('logs each mark against its own start, first gap included', () => {
    const lines: string[] = [];
    const t = makeTrace(true, clockAt([1000, 1050, 1200]), (l) => lines.push(l));
    t.mark('a');
    t.mark('b');
    expect(lines).toEqual([
      // The first mark's gap is the gap since the clock started — there is
      // no previous mark, and "since start" is the honest answer.
      '[startup] 50ms (+50) a',
      '[startup] 200ms (+150) b',
    ]);
  });

  it('marks once per name: a render body can call it every render', () => {
    const lines: string[] = [];
    const t = makeTrace(true, clockAt([0, 10, 20, 30]), (l) => lines.push(l));
    t.mark('first-frame');
    t.mark('first-frame');
    t.mark('first-frame');
    expect(lines).toHaveLength(1);
    expect(t.marks()).toEqual([{ name: 'first-frame', at: 10, ms: 10 }]);
  });

  it('disabled, it neither logs nor records', () => {
    const sink = vi.fn();
    const t = makeTrace(false, clockAt([0, 10]), sink);
    t.mark('anything');
    expect(sink).not.toHaveBeenCalled();
    expect(t.marks()).toEqual([]);
  });

  it('marks() hands back a copy, not the ledger itself', () => {
    const t = makeTrace(true, clockAt([0, 5]), () => {});
    t.mark('a');
    const out = t.marks();
    out.pop();
    expect(t.marks()).toHaveLength(1);
  });
});

describe('startupTrace', () => {
  it('writes through console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      startupTrace.mark('trace-test-only');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatch(/^\[startup] \d+ms \(\+\d+\) trace-test-only$/);
    } finally {
      spy.mockRestore();
    }
  });

  // The whole of the change that gated this by channel, and the only
  // place it is checkable: the flag is read once, when the module
  // evaluates, so the App Store case needs its own load of the module
  // rather than a second assertion against the singleton above.
  //
  // Worth a test because the failure is silent in exactly the build
  // nobody watches — flip the constant back to `true` and every reader's
  // phone resumes writing a dozen lines per launch into the OS log, with
  // nothing anywhere to say so.
  it('says nothing at all on the App Store channel', async () => {
    vi.resetModules();
    vi.doMock('./channel', () => ({ CHANNEL: 'production', IS_PRODUCTION_CHANNEL: true }));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const shipped = await import('./trace');
      expect(shipped.STARTUP_TRACE).toBe(false);
      shipped.startupTrace.mark('trace-test-only');
      expect(spy).not.toHaveBeenCalled();
      // Silent and also empty: a trace that logs nothing but still keeps
      // marks would hand `reportStartup` a full waterfall to upload.
      expect(shipped.startupTrace.marks()).toEqual([]);
    } finally {
      spy.mockRestore();
      vi.doUnmock('./channel');
      vi.resetModules();
    }
  });
});
