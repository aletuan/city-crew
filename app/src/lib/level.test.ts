import { describe, expect, it } from 'vitest';
import { levelFromSaves, levelSteps, levelWords, PER_LEVEL } from './level';

describe('levelFromSaves', () => {
  // A profile reading "Lv 0" says the account is broken; a new one is not.
  it('starts everyone at level one with an empty ring', () => {
    expect(levelFromSaves(0)).toEqual({ level: 1, progress: 0 });
  });

  it('fills the ring across the level', () => {
    expect(levelFromSaves(1).progress).toBeCloseTo(0.2);
    expect(levelFromSaves(4).progress).toBeCloseTo(0.8);
  });

  // The boundary belongs to the next level, and it resets the ring rather
  // than leaving it full — a closed ring on a fresh level reads as done.
  it('rolls over on the boundary rather than closing the ring', () => {
    expect(levelFromSaves(PER_LEVEL)).toEqual({ level: 2, progress: 0 });
    expect(levelFromSaves(PER_LEVEL * 2)).toEqual({ level: 3, progress: 0 });
  });

  it('keeps counting past the levels anyone will reach soon', () => {
    expect(levelFromSaves(57).level).toBe(12);
  });

  // The count comes from a Set's size, so these should be unreachable —
  // which is exactly why they are worth pinning: an unreachable input
  // that silently produces "Lv 0" or NaN is a bug nobody would look for.
  it('refuses to produce a level below one', () => {
    expect(levelFromSaves(-3)).toEqual({ level: 1, progress: 0 });
  });

  it('survives a count that is not a whole number', () => {
    expect(levelFromSaves(7.6)).toEqual(levelFromSaves(7));
  });

  it('survives no count at all', () => {
    expect(levelFromSaves(NaN)).toEqual({ level: 1, progress: 0 });
    expect(levelFromSaves(undefined as unknown as number)).toEqual({ level: 1, progress: 0 });
  });
});

// What the sheet a press on the "Lv" pill opens says (owner, 16 Nov 2026).
describe('levelWords', () => {
  const en = (e: string) => e;
  const vi = (_e: string, v: string) => v;

  // Two lines, and no third (owner, 17 Nov 2026): the total and "every
  // 5" went, said already by "3 / 5" and the bar.
  it('says the level and what the next one takes, and nothing else', () => {
    expect(levelWords(74, en)).toEqual({
      title: 'Level 15',
      next: 'Save 1 more place to reach Level 16.',
    });
    expect(levelWords(74, vi)).toEqual({
      title: 'Level 15',
      next: 'Lưu thêm 1 địa điểm để đạt Level 16.',
    });
  });

  // The title is the pill's own level, whatever the count.
  it('names the level the ring shows', () => {
    for (const n of [0, 1, 4, 5, 57, 74, 75]) {
      expect(levelWords(n, en).title).toBe(`Level ${levelFromSaves(n).level}`);
    }
  });

  // The boundary belongs to the next level, so there is never "0 more":
  // on it, a whole level is still to go.
  it('never says 0 more: a full level is to go on the boundary', () => {
    expect(levelWords(75, en).next).toBe('Save 5 more places to reach Level 17.');
    expect(levelWords(0, en).next).toBe('Save 5 more places to reach Level 2.');
    expect(levelWords(71, en).next).toBe('Save 4 more places to reach Level 16.');
  });

  // English alone counts its nouns.
  it('says one place as one place', () => {
    expect(levelWords(1, en).next).toBe('Save 4 more places to reach Level 2.');
    expect(levelWords(4, en).next).toBe('Save 1 more place to reach Level 2.');
  });

  it('says it in every language, each with its numbers', () => {
    const pick = (i: number) => (...a: (string | undefined)[]) => a[i] ?? a[0]!;
    for (const i of [2, 3, 4]) {
      const w = levelWords(74, pick(i));
      expect(w.title).toContain('15');
      for (const n of ['1', '16']) expect(w.next).toContain(n);
      expect(w.next).not.toBe(levelWords(74, en).next);
    }
  });

  // Unreachable from a Set's size, and pinned for the reason
  // `levelFromSaves` pins them.
  it('reads a count that is not one as none', () => {
    expect(levelWords(-3, en)).toEqual(levelWords(0, en));
    expect(levelWords(NaN, en)).toEqual(levelWords(0, en));
    expect(levelWords(7.9, en)).toEqual(levelWords(7, en));
  });
});

// The bar in that sheet: the ring's fraction, as two whole numbers.
describe('levelSteps', () => {
  it('is how far through the current level, out of a level', () => {
    expect(levelSteps(74)).toEqual({ done: 4, of: PER_LEVEL });
    expect(levelSteps(0)).toEqual({ done: 0, of: PER_LEVEL });
    // On the boundary the new level is empty, as the ring is.
    expect(levelSteps(75)).toEqual({ done: 0, of: PER_LEVEL });
  });

  it('agrees with the ring for every count', () => {
    for (let n = 0; n <= 40; n++) {
      const { done, of } = levelSteps(n);
      expect(done / of).toBeCloseTo(levelFromSaves(n).progress);
    }
  });

  it('reads a count that is not one as none', () => {
    expect(levelSteps(-3)).toEqual(levelSteps(0));
    expect(levelSteps(NaN)).toEqual(levelSteps(0));
    expect(levelSteps(7.9)).toEqual(levelSteps(7));
  });
});
