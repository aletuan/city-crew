import { describe, expect, it } from 'vitest';
import { levelFromSaves, levelWords, PER_LEVEL } from './level';

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

// What a press on the "Lv" pill says (owner, 16 Nov 2026).
describe('levelWords', () => {
  const en = (e: string) => e;
  const vi = (_e: string, v: string) => v;

  it('says the rule, the count, and how many more the next level takes', () => {
    expect(levelWords(74, en)).toEqual({
      title: 'Level 15',
      body: 'Every 5 places you save into a collection takes you up a level. You have saved 74 so far, and 1 more takes you to Level 16.',
    });
    expect(levelWords(74, vi)).toEqual({
      title: 'Level 15',
      body: 'Cứ 5 địa điểm bạn lưu vào bộ sưu tập là lên một level. Bạn đã lưu 74 địa điểm, lưu thêm 1 địa điểm nữa để lên Level 16.',
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
    expect(levelWords(75, en).body).toContain('saved 75 so far, and 5 more takes you to Level 17.');
    expect(levelWords(0, en).body).toContain('saved 0 so far, and 5 more takes you to Level 2.');
    expect(levelWords(71, en).body).toContain('and 4 more takes you to Level 16.');
  });

  it('says it in every language, each with the three numbers', () => {
    const pick = (i: number) => (...a: (string | undefined)[]) => a[i] ?? a[0]!;
    for (const i of [2, 3, 4]) {
      const w = levelWords(74, pick(i));
      expect(w.title).toContain('15');
      for (const n of ['5', '74', '1', '16']) expect(w.body).toContain(n);
      expect(w.body).not.toBe(levelWords(74, en).body);
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
