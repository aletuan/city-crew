import { describe, expect, it } from 'vitest';
import { levelFromSaves, PER_LEVEL } from './level';

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
