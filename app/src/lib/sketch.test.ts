import { describe, expect, it } from 'vitest';
import {
  finished, SKETCH_STEPS, stepEnds, stepStates, summaryLine, totalMs, type Step,
} from './sketch';

// Round numbers, so an expectation reads as the thing being asserted
// rather than as arithmetic the reader has to redo.
const steps: Step[] = [
  { key: 'a', ms: 1000, en: 'a', vi: 'a', ja: 'a' },
  { key: 'b', ms: 2000, en: 'b', vi: 'b', ja: 'b' },
  { key: 'c', ms: 1000, en: 'c', vi: 'c', ja: 'c' },
];

describe('stepEnds', () => {
  it('accumulates', () => {
    expect(stepEnds(steps)).toEqual([1000, 3000, 4000]);
  });

  it('has nothing to accumulate for no steps', () => {
    expect(stepEnds([])).toEqual([]);
  });
});

describe('totalMs', () => {
  it('is the last end', () => {
    expect(totalMs(steps)).toBe(4000);
  });

  it('is zero for no steps', () => {
    expect(totalMs([])).toBe(0);
  });

  // The real list is what ships; if somebody retunes it, this says out
  // loud how long a reader now waits at a screen that is not measuring
  // anything.
  it('is 8.4 seconds for the shipped list', () => {
    expect(totalMs()).toBe(8400);
    expect(SKETCH_STEPS).toHaveLength(4);
  });
});

describe('stepStates', () => {
  it('starts with the first step working and the rest waiting', () => {
    expect(stepStates(0, steps)).toEqual(['active', 'pending', 'pending']);
  });

  it('moves through them', () => {
    expect(stepStates(500, steps)).toEqual(['active', 'pending', 'pending']);
    expect(stepStates(1500, steps)).toEqual(['done', 'active', 'pending']);
    expect(stepStates(3500, steps)).toEqual(['done', 'done', 'active']);
  });

  // The boundary belongs to the step that follows. Otherwise the moment a
  // step ends shows it both finished and still going.
  it('hands the boundary to the next step', () => {
    expect(stepStates(1000, steps)).toEqual(['done', 'active', 'pending']);
    expect(stepStates(3000, steps)).toEqual(['done', 'done', 'active']);
  });

  // A list with a spinner still turning after the work stopped is the bug
  // this shape exists to make impossible.
  it('leaves nothing active once the run is over', () => {
    expect(stepStates(4000, steps)).toEqual(['done', 'done', 'done']);
    expect(stepStates(99999, steps)).toEqual(['done', 'done', 'done']);
  });

  it('has exactly one active step until then', () => {
    for (const at of [0, 1, 999, 1000, 2500, 3999]) {
      const active = stepStates(at, steps).filter((s) => s === 'active');
      expect(active, `at ${at}ms`).toHaveLength(1);
    }
  });

  // A clock that ran backwards is not progress in reverse.
  it('treats a negative clock as the beginning', () => {
    expect(stepStates(-500, steps)).toEqual(['active', 'pending', 'pending']);
  });

  it('never shows a pending step before an active one', () => {
    for (const at of [0, 700, 1000, 2000, 3000, 3900, 4000]) {
      const s = stepStates(at, steps);
      const lastDone = s.lastIndexOf('done');
      const firstPending = s.indexOf('pending');
      if (firstPending >= 0) expect(firstPending, `at ${at}ms`).toBeGreaterThan(lastDone);
    }
  });
});

describe('finished', () => {
  it('is false while anything is left', () => {
    expect(finished(0, steps)).toBe(false);
    expect(finished(3999, steps)).toBe(false);
  });

  it('is true at the end and after it', () => {
    expect(finished(4000, steps)).toBe(true);
    expect(finished(9000, steps)).toBe(true);
  });

  it('agrees with stepStates about when that is', () => {
    for (const at of [0, 1000, 3999, 4000, 5000]) {
      expect(finished(at, steps), `at ${at}ms`)
        .toBe(stepStates(at, steps).every((s) => s === 'done'));
    }
  });
});

describe('summaryLine', () => {
  it('joins what there is', () => {
    expect(summaryLine(['Couple', 'Evening', 'Ba Đình'])).toBe('Couple · Evening · Ba Đình');
  });

  // The draft is allowed to be half-answered — only company and one
  // category are needed to get here — and a gap must not print as '· ·'.
  it('drops the parts that are not there', () => {
    expect(summaryLine(['Couple', null, 'Ba Đình'])).toBe('Couple · Ba Đình');
    expect(summaryLine([undefined, 'Evening', '', '   '])).toBe('Evening');
  });

  it('trims what it keeps', () => {
    expect(summaryLine(['  Couple  ', 'Evening'])).toBe('Couple · Evening');
  });

  it('is empty when there is nothing to say', () => {
    expect(summaryLine([])).toBe('');
    expect(summaryLine([null, undefined, '  '])).toBe('');
  });
});
