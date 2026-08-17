import { describe, expect, it } from 'vitest';
import {
  finished, SKETCH_STEPS, STEP_FLOOR_MS, stepStates, stopCount, summaryLine, type Step,
} from './sketch';

const steps: Step[] = [
  { key: 'a', en: 'a', vi: 'a', ja: 'a' },
  { key: 'b', en: 'b', vi: 'b', ja: 'b' },
  { key: 'c', en: 'c', vi: 'c', ja: 'c' },
];

describe('SKETCH_STEPS', () => {
  // The shipped list is what a reader waits through. If somebody retunes
  // it, this says out loud how long that now is — and the number is a
  // reading speed rather than a claim about the work, which finishes in
  // under a millisecond.
  it('is four steps and under two seconds of reading', () => {
    expect(SKETCH_STEPS).toHaveLength(4);
    expect(SKETCH_STEPS.length * STEP_FLOOR_MS).toBeLessThan(2000);
  });

  it('says the same thing in all three languages', () => {
    for (const s of SKETCH_STEPS) {
      expect(s.en.length, s.key).toBeGreaterThan(0);
      expect(s.vi.length, s.key).toBeGreaterThan(0);
      expect(s.ja.length, s.key).toBeGreaterThan(0);
    }
  });
});

describe('stepStates', () => {
  it('starts with the first step working and the rest waiting', () => {
    expect(stepStates(0, steps)).toEqual(['active', 'pending', 'pending']);
  });

  it('moves through them as stages complete', () => {
    expect(stepStates(1, steps)).toEqual(['done', 'active', 'pending']);
    expect(stepStates(2, steps)).toEqual(['done', 'done', 'active']);
  });

  // A list with a spinner still turning after the work stopped is the bug
  // this shape exists to make impossible.
  it('leaves nothing active once the run is over', () => {
    expect(stepStates(3, steps)).toEqual(['done', 'done', 'done']);
    expect(stepStates(99, steps)).toEqual(['done', 'done', 'done']);
  });

  it('has exactly one active step until then', () => {
    for (const at of [0, 1, 2]) {
      expect(stepStates(at, steps).filter((s) => s === 'active'), `at ${at}`).toHaveLength(1);
    }
  });

  // A count that ran backwards is not progress in reverse.
  it('treats a negative count as the beginning', () => {
    expect(stepStates(-2, steps)).toEqual(['active', 'pending', 'pending']);
  });

  it('never shows a pending step before an active one', () => {
    for (const at of [0, 1, 2, 3]) {
      const s = stepStates(at, steps);
      const lastDone = s.lastIndexOf('done');
      const firstPending = s.indexOf('pending');
      if (firstPending >= 0) expect(firstPending, `at ${at}`).toBeGreaterThan(lastDone);
    }
  });

  it('has nothing to show for no steps', () => {
    expect(stepStates(0, [])).toEqual([]);
  });
});

describe('finished', () => {
  it('is false while anything is left', () => {
    expect(finished(0, steps)).toBe(false);
    expect(finished(2, steps)).toBe(false);
  });

  it('is true at the end and after it', () => {
    expect(finished(3, steps)).toBe(true);
    expect(finished(9, steps)).toBe(true);
  });

  it('agrees with stepStates about when that is', () => {
    for (const at of [0, 1, 2, 3, 4]) {
      expect(finished(at, steps), `at ${at}`)
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

describe('stopCount', () => {
  const en = (a: string) => a;
  const vi = (_a: string, b: string) => b;
  const ja = (_a: string, _b: string, c?: string) => c ?? '';

  // The case three screens got wrong. Nobody sees it until a reader deletes
  // their way down to one stop, and then it is the only sentence on the card.
  it('does not say "1 stops"', () => {
    expect(stopCount(1, en)).toBe('1 stop');
    expect(stopCount(3, en)).toBe('3 stops');
  });

  // Zero is plural in English — "0 stops", the way "0 items" is.
  it('treats none as plural', () => {
    expect(stopCount(0, en)).toBe('0 stops');
  });

  // Vietnamese and Japanese do not inflect for number, so both counts get
  // the same word. Asserted rather than assumed: the obvious refactor is to
  // pass a singular and a plural for every language, which would put an
  // English grammar rule inside their vocabulary.
  it('leaves the languages that do not inflect alone', () => {
    expect(stopCount(1, vi)).toBe('1 điểm');
    expect(stopCount(5, vi)).toBe('5 điểm');
    expect(stopCount(1, ja)).toBe('1 スポット');
    expect(stopCount(5, ja)).toBe('5 スポット');
  });
});
