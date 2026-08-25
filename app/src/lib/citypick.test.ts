// The decisions behind which city the app opens on. Every branch, because
// the expensive one — waiting on the platform before anything can load —
// is invisible from the outside and was costing 1.2 s a launch.

import { describe, expect, it } from 'vitest';
import { openOn, settleOn, shouldCorrect, storedPick } from './citypick';

const KNOWN = ['hanoi', 'hcmc', 'danang'];

describe('storedPick', () => {
  it('reads a remembered choice', () => {
    expect(storedPick({ id: 'hanoi', mode: 'manual' }, KNOWN)).toEqual({ id: 'hanoi', mode: 'manual' });
  });

  it('treats anything that is not "manual" as automatic', () => {
    expect(storedPick({ id: 'hanoi' }, KNOWN)).toEqual({ id: 'hanoi', mode: 'auto' });
    expect(storedPick({ id: 'hanoi', mode: 'auto' }, KNOWN)).toEqual({ id: 'hanoi', mode: 'auto' });
  });

  it('answers nothing when nothing was stored', () => {
    expect(storedPick({}, KNOWN)).toBeNull();
  });

  // A city can be retired between two launches. Committing an id the
  // catalog no longer has would scope every query to nothing, which reads
  // as an empty catalog rather than as a missing city.
  it('refuses a city the catalog no longer has', () => {
    expect(storedPick({ id: 'hue', mode: 'auto' }, KNOWN)).toBeNull();
  });
});

describe('openOn', () => {
  // The reader's own word. It never involved the platform, so there is
  // nothing to wait for — on or off.
  it('opens on a manual pick whatever the switch says', () => {
    expect(openOn({ id: 'hanoi', mode: 'manual' }, KNOWN, true)).toEqual({ id: 'hanoi', mode: 'manual' });
    expect(openOn({ id: 'hanoi', mode: 'manual' }, KNOWN, false)).toEqual({ id: 'hanoi', mode: 'manual' });
  });

  it('opens on a remembered automatic pick when the switch is on', () => {
    expect(openOn({ id: 'hanoi', mode: 'auto' }, KNOWN, true)).toEqual({ id: 'hanoi', mode: 'auto' });
  });

  // Off is the old behaviour exactly: nothing commits until the location
  // race has answered.
  it('waits for the platform on an automatic pick when the switch is off', () => {
    expect(openOn({ id: 'hanoi', mode: 'auto' }, KNOWN, false)).toBeNull();
  });

  // A first launch has nothing to open on but a guess, and the wait is
  // what exists to avoid guessing.
  it('waits on a first launch, switch or no switch', () => {
    expect(openOn({}, KNOWN, true)).toBeNull();
    expect(openOn({}, KNOWN, false)).toBeNull();
  });

  it('waits when the remembered city has been retired', () => {
    expect(openOn({ id: 'hue', mode: 'auto' }, KNOWN, true)).toBeNull();
  });
});

describe('shouldCorrect', () => {
  it('moves an automatic city when the platform names a different one', () => {
    expect(shouldCorrect({ id: 'hcmc', mode: 'auto' }, 'hanoi')).toBe(true);
  });

  // The common case, and the one that must cost nothing: the reader is
  // where they were last time, so no state changes and the catalog is not
  // refetched.
  it('does nothing when the platform agrees', () => {
    expect(shouldCorrect({ id: 'hanoi', mode: 'auto' }, 'hanoi')).toBe(false);
  });

  it('never overrides a manual pick', () => {
    expect(shouldCorrect({ id: 'hanoi', mode: 'manual' }, 'hcmc')).toBe(false);
  });

  it('does nothing when the platform had no answer', () => {
    expect(shouldCorrect({ id: 'hanoi', mode: 'auto' }, null)).toBe(false);
  });

  // Nothing is showing yet, so there is nothing to correct — the caller is
  // on the waiting path and settles with `settleOn` instead.
  it('does nothing when no city has been committed', () => {
    expect(shouldCorrect(null, 'hanoi')).toBe(false);
  });
});

describe('settleOn', () => {
  it('takes the platform where it knows', () => {
    expect(settleOn('hanoi', { id: 'hcmc', mode: 'auto' }, 'hcmc')).toBe('hanoi');
  });

  it('falls back to what was remembered', () => {
    expect(settleOn(null, { id: 'danang', mode: 'auto' }, 'hcmc')).toBe('danang');
  });

  it('falls back to the app default when neither knows', () => {
    expect(settleOn(null, null, 'hcmc')).toBe('hcmc');
  });
});
