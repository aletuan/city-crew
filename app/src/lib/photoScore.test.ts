import { describe, expect, it, vi } from 'vitest';
import {
  SCORER_VERSION, band, bandLabel, bestOf, explainScore, needsScore, scoreAll, toTen,
  type PhotoScore, type Reading, type Signals,
} from './photoScore';

// English, Vietnamese and Japanese in turn, so a test can say which
// language it reads the sentence in.
type T = (en: string, vi: string, ja?: string) => string;
const en: T = (e) => e;
const vi_: T = (_e, v) => v;
const ja: T = (_e, _v, j) => j ?? '';

const row = (signals: Signals, over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer_version: SCORER_VERSION, aesthetic: 0.4, is_utility: false, signals, ...over,
});
const why = (signals: Signals, over: Partial<PhotoScore> = {}, t = en) => explainScore(row(signals, over), t);

describe('needsScore', () => {
  it('asks for a reading where there is none', () => {
    expect(needsScore(null)).toBe(true);
    expect(needsScore(undefined)).toBe(true);
  });
  // The one constant a better scorer bumps to read the old rows again.
  it('counts a reading from an older scorer as unread, and the current one as read', () => {
    expect(needsScore(row({}, { scorer_version: SCORER_VERSION - 1 }))).toBe(true);
    expect(needsScore(row({}))).toBe(false);
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

describe('explainScore', () => {
  it('says nothing stands out rather than inventing praise', () => {
    expect(why({})).toBe('Nothing measured stands out either way.');
    // A missing `signals` is the same as an empty one.
    expect(explainScore({ is_utility: false, signals: undefined as unknown as Signals }, en))
      .toBe('Nothing measured stands out either way.');
  });

  it('puts what helped first, capitalised, then what held it back', () => {
    expect(why({ brightness: 0.5, sharpness: 400, tilt: 4.4 }))
      .toBe('Well lit, sharp. Held back by: horizon tilted 4°.');
  });

  it('leads with Vision\'s "a record, not a picture" when it says so', () => {
    expect(why({ brightness: 0.5 }, { is_utility: true }))
      .toBe('Vision reads this as a record — a menu, a sign, a document — rather than a picture. Well lit.');
  });

  describe('light', () => {
    it.each([
      [0.24, 'Held back by: a little dark.'],
      [0.25, 'Nothing measured stands out either way.'],
      [0.35, 'Well lit.'],
      [0.7, 'Well lit.'],
      [0.71, 'Nothing measured stands out either way.'],
      [0.8, 'Nothing measured stands out either way.'],
      [0.81, 'Held back by: a little overexposed.'],
    ])('mean luma %s', (brightness, said) => {
      expect(why({ brightness })).toBe(said);
    });

    it('names crushed shadows and blown highlights past their shares', () => {
      expect(why({ shadows: 0.3, highlights: 0.125 })).toBe('Nothing measured stands out either way.');
      expect(why({ shadows: 0.31, highlights: 0.13 }))
        .toBe('Held back by: shadows lose detail, highlights blown out.');
    });
  });

  it.each([
    [59, 'Held back by: a little soft.'],
    [60, 'Nothing measured stands out either way.'],
    [300, 'Nothing measured stands out either way.'],
    [301, 'Sharp.'],
  ])('focus %s', (sharpness, said) => {
    expect(why({ sharpness })).toBe(said);
  });

  it.each([
    [1.9, null],
    [2, 2],
    [-6.6, 7],
    [15, 15],
    [15.1, null],
  ])('a horizon %s° off level', (tilt, n) => {
    expect(why({ tilt })).toBe(n === null
      ? 'Nothing measured stands out either way.'
      : `Held back by: horizon tilted ${n}°.`);
  });

  it('names people only once one fills more than a seventh of the frame', () => {
    expect(why({ people: 2, peopleArea: 0.15 })).toBe('Nothing measured stands out either way.');
    expect(why({ people: 1, peopleArea: 0.2 })).toBe('Held back by: people fill much of the frame.');
  });

  it('names writing by its area or by its lines', () => {
    expect(why({ textArea: 0.08, textLines: 5 })).toBe('Nothing measured stands out either way.');
    expect(why({ textArea: 0.09 })).toBe('Held back by: a lot of writing in frame.');
    expect(why({ textLines: 6 })).toBe('Held back by: a lot of writing in frame.');
  });

  describe('the subject', () => {
    it('is clear when it is one thing near the middle', () => {
      expect(why({ subject: { x: 0.5, y: 0.5, area: 0.05 } })).toBe('A clear subject.');
      expect(why({ subject: { x: 0.85, y: 0.15, area: 0.6 } })).toBe('A clear subject.');
    });
    it('says nothing when it is a speck or the whole frame', () => {
      expect(why({ subject: { x: 0.5, y: 0.5, area: 0.04 } })).toBe('Nothing measured stands out either way.');
      expect(why({ subject: { x: 0.5, y: 0.5, area: 0.61 } })).toBe('Nothing measured stands out either way.');
    });
    it('is at the edge past 0.35 from the centre on either axis', () => {
      expect(why({ subject: { x: 0.86, y: 0.5, area: 0.2 } })).toBe('Held back by: subject pushed to the edge.');
      expect(why({ subject: { x: 0.5, y: 0.14, area: 0.2 } })).toBe('Held back by: subject pushed to the edge.');
    });
  });

  it('names greenery from Vision\'s labels at 0.3 or more, and no other label', () => {
    expect(why({ labels: [{ id: 'tree', p: 0.3 }] })).toBe('Greenery in frame.');
    expect(why({ labels: [{ id: 'tree', p: 0.29 }, { id: 'cafe', p: 0.9 }] }))
      .toBe('Nothing measured stands out either way.');
  });

  it('names a low resolution by the long side, and only when both sides are known', () => {
    expect(why({ width: 799, height: 600 })).toBe('Held back by: low resolution.');
    expect(why({ width: 600, height: 800 })).toBe('Nothing measured stands out either way.');
    expect(why({ width: 400 })).toBe('Nothing measured stands out either way.');
  });

  it('speaks Vietnamese and Japanese with their own punctuation', () => {
    const s: Signals = { brightness: 0.5, sharpness: 400, tilt: 3 };
    expect(why(s, {}, vi_)).toBe('Đủ sáng, rõ nét. Trừ điểm: đường chân trời nghiêng 3°.');
    expect(why(s, {}, ja)).toBe('明るさが適切、シャープ。減点：水平が3°傾いている。');
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
