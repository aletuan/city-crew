import { describe, expect, it } from 'vitest';
import { createNudgeGate, NUDGE_SETTLE_MS } from './nudge';

describe('createNudgeGate', () => {
  it('follows the bar out by one beat, then shows', () => {
    const g = createNudgeGate({ settleMs: 120 });
    expect(g.update(true, 0)).toBe(false);
    expect(g.update(true, 119)).toBe(false);
    expect(g.update(true, 120)).toBe(true);
    expect(g.update(true, 900)).toBe(true); // and stays
  });

  it('the bar always wins: losing eligibility hides it the same frame', () => {
    const g = createNudgeGate({ settleMs: 120 });
    g.update(true, 0);
    expect(g.update(true, 200)).toBe(true);
    expect(g.update(false, 201)).toBe(false);
  });

  it('the dock always answers: every departure of the bar re-offers', () => {
    const g = createNudgeGate({ settleMs: 120 });
    g.update(true, 0);
    expect(g.update(true, 150)).toBe(true); // offered
    expect(g.update(false, 300)).toBe(false); // bar came back — offer yields
    // The bar leaves again: the offer returns, after the same beat.
    expect(g.update(true, 1000)).toBe(false);
    expect(g.update(true, 1120)).toBe(true);
    // And again, however many times.
    g.update(false, 2000);
    expect(g.update(true, 3000)).toBe(false);
    expect(g.update(true, 3120)).toBe(true);
  });

  it('an interrupted beat starts over', () => {
    const g = createNudgeGate({ settleMs: 120 });
    g.update(true, 0);
    expect(g.update(false, 60)).toBe(false);
    expect(g.update(true, 1000)).toBe(false); // clock restarts
    expect(g.update(true, 1119)).toBe(false);
    expect(g.update(true, 1120)).toBe(true);
  });

  it('reset starts the beat over without needing an ineligible frame', () => {
    const g = createNudgeGate({ settleMs: 120 });
    g.update(true, 0);
    expect(g.update(true, 150)).toBe(true);
    g.reset(); // a navigation took the dock
    expect(g.update(true, 200)).toBe(false); // beat anew
    expect(g.update(true, 320)).toBe(true);
  });

  it('ships a default beat', () => {
    const g = createNudgeGate();
    g.update(true, 0);
    expect(g.update(true, NUDGE_SETTLE_MS - 1)).toBe(false);
    expect(g.update(true, NUDGE_SETTLE_MS)).toBe(true);
  });
});
