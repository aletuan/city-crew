import { describe, expect, it } from 'vitest';
import { appleVision, detailsOf, explainScore, standingOf, suggestionsOf } from './photoScoreVision';
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
  it('details, suggests and ranks with this file\'s readings', () => {
    expect(appleVision.details).toBe(detailsOf);
    expect(appleVision.suggestions).toBe(suggestionsOf);
    expect(appleVision.standing).toBe(standingOf);
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

describe('detailsOf', () => {
  const rows = (signals: Signals, over: Partial<PhotoScore> = {}, t = en) => detailsOf(row(signals, over), t);
  const one = (signals: Signals, key: string, over: Partial<PhotoScore> = {}) =>
    rows(signals, over).find((d) => d.key === key);

  it('lists only what was measured, in reading order', () => {
    expect(rows({})).toEqual([]);
    const all = rows({
      brightness: 0.5, sharpness: 1500, subject: { x: 0.5, y: 0.5, area: 0.3 }, tilt: 1,
      peopleArea: 0, textLines: 0, labels: ROOM, width: 1600, height: 1200,
    });
    expect(all.map((d) => d.key)).toEqual(['light', 'focus', 'subject', 'level', 'clutter', 'green', 'size']);
  });

  // No composition and no colour: Vision measures neither (owner, 16 Oct).
  it('never lists a quality nobody measured', () => {
    const keys = rows({ brightness: 0.5, sharpness: 1500, labels: ROOM }).map((d) => d.key);
    expect(keys).not.toContain('composition');
    expect(keys).not.toContain('colour');
  });

  it('says what held a quality back before what helped it', () => {
    expect(one({ brightness: 0.5 }, 'light')).toMatchObject({ value: 'Well lit', tone: 'good' });
    expect(one({ brightness: 0.1, shadows: 0.5 }, 'light'))
      .toMatchObject({ value: 'A little dark, shadows lose detail', tone: 'warn' });
    expect(one({ brightness: 0.5, highlights: 0.3 }, 'light'))
      .toMatchObject({ value: 'Highlights blown out', tone: 'warn' });
    expect(one({ brightness: 0.3 }, 'light')).toMatchObject({ value: 'Neither dark nor bright', tone: 'plain' });
  });

  // The bar is the photograph's place in the catalog, not a score.
  it('ranks focus among the catalog\'s photographs', () => {
    const sharp = one({ sharpness: 2768 }, 'focus')!;
    expect(sharp).toMatchObject({ value: 'Sharp', tone: 'good', note: 'Sharper than 80% of the catalog\'s photos' });
    expect(sharp.rank).toBeCloseTo(0.8, 6);
    expect(one({ sharpness: 300 }, 'focus')).toMatchObject({ value: 'A little soft', tone: 'warn' });
    expect(one({ sharpness: 1385 }, 'focus')).toMatchObject({ value: 'Average', tone: 'plain', note: 'Sharper than 50% of the catalog\'s photos' });
  });

  it('says where the subject is, and when it is too small or too big to be one', () => {
    expect(one({ subject: { x: 0.5, y: 0.5, area: 0.3 } }, 'subject')).toMatchObject({ value: 'A clear subject', tone: 'good' });
    expect(one({ subject: { x: 0.95, y: 0.5, area: 0.3 } }, 'subject')).toMatchObject({ value: 'Subject pushed to the edge', tone: 'warn' });
    expect(one({ subject: { x: 0.5, y: 0.5, area: 0.01 } }, 'subject')).toMatchObject({ value: 'Small in the frame', tone: 'plain' });
    expect(one({ subject: { x: 0.5, y: 0.5, area: 0.9 } }, 'subject')).toMatchObject({ value: 'Fills most of the frame', tone: 'plain' });
  });

  // Only of a scene: on a close-up the "horizon" is a table's edge.
  it('reads the horizon of a scene only', () => {
    expect(one({ tilt: 6 }, 'level')).toBeUndefined();
    expect(one({ tilt: 6, labels: ROOM }, 'level')).toMatchObject({ value: 'Horizon tilted 6°', tone: 'warn' });
    expect(one({ tilt: 1, labels: ROOM }, 'level')).toMatchObject({ value: 'Level', tone: 'good' });
    expect(one({ labels: ROOM }, 'level')).toMatchObject({ value: 'None found', tone: 'plain' });
    expect(one({ tilt: -25, labels: ROOM }, 'level')).toMatchObject({ value: 'Tilted 25°, by the look of it on purpose', tone: 'plain' });
  });

  it('names what distracts, and says so when nothing does', () => {
    expect(one({ peopleArea: 0, textLines: 0 }, 'clutter')).toMatchObject({ value: 'Few people, little writing', tone: 'good' });
    expect(one({ peopleArea: 0.3 }, 'clutter')).toMatchObject({ value: 'People fill much of the frame', tone: 'warn' });
    expect(one({ textLines: 12 }, 'clutter')).toMatchObject({ value: 'A lot of writing in frame', tone: 'warn' });
  });

  // The sentence leaves a record's writing to its lead; the row still lists it.
  it('lists a record\'s writing, which the sentence says another way', () => {
    const record = { textLines: 20, labels: [{ id: 'menu', p: 0.6 }] };
    expect(one(record, 'clutter', { is_utility: true })).toMatchObject({ value: 'A lot of writing in frame', tone: 'warn' });
  });

  it('says greenery is there, or not seen', () => {
    expect(one({ labels: [{ id: 'plant', p: 0.6 }] }, 'green')).toMatchObject({ value: 'Greenery in frame', tone: 'good' });
    expect(one({ labels: [] }, 'green')).toMatchObject({ value: 'None seen', tone: 'plain' });
  });

  it('gives the size of the long side, and says when it is too small', () => {
    expect(one({ width: 1600, height: 1200 }, 'size')).toMatchObject({ value: '1600 px on the long side', tone: 'good' });
    expect(one({ width: 600, height: 500 }, 'size')).toMatchObject({ value: 'Low resolution', tone: 'warn' });
    expect(one({ width: 1600 }, 'size')).toBeUndefined();
  });

  it('reads a missing `signals` as nothing measured', () => {
    expect(detailsOf({ is_utility: false, signals: undefined as unknown as Signals }, en)).toEqual([]);
  });

  it('speaks Vietnamese', () => {
    const vi = rows({ sharpness: 2768, tilt: 6, labels: ROOM }, {}, vi_);
    expect(vi.find((d) => d.key === 'focus')).toMatchObject({ label: 'Độ nét', value: 'Rõ nét', note: 'Nét hơn 80% ảnh trong catalog' });
    expect(vi.find((d) => d.key === 'level')).toMatchObject({ label: 'Đường chân trời', value: 'Đường chân trời nghiêng 6°' });
  });
});

describe('suggestionsOf', () => {
  const tips = (signals: Signals, over: Partial<PhotoScore> = {}) => suggestionsOf(row(signals, over), en);

  it('has nothing to suggest when nothing held the photograph back', () => {
    expect(tips({ brightness: 0.5, sharpness: 2500, labels: ROOM, tilt: 0 })).toEqual([]);
  });

  it('suggests one thing for each that held it back', () => {
    expect(tips({ sharpness: 200, tilt: 6, labels: ROOM, peopleArea: 0.4 })).toEqual([
      'Hold the phone steady and tap the subject to focus.',
      'Straighten it: Edit → Crop in Photos levels the horizon.',
      'Choose a moment with fewer people, or keep them small in the frame.',
    ]);
    expect(tips({ brightness: 0.9 })).toEqual(['Avoid shooting into the light.']);
    expect(tips({ highlights: 0.4 })).toEqual(['Keep bright windows and lamps from filling the frame.']);
    expect(tips({ textLines: 12 })).toEqual(['Step back or crop so signs and menus do not fill the frame.']);
    expect(tips({ subject: { x: 0.02, y: 0.5, area: 0.2 } })).toEqual(['Bring the subject in from the edge.']);
    expect(tips({ width: 500, height: 400 })).toEqual(['Use the original photo, not a resized copy.']);
  });

  // Dark and shadows are one fault with one fix: said once.
  it('says a fix once, however many faults it answers', () => {
    expect(tips({ brightness: 0.1, shadows: 0.5 })).toEqual(['Choose a photo taken in more light.']);
  });

  // A menu's writing is what it is of, not a fault.
  it('suggests nothing about a record\'s writing', () => {
    expect(tips({ textLines: 20, labels: [{ id: 'menu', p: 0.6 }] }, { is_utility: true })).toEqual([]);
  });

  it('reads a missing `signals` as nothing to suggest', () => {
    expect(suggestionsOf({ is_utility: false, signals: undefined as unknown as Signals }, en)).toEqual([]);
  });
});

describe('standingOf', () => {
  it('is where the number stands among the catalog\'s', () => {
    expect(standingOf({ aesthetic: 0.508 })).toBeCloseTo(0.5, 6);
    expect(standingOf({ aesthetic: 0.9 })).toBe(1);
    expect(standingOf({ aesthetic: -0.5 })).toBe(0);
  });
  it('is nothing for a row with no number', () => {
    expect(standingOf({ aesthetic: null })).toBeNull();
  });
});
