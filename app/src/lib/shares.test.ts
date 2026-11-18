// The owner's side of a shared list, as arithmetic. What is pinned here is
// the table at the head of `shares.ts` — Public wins over shares, a share
// makes Private into Friends — and the one rule that protects a friend
// nobody touched: a share the crew copy does not know about is still drawn,
// so the button's difference cannot unshare it.

import { describe, expect, it } from 'vitest';
import {
  diffShares, likeable, namesBriefly, readerMark, shareCta, shareRows, sharesByList, visibilityOf, type ShareRow,
  SEEN_GLYPH, seenGloss, seenName,
} from './shares';

// The language the caller asked for, by position: en, vi, ja, zh.
const at = (i: number) => (...words: (string | undefined)[]) => words[i] as string;
const en = at(0);

describe('visibilityOf', () => {
  it('says Public for a public list, whoever it is shared with', () => {
    expect(visibilityOf(true, 0)).toBe('public');
    expect(visibilityOf(true, 3)).toBe('public');
  });

  it('says Friends for a private list with a guest list, and Private without one', () => {
    expect(visibilityOf(false, 1)).toBe('friends');
    expect(visibilityOf(false, 0)).toBe('private');
  });
});

describe('sharesByList', () => {
  const row = (collection_id: string, user_id: string, created_at: string): ShareRow => ({ collection_id, user_id, created_at });

  it('files each friend under their list, in the order they were named', () => {
    expect(sharesByList([
      row('a', 'ha', '2026-11-13T10:02:00Z'),
      row('b', 'lan', '2026-11-13T09:00:00Z'),
      row('a', 'minh', '2026-11-13T10:01:00Z'),
    ])).toEqual({ a: ['minh', 'ha'], b: ['lan'] });
  });

  it('answers nothing for nothing', () => {
    expect(sharesByList([])).toEqual({});
  });
});

describe('shareRows', () => {
  it('lists the crew in its own order', () => {
    expect(shareRows(['lan', 'minh', 'ha'], [], [])).toEqual(['lan', 'minh', 'ha']);
  });

  // The policy refuses them, and a tick that cannot be written is not a
  // row to draw.
  it('leaves out a friend the reader has blocked', () => {
    expect(shareRows(['lan', 'minh'], [], ['minh'])).toEqual(['lan']);
  });

  // Already on the list, so the only thing the owner can do about them is
  // take them off — which the row must be there to allow.
  it('keeps a blocked friend the list is still shared with, at the end', () => {
    expect(shareRows(['minh', 'lan'], ['minh'], ['minh'])).toEqual(['lan', 'minh']);
  });

  it('adds a share the crew copy does not know, at the end, once', () => {
    expect(shareRows(['lan'], ['ha', 'lan'], [])).toEqual(['lan', 'ha']);
    expect(shareRows([], ['ha'], [])).toEqual(['ha']);
  });
});

describe('diffShares', () => {
  it('adds the new ticks and takes off the cleared ones', () => {
    expect(diffShares(['lan', 'minh'], new Set(['minh', 'ha']))).toEqual({ add: ['ha'], remove: ['lan'] });
  });

  it('writes nothing for the same set', () => {
    expect(diffShares(['lan'], new Set(['lan']))).toEqual({ add: [], remove: [] });
  });

  it('takes everyone off when nobody is ticked', () => {
    expect(diffShares(['lan', 'ha'], new Set())).toEqual({ add: [], remove: ['lan', 'ha'] });
  });
});

describe('shareCta', () => {
  it('counts who will have it, not who is new', () => {
    expect(shareCta(['lan'], new Set(['lan', 'ha']), false)).toEqual({ kind: 'share', n: 2, live: true });
  });

  it('is not live for the same ticks on a private list', () => {
    expect(shareCta(['lan'], new Set(['lan']), false)).toEqual({ kind: 'share', n: 1, live: false });
  });

  // Sharing a public list makes it private: the same ticks still change
  // who can see it.
  it('is live for the same ticks on a public list', () => {
    expect(shareCta(['lan'], new Set(['lan']), true)).toEqual({ kind: 'share', n: 1, live: true });
  });

  it('is live when only a removal moved', () => {
    expect(shareCta(['lan', 'ha'], new Set(['lan']), false)).toEqual({ kind: 'share', n: 1, live: true });
  });

  it('offers Keep private once everyone is unticked on a shared list', () => {
    expect(shareCta(['lan'], new Set(), false)).toEqual({ kind: 'private' });
  });

  it('offers nothing with nobody ticked and nobody to take off, or on a public list', () => {
    expect(shareCta([], new Set(), false)).toEqual({ kind: 'none' });
    expect(shareCta(['lan'], new Set(), true)).toEqual({ kind: 'none' });
    expect(shareCta([], new Set(), true)).toEqual({ kind: 'none' });
  });
});

// The three answers, as words: under your handle on the list's page, on
// its sheet's rows, and in a line at the head of its form (16 Nov 2026).
describe('the three answers, said', () => {
  const vi = (_en: string, v: string) => v;

  it('gives each its own glyph', () => {
    expect(SEEN_GLYPH).toEqual({ public: 'globe-outline', friends: 'people-outline', private: 'lock-closed-outline' });
  });

  it('names each in one word, in the reader’s language', () => {
    expect((['public', 'friends', 'private'] as const).map((k) => seenName(k, en))).toEqual(['Public', 'Friends', 'Private']);
    expect((['public', 'friends', 'private'] as const).map((k) => seenName(k, vi))).toEqual(['Công khai', 'Bạn bè', 'Riêng tư']);
  });

  it('says what each means in the few words that fit beside its name', () => {
    expect(seenGloss('public', en)).toBe('Everyone can see it');
    expect(seenGloss('friends', en)).toBe('Only the friends you choose');
    expect(seenGloss('private', en)).toBe('Only you can see it');
    expect((['public', 'friends', 'private'] as const).map((k) => seenGloss(k, vi)))
      .toEqual(['Mọi người có thể xem', 'Chỉ những bạn bè bạn chọn', 'Chỉ mình bạn thấy']);
  });
});

describe('namesBriefly', () => {
  it('names one, two and three in full', () => {
    expect(namesBriefly(['Minh Anh'], en)).toBe('Minh Anh');
    expect(namesBriefly(['Minh Anh', 'Hà My'], en)).toBe('Minh Anh and Hà My');
    expect(namesBriefly(['Minh Anh', 'Hà My', 'Lan'], en)).toBe('Minh Anh, Hà My and Lan');
  });

  it('names two and counts the rest past three', () => {
    expect(namesBriefly(['Minh Anh', 'Hà My', 'Lan', 'Đức', 'Vy'], en)).toBe('Minh Anh, Hà My and 3 others');
    expect(namesBriefly(['a', 'b', 'c', 'd'], en)).toBe('a, b and 2 others');
  });

  it('is empty for nobody', () => {
    expect(namesBriefly([], en)).toBe('');
  });

  it('says it in each language', () => {
    const five = ['A', 'B', 'C', 'D', 'E'];
    expect(namesBriefly(['A', 'B'], at(1))).toBe('A và B');
    expect(namesBriefly(['A', 'B', 'C'], at(2))).toBe('A、B、C');
    expect(namesBriefly(five, at(1))).toBe('A, B và 3 người khác');
    expect(namesBriefly(five, at(2))).toBe('A、Bほか3人');
    expect(namesBriefly(five, at(3))).toBe('A、B和另外 3 人');
  });
});

// The app's copy of the insert policy on `collection_likes`.
describe('likeable', () => {
  it('is anybody’s on a public list, shared or not, yours or not', () => {
    expect(likeable(true, true, 0)).toBe(true);
    expect(likeable(true, false, 0)).toBe(true);
    expect(likeable(true, true, 3)).toBe(true);
  });

  it('is yours on a list of your own once it is shared with somebody', () => {
    expect(likeable(false, true, 1)).toBe(true);
    expect(likeable(false, true, 4)).toBe(true);
  });

  it('is nobody’s on a list of your own shared with nobody', () => {
    expect(likeable(false, true, 0)).toBe(false);
  });

  // Not public and not yours: it reached you through a share.
  it('is the friend’s on a list lent to them', () => {
    expect(likeable(false, false, 0)).toBe(true);
  });
});

// What a reader who is not the owner sees under the handle.
describe('readerMark', () => {
  it('is the globe on a person’s public list', () => {
    expect(readerMark({ is_public: true, owner_id: 'lan' }, false)).toBe('public');
  });

  it('is "lent" on a list that is not public, said or unsaid', () => {
    expect(readerMark({ is_public: false, owner_id: 'lan' }, false)).toBe('lent');
    expect(readerMark({ owner_id: 'lan' }, false)).toBe('lent');
    expect(readerMark({ is_public: null, owner_id: 'lan' }, false)).toBe('lent');
  });

  it('is nothing for the owner, who has their own mark there', () => {
    expect(readerMark({ is_public: true, owner_id: 'me' }, true)).toBeNull();
    expect(readerMark({ is_public: false, owner_id: 'me' }, true)).toBeNull();
  });

  it('is nothing on a list of the desk’s, which has no person', () => {
    expect(readerMark({ is_public: true, owner_id: null }, false)).toBeNull();
    expect(readerMark({ is_public: true }, false)).toBeNull();
  });

  it('is nothing before there is a list', () => {
    expect(readerMark(null, false)).toBeNull();
    expect(readerMark(undefined, false)).toBeNull();
  });
});
