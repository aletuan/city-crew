import { describe, expect, it, vi } from 'vitest';
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
    expect(t.marks()).toEqual([{ name: 'first-frame', at: 10 }]);
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
});
