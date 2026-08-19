import { describe, expect, it } from 'vitest';
import { createDuckTracker } from './duck';

// Feed a sequence of offsets; collect the decisions (the edges).
const run = (t: ReturnType<typeof createDuckTracker>, ys: number[], maxY?: number) =>
  ys.map((y) => t.report(y, maxY)).filter(Boolean);

describe('createDuckTracker', () => {
  it('hides once on committed descent — an edge, not a level', () => {
    const t = createDuckTracker();
    // One 'hide' when the travel commits, then silence however far it runs.
    expect(run(t, [0, 40, 90, 100, 120, 300])).toEqual(['hide']);
  });

  it('never hides within the top slack, whatever the descent there', () => {
    const t = createDuckTracker();
    expect(run(t, [0, 30, 60, 80])).toEqual([]); // 80pt of descent, all in slack
  });

  it('reaching the slack surfaces the bar even without committed ascent', () => {
    // showTravel set impossibly high, so only the slack branch can fire.
    const t = createDuckTracker({ showTravel: 10_000 });
    expect(run(t, [0, 200, 300])).toEqual(['hide']);
    expect(t.report(70)).toBe('show');
  });

  it('returns on a modest committed ascent — less than hiding took', () => {
    const t = createDuckTracker();
    expect(run(t, [0, 200, 300])).toEqual(['hide']);
    expect(t.report(295)).toBeNull(); // 5pt up: not yet
    expect(t.report(285)).toBe('show'); // 15pt accumulated: back
  });

  it('the reported strobe: alternating deltas decide nothing at all', () => {
    const t = createDuckTracker();
    run(t, [0, 200, 300]); // hidden, deep in the list
    const wobble: number[] = [];
    for (let i = 0; i < 20; i++) wobble.push(i % 2 ? 310 : 300);
    expect(run(t, wobble)).toEqual([]);
  });

  it('direction flips reset the accumulator instead of netting against it', () => {
    const t = createDuckTracker();
    run(t, [0, 200]); // hidden
    // 8 up, 8 down, repeatedly — never 12 committed in either direction.
    expect(run(t, [192, 200, 192, 200, 192, 200])).toEqual([]);
  });

  it('clamps the bottom bounce: overscroll past maxY is not travel', () => {
    const t = createDuckTracker();
    expect(run(t, [0, 400, 500], 500)).toEqual(['hide']); // at the very bottom
    // The bounce: offsets sail past maxY and spring back.
    expect(run(t, [540, 560, 540, 500], 500)).toEqual([]);
  });

  it('clamps the top bounce: negative offsets read as zero', () => {
    const t = createDuckTracker();
    run(t, [0, 200, 300]); // hidden
    expect(t.report(-40)).toBe('show'); // sprung past the top: offset is 0
    expect(t.report(-10)).toBeNull(); // still 0 — no movement at all
  });

  it('ignores a negative maxY (a list shorter than its viewport)', () => {
    const t = createDuckTracker();
    expect(t.report(300, -50)).toBe('hide'); // clamp falls back to no ceiling
  });

  it('reset forgets the anchor: the next offset only plants it', () => {
    const t = createDuckTracker();
    run(t, [0, 200, 300]); // hidden, deep
    t.reset(); // a tab change surfaced the bar
    // The new screen is parked at 800. Without the reset this would read
    // as +500 of descent and hide the bar on first touch — the regression
    // this test pins down.
    expect(t.report(800)).toBeNull();
    expect(t.report(806)).toBeNull(); // 6pt drift: not a decision
    expect(t.report(832)).toBe('hide'); // 32pt committed: a real descent
  });

  it('exact zero delta decides nothing, in either state', () => {
    const t = createDuckTracker();
    expect(t.report(0)).toBeNull(); // shown, parked
    run(t, [200]);
    expect(t.report(200)).toBeNull(); // hidden, parked
  });

  it('honours custom thresholds', () => {
    const t = createDuckTracker({ hideTravel: 100, showTravel: 4, topSlack: 10 });
    expect(run(t, [0, 50, 100])).toEqual([]); // 100 accumulated: not past 100
    expect(t.report(111)).toBe('hide'); // 111: past it
    expect(t.report(106)).toBe('show'); // 5 > 4
  });
});
