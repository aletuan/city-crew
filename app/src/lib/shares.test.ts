// The owner's side of a shared list, as arithmetic. What is pinned here is
// the table at the head of `shares.ts` — Public wins over shares, a share
// makes Private into Friends — and the one rule that protects a friend
// nobody touched: a share the crew copy does not know about is still drawn,
// so the button's difference cannot unshare it.

import { describe, expect, it } from 'vitest';
import {
  diffShares, namesBriefly, shareCta, shareRows, sharesByList, visibilityOf, type ShareRow,
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
