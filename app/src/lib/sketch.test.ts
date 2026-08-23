import { describe, expect, it } from 'vitest';
import {
  findingFeed, finished, findingsOf, SKETCH_STEPS, STEP_FLOOR_MS, stepStates, stopCount, summaryLine, type Step,
} from './sketch';

const steps: Step[] = [
  { key: 'a', en: 'a', vi: 'a', ja: 'a' },
  { key: 'b', en: 'b', vi: 'b', ja: 'b' },
  { key: 'c', en: 'c', vi: 'c', ja: 'c' },
];

describe('SKETCH_STEPS', () => {
  // The shipped list is what a reader waits through. If somebody retunes
  // it, this says out loud how long that now is — and the floor is a
  // reading speed, not a claim about the work. Four of the five finish in
  // under a millisecond; the fifth, the words, is the one step that
  // genuinely waits, and the screen holds on it rather than the floor.
  it('is five steps and under three seconds of reading floor', () => {
    expect(SKETCH_STEPS).toHaveLength(5);
    expect(SKETCH_STEPS[SKETCH_STEPS.length - 1].key).toBe('words');
    // Under the model's own floor: a healthy narration takes three
    // seconds at least, and the last step waits for it anyway, so the
    // reading floor must not be what decides how long the screen lasts.
    expect((SKETCH_STEPS.length - 1) * STEP_FLOOR_MS).toBeLessThan(4000);
    // And long enough to read the sentence each row now carries.
    expect(STEP_FLOOR_MS).toBeGreaterThan(700);
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

const t3 = (en: string) => en;
const FMT = {
  clock: (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  distance: (km: number) => `${km} km`,
  minutes: (n: number) => `${n} min`,
};
const FULL = {
  openNow: 17,
  startMin: 9 * 60,
  opening: 'Artemis Pastry',
  hop: { km: 6.2, minutes: 20 },
  window: [9 * 60, 11 * 60 + 42] as [number, number],
};

describe('findingsOf', () => {
  it('lines up one finding per step', () => {
    expect(findingsOf(FULL, t3, FMT)).toHaveLength(SKETCH_STEPS.length);
  });

  // The first step is answered by the summary line already printed above
  // the card. Repeating the reader's own answers back at them is not a
  // finding.
  it('says nothing about the reader\'s own picks', () => {
    expect(findingsOf(FULL, t3, FMT)[0]).toBeNull();
  });

  it('reports what it found, not what it is doing', () => {
    const [, open, start, hop, window] = findingsOf(FULL, t3, FMT);
    expect(open?.text).toBe('17 places open at 09:00');
    expect(start?.text).toBe('Starting at Artemis Pastry');
    expect(hop?.text).toBe('6.2 km to the next stop, about 20 min');
    expect(window?.text).toBe('Your day runs 09:00–11:42');
  });

  // The mark is part of the fact's meaning — a clock for hours, a pin
  // for the starting stop, a walker for the leg, a calendar for the
  // window — decided here so the screen only draws it.
  it('types each finding with the mark its kind wears', () => {
    const [, open, start, hop, window] = findingsOf(FULL, t3, FMT);
    expect(open?.icon).toBe('time-outline');
    expect(start?.icon).toBe('location-outline');
    expect(hop?.icon).toBe('walk-outline');
    expect(window?.icon).toBe('calendar-outline');
  });

  // Every one of these is missing in a real case: a catalog that could not
  // be read, a plan with a single stop and therefore no journey. A box
  // that printed "0 places open" or "undefined km" would be worse than a
  // box that says nothing.
  it('has nothing to say rather than something wrong', () => {
    const bare = findingsOf(
      { openNow: 0, startMin: 540, opening: null, hop: null, window: null }, t3, FMT,
    );
    expect(bare).toEqual([null, null, null, null, null]);
  });

  it('drops only the part it is missing', () => {
    const [, open, start, hop] = findingsOf({ ...FULL, hop: null }, t3, FMT);
    expect(open).not.toBeNull();
    expect(start).not.toBeNull();
    expect(hop).toBeNull();
  });
});

describe('findingFeed', () => {
  const lines = findingsOf(FULL, t3, FMT);
  const texts = (f: ReturnType<typeof findingFeed>) => ({
    previous: f.previous?.text ?? null,
    current: f.current?.text ?? null,
  });

  // The first step has no finding by design, so the screen keeps its
  // skeleton until there is a fact to put in its place.
  it('has nothing before the first finding exists', () => {
    expect(findingFeed(lines, 0)).toEqual({ previous: null, current: null });
  });

  // The mockup's mid-state before there is any history: one bright line
  // standing alone, no dimmed line above it.
  it('starts as a single line, with no previous to show', () => {
    expect(texts(findingFeed(lines, 1)))
      .toEqual({ previous: null, current: '17 places open at 09:00' });
  });

  it('carries the settled fact above the one being worked out', () => {
    expect(texts(findingFeed(lines, 2))).toEqual({
      previous: '17 places open at 09:00',
      current: 'Starting at Artemis Pastry',
    });
    expect(texts(findingFeed(lines, 3))).toEqual({
      previous: 'Starting at Artemis Pastry',
      current: '6.2 km to the next stop, about 20 min',
    });
  });

  // Falls forward rather than blanking. An element that disappears reads
  // as something having gone wrong, not as a step with nothing to add.
  it('holds the last frame through a step that says nothing', () => {
    const l = (text: string) => ({ icon: 'time-outline', text });
    const gappy = [l('a'), null, null, l('d'), null];
    expect(texts(findingFeed(gappy, 2))).toEqual({ previous: null, current: 'a' });
    expect(texts(findingFeed(gappy, 4))).toEqual({ previous: 'a', current: 'd' });
  });

  // The screen finishes on the last frame and hands over; a feed that
  // goes blank on the way out is a flicker.
  it('holds rather than clearing once the steps are done', () => {
    expect(texts(findingFeed(lines, 99))).toEqual({
      previous: '6.2 km to the next stop, about 20 min',
      current: 'Your day runs 09:00–11:42',
    });
  });

  it('has nothing to hold when nothing was found', () => {
    expect(findingFeed([null, null], 5)).toEqual({ previous: null, current: null });
    expect(findingFeed([], 0)).toEqual({ previous: null, current: null });
  });
});
