import { describe, expect, it } from 'vitest';
import { createNudgeGate, NUDGE_SETTLE_MS } from './nudge';

describe('createNudgeGate', () => {
  it('waits out the settle time before offering', () => {
    const g = createNudgeGate({ settleMs: 500 });
    expect(g.update(true, 0)).toBe(false);
    expect(g.update(true, 499)).toBe(false);
    expect(g.update(true, 500)).toBe(true);
    expect(g.update(true, 900)).toBe(true); // and stays
  });

  it('the bar always wins: losing eligibility hides it the same frame', () => {
    const g = createNudgeGate({ settleMs: 500 });
    g.update(true, 0);
    expect(g.update(true, 600)).toBe(true);
    expect(g.update(false, 601)).toBe(false);
  });

  it('an interrupted settle starts over, and never counts as a decline', () => {
    const g = createNudgeGate({ settleMs: 500 });
    g.update(true, 0);
    expect(g.update(false, 300)).toBe(false); // never shown — not declined
    expect(g.update(true, 1000)).toBe(false); // clock restarts…
    expect(g.update(true, 1499)).toBe(false);
    expect(g.update(true, 1500)).toBe(true); // …and it still gets its turn
  });

  it('declined means declined: once shown and passed over, it stays away', () => {
    const g = createNudgeGate({ settleMs: 500 });
    g.update(true, 0);
    expect(g.update(true, 600)).toBe(true); // offered
    expect(g.update(false, 700)).toBe(false); // reader pulled up — declined
    expect(g.update(true, 2000)).toBe(false); // eligible again: no
    expect(g.update(true, 9000)).toBe(false); // however long it holds
  });

  it('reset forgives: a fresh visit gets a fresh offer', () => {
    const g = createNudgeGate({ settleMs: 500 });
    g.update(true, 0);
    g.update(true, 600); // shown
    g.update(false, 700); // declined
    g.reset();
    expect(g.update(true, 1000)).toBe(false); // settle applies anew
    expect(g.update(true, 1500)).toBe(true);
  });

  it('ships a default settle time', () => {
    const g = createNudgeGate();
    g.update(true, 0);
    expect(g.update(true, NUDGE_SETTLE_MS - 1)).toBe(false);
    expect(g.update(true, NUDGE_SETTLE_MS)).toBe(true);
  });
});
