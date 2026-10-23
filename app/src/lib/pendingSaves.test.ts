// What every screen shows of your lists between a tap and the database's
// answer. What is pinned: an entry moves a place in or out of the one
// list it names and no other, lands after the last member, follows the
// members a row carries and leaves a row without them alone, and an
// entry the lists already agree with changes nothing.

import { describe, expect, it } from 'vitest';
import { pendingKey, withPending } from './pendingSaves';
import type { Collection, Place } from './types';

const place = (slug: string) => ({ slug }) as Place;

const list = (slug: string, members: string[], carry = true): Collection => ({
  slug,
  collection_places: members.map((m, i) => ({ sort_order: i * 2, places: { slug: m } })),
  ...(carry ? { members: members.map(place) } : {}),
} as unknown as Collection);

const slugs = (c: Collection) => c.collection_places.map((cp) => cp.places?.slug);

describe('withPending', () => {
  it('hands the same lists back when nothing is pending', () => {
    const lists = [list('a', ['x'])];
    expect(withPending(lists, {})).toBe(lists);
  });

  it('puts a place into the list it names, after the last member', () => {
    const [a, b] = withPending([list('a', ['x', 'y']), list('b', ['x'])], {
      [pendingKey('a', 'z')]: { collection: 'a', place: place('z'), want: true },
    });
    expect(slugs(a)).toEqual(['x', 'y', 'z']);
    expect(a.collection_places[2].sort_order).toBe(3);
    expect(a.members?.map((p) => p.slug)).toEqual(['x', 'y', 'z']);
    expect(slugs(b)).toEqual(['x']);
  });

  it('takes a place out of the list it names, members and all', () => {
    const [a, b] = withPending([list('a', ['x', 'y']), list('b', ['x'])], {
      [pendingKey('a', 'x')]: { collection: 'a', place: place('x'), want: false },
    });
    expect(slugs(a)).toEqual(['y']);
    expect(a.members?.map((p) => p.slug)).toEqual(['y']);
    expect(slugs(b)).toEqual(['x']);
  });

  // A reload that already carries the change, or a tap that undid itself
  // before the write went out: nothing to apply, so the row is the same row.
  it('changes nothing the lists already agree with', () => {
    const lists = [list('a', ['x'])];
    const out = withPending(lists, {
      [pendingKey('a', 'x')]: { collection: 'a', place: place('x'), want: true },
      [pendingKey('a', 'y')]: { collection: 'a', place: place('y'), want: false },
    });
    expect(out[0]).toBe(lists[0]);
  });

  // The public rows resolve their places from the catalog by slug, and
  // carry no members to keep in step.
  it('leaves members off a row that never carried them', () => {
    const [a] = withPending([list('a', ['x'], false)], {
      [pendingKey('a', 'y')]: { collection: 'a', place: place('y'), want: true },
      [pendingKey('a', 'x')]: { collection: 'a', place: place('x'), want: false },
    });
    expect(slugs(a)).toEqual(['y']);
    expect(a.members).toBeUndefined();
  });
});
