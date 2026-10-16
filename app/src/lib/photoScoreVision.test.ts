import { describe, expect, it } from 'vitest';
import { appleVision, explainScore } from './photoScoreVision';
import type { PhotoScore, Signals, T } from './photoScore';

// The sentence under Apple Vision's number: what its measurements mean,
// on its own scales. The number and its word are every scorer's, and
// tested in `photoScore.test.ts`.

// English, Vietnamese and Japanese in turn, so a test can say which
// language it reads the sentence in.
const en: T = (e) => e;
const vi_: T = (_e, v) => v;
const ja: T = (_e, _v, j) => j ?? '';

const row = (signals: Signals, over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.4, is_utility: false, signals, ...over,
});
/** A scene with a horizon in it, so a tilt is worth saying. */
const ROOM = [{ id: 'interior_room', p: 0.8 }];
const why = (signals: Signals, over: Partial<PhotoScore> = {}, t = en) => explainScore(row(signals, over), t);

describe('appleVision', () => {
  // The name every row it wrote carries, in the database's own default:
  // a different spelling here would count all of them as unread.
  it('is the name and version the stored rows carry', () => {
    expect(appleVision.id).toBe('apple-vision');
    expect(appleVision.version).toBe(1);
  });
  it('explains with this file\'s sentence, and says who measured', () => {
    expect(appleVision.explain(row({ brightness: 0.5 }), en)).toBe('Well lit.');
    expect(appleVision.source(en)).toBe('Measured on this phone by Apple Vision.');
    expect(appleVision.source(vi_)).toBe('Đo trên máy bằng Apple Vision.');
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
    expect(why({ brightness: 0.5, sharpness: 2500, tilt: 4.4, labels: ROOM }))
      .toBe('Well lit, sharp. Held back by: horizon tilted 4°.');
  });

  describe('a record, not a picture', () => {
    const LEAD = 'Lots of writing in frame — it reads like a menu or a sign rather than a picture.';

    it('leads with it when Vision flags it and writing was measured', () => {
      expect(why({ brightness: 0.5, textLines: 12 }, { is_utility: true })).toBe(`${LEAD} Well lit.`);
      expect(why({ textLines: 10 }, { is_utility: true })).toBe(LEAD);
    });

    it('takes a document or board label as the evidence too', () => {
      expect(why({ labels: [{ id: 'chalkboard', p: 0.3 }] }, { is_utility: true })).toBe(LEAD);
      expect(why({ labels: [{ id: 'chalkboard', p: 0.29 }] }, { is_utility: true }))
        .toBe('Nothing measured stands out either way.');
    });

    // Bengal rooftop's bar, as the phone read it on 15 Oct 2026: flagged
    // by Vision, no writing, no document label, and Vision unsure of
    // everything it saw. The first build captioned it as a menu.
    it('says nothing of it when only the flag is there', () => {
      const bar: Signals = {
        width: 1200, height: 900, brightness: 0.114, shadows: 0.409, highlights: 0,
        sharpness: 947.5, textArea: 0, textLines: 0, people: 0, peopleArea: 0,
        subject: { x: 0.454, y: 0.49, area: 0.628 },
        labels: [
          { id: 'structure', p: 0.257 }, { id: 'furniture', p: 0.256 }, { id: 'table', p: 0.225 },
          { id: 'stool', p: 0.204 }, { id: 'art', p: 0.197 },
        ],
      };
      const said = why(bar, { is_utility: true });
      expect(said).toBe('Held back by: a little dark, shadows lose detail.');
      expect(why(bar, { is_utility: true }, vi_)).not.toMatch(/menu|thực đơn|biển hiệu|giấy tờ/);
    });

    it('says nothing of the flag on a reading with nothing measured beside it', () => {
      expect(why({}, { is_utility: true })).toBe('Nothing measured stands out either way.');
      expect(explainScore({ is_utility: true, signals: undefined as unknown as Signals }, en))
        .toBe('Nothing measured stands out either way.');
    });

    it('names the writing once, in the lead, not again among what held it back', () => {
      expect(why({ textLines: 12 }, { is_utility: true })).not.toContain('a lot of writing in frame');
      expect(why({ textLines: 12 })).toBe('Held back by: a lot of writing in frame.');
    });

    it('speaks Vietnamese and Japanese', () => {
      expect(why({ textLines: 12 }, { is_utility: true }, vi_))
        .toBe('Trong khung có nhiều chữ, trông như ảnh menu hoặc biển hiệu hơn là ảnh để ngắm.');
      expect(why({ textLines: 12 }, { is_utility: true }, ja))
        .toBe('文字が多く、鑑賞用の写真というよりメニューや看板のように見えます。');
    });
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

  // Cut where the 182 readings of 15 Oct 2026 fall: about the softest
  // tenth, and the sharpest quarter.
  it.each([
    [429, 'Held back by: a little soft.'],
    [430, 'Nothing measured stands out either way.'],
    [1256, 'Nothing measured stands out either way.'],
    [2000, 'Nothing measured stands out either way.'],
    [2001, 'Sharp.'],
  ])('focus %s', (sharpness, said) => {
    expect(why({ sharpness })).toBe(said);
  });

  it.each([
    [1.9, null],
    [2, 2],
    [-6.6, 7],
    [15, 15],
    [15.1, null],
  ])('a horizon %s° off level, in a scene', (tilt, n) => {
    expect(why({ tilt, labels: ROOM })).toBe(n === null
      ? 'Nothing measured stands out either way.'
      : `Held back by: horizon tilted ${n}°.`);
  });

  // O3 Brunswick's cup of coffee, shot from above: the "horizon" was the
  // table's edge (owner, 15 Oct 2026).
  it('says nothing of a tilt where there is no scene to have a horizon', () => {
    const cup: Signals = {
      tilt: 5, textArea: 0.48, textLines: 1,
      labels: [{ id: 'coffee', p: 0.85 }, { id: 'drink', p: 0.85 }, { id: 'tableware', p: 0.76 }],
    };
    expect(why(cup)).toBe('Nothing measured stands out either way.');
    expect(why({ tilt: 5 })).toBe('Nothing measured stands out either way.');
    // A scene label under 0.3 is not a scene.
    expect(why({ tilt: 5, labels: [{ id: 'interior_room', p: 0.29 }] })).toBe('Nothing measured stands out either way.');
    expect(why({ tilt: 5, labels: [{ id: 'street', p: 0.3 }] })).toBe('Held back by: horizon tilted 5°.');
  });

  it('names people only once one fills more than a seventh of the frame', () => {
    expect(why({ people: 2, peopleArea: 0.15 })).toBe('Nothing measured stands out either way.');
    expect(why({ people: 1, peopleArea: 0.2 })).toBe('Held back by: people fill much of the frame.');
  });

  // Counted in lines, not area: one false box round half the frame is not
  // writing (O3 Brunswick, owner, 15 Oct 2026), and real writing is many
  // thin lines over little of it.
  it('names writing by its lines, from ten, and never by area alone', () => {
    expect(why({ textLines: 9, textArea: 0.5 })).toBe('Nothing measured stands out either way.');
    expect(why({ textLines: 10, textArea: 0.04 })).toBe('Held back by: a lot of writing in frame.');
    // The counter with a small menu: one box, 37% of the frame.
    expect(why({ textLines: 1, textArea: 0.37 })).toBe('Nothing measured stands out either way.');
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
    const s: Signals = { brightness: 0.5, sharpness: 2500, tilt: 3, labels: ROOM };
    expect(why(s, {}, vi_)).toBe('Đủ sáng, rõ nét. Trừ điểm: đường chân trời nghiêng 3°.');
    expect(why(s, {}, ja)).toBe('明るさが適切、シャープ。減点：水平が3°傾いている。');
  });
});
