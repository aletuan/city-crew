import { describe, expect, it, vi } from 'vitest';
import {
  SHOWN, band, bandLabel, bestOf, interpreterOf, needsScore, scoreAll, toTen,
  type PhotoScore, type Reading, type Signals, type T,
} from './photoScore';
import { appleVision } from './photoScoreVision';

const en: T = (e) => e;
const vi_: T = (_e, v) => v;

const row = (signals: Signals, over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.4, is_utility: false, signals, ...over,
});

describe('the scorers', () => {
  it('shows Apple Vision\'s rows, the only scorer there is', () => {
    expect(SHOWN).toBe(appleVision);
  });
  it('finds a row\'s interpreter by the name the row carries', () => {
    expect(interpreterOf('apple-vision')).toBe(appleVision);
  });
  // A row a later app wrote, read by this one: no interpreter, rather
  // than Vision's thresholds applied to another model's measurements.
  it('knows no interpreter for a name it was not built with', () => {
    expect(interpreterOf('later-model')).toBeUndefined();
    // A map, not an object: no name reaches the prototype.
    expect(interpreterOf('toString')).toBeUndefined();
  });
});

describe('needsScore', () => {
  const scorer = { id: 'apple-vision', version: 2 };
  it('asks for a reading where there is none', () => {
    expect(needsScore(null, scorer)).toBe(true);
    expect(needsScore(undefined, scorer)).toBe(true);
  });
  // The one number a better reading bumps to read the old rows again.
  it('counts a reading from an older version as unread, and this one or later as read', () => {
    expect(needsScore(row({}, { scorer_version: 1 }), scorer)).toBe(true);
    expect(needsScore(row({}, { scorer_version: 2 }), scorer)).toBe(false);
    expect(needsScore(row({}, { scorer_version: 3 }), scorer)).toBe(false);
  });
  // Another scorer's reading is not this one's, whatever its version.
  it('counts another scorer\'s reading as unread by this one', () => {
    expect(needsScore(row({}, { scorer: 'later-model', scorer_version: 9 }), scorer)).toBe(true);
  });
});

describe('toTen', () => {
  it('is linear on −1…1, one decimal', () => {
    expect(toTen(-1)).toBe(0);
    expect(toTen(0)).toBe(5);
    expect(toTen(1)).toBe(10);
    expect(toTen(0.68)).toBe(8.4);
    expect(toTen(0.123)).toBe(5.6);
  });
  it('clamps what Vision should never send', () => {
    expect(toTen(1.4)).toBe(10);
    expect(toTen(-3)).toBe(0);
  });
});

describe('band', () => {
  it('cuts at 8, 6.5 and 5, each cut on the upper side', () => {
    expect(band(8)).toBe('excellent');
    expect(band(7.9)).toBe('good');
    expect(band(6.5)).toBe('good');
    expect(band(6.4)).toBe('fair');
    expect(band(5)).toBe('fair');
    expect(band(4.9)).toBe('weak');
  });
  it('names each band in the reader\'s language', () => {
    expect(bandLabel('excellent', vi_)).toBe('Rất tốt');
    expect(bandLabel('good', vi_)).toBe('Tốt');
    expect(bandLabel('fair', vi_)).toBe('Khá');
    expect(bandLabel('weak', vi_)).toBe('Chưa tốt');
    expect(bandLabel('excellent', en)).toBe('Very good');
  });
});

describe('scoreAll', () => {
  const photos = [
    { id: 'a', photo_uri: 'https://x/a.jpg' },
    { id: 'b', photo_uri: 'https://x/b.jpg' },
    { id: 'c', photo_uri: 'https://x/c.jpg' },
  ];
  const reading = (uri: string): Reading => ({ aesthetic: uri.length / 100, isUtility: false, signals: {} });

  it('reads and keeps each in turn, reporting each step', async () => {
    const save = vi.fn(async (_id: string, _r: Reading) => {});
    const steps: number[] = [];
    const r = await scoreAll(photos, {
      read: async (uri) => reading(uri), save, onStep: (n) => steps.push(n), stopped: () => false,
    });
    expect(r).toEqual({ scored: 3, failed: 0 });
    expect(save.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
    expect(save).toHaveBeenCalledWith('a', reading('https://x/a.jpg'));
    expect(steps).toEqual([1, 2, 3]);
  });

  // Cancel keeps what was scored: each answer was saved as it came.
  it('stops before the next photograph once stopped, keeping what it saved', async () => {
    let stop = false;
    const save = vi.fn(async () => { stop = true; });
    const r = await scoreAll(photos, {
      read: async (uri) => reading(uri), save, onStep: () => {}, stopped: () => stop,
    });
    expect(r).toEqual({ scored: 1, failed: 0 });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('counts a photograph it could not read or keep and goes on to the next', async () => {
    const steps: number[] = [];
    const r = await scoreAll(photos, {
      read: async (uri) => { if (uri.endsWith('a.jpg')) throw new Error('404'); return reading(uri); },
      save: async (id) => { if (id === 'c') throw new Error('refused'); },
      onStep: (n) => steps.push(n),
      stopped: () => false,
    });
    expect(r).toEqual({ scored: 1, failed: 2 });
    expect(steps).toEqual([1, 2, 3]);
  });
});

describe('bestOf', () => {
  it('is the highest score among those that have one', () => {
    const a = { id: 'a', score: row({}, { aesthetic: 0.2 }) };
    const b = { id: 'b', score: row({}, { aesthetic: 0.6 }) };
    const c = { id: 'c', score: null };
    const d = { id: 'd', score: row({}, { aesthetic: null }) };
    const e = { id: 'e', score: row({}, { aesthetic: 0.6 }) };
    expect(bestOf([a, c, b, d, e])).toEqual({ photo: b, ten: 8 });
  });
  it('is null when nothing has been read', () => {
    expect(bestOf([{ id: 'a' }, { id: 'b', score: null }])).toBeNull();
  });
});
