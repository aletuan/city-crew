// What every screen shows of your lists between a tap and the database's
// answer. What is pinned: an entry moves a place in or out of the one
// list it names and no other, lands after the last member, follows the
// members a row carries and leaves a row without them alone, and an
// entry the lists already agree with changes nothing. And `addAll`: each
// place handed on after the one before it, none that is already in.

import { describe, expect, it, vi } from 'vitest';
import { addAll, pendingKey, withPending } from './pendingSaves';
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

describe('addAll', () => {
  // Each write takes its place from the list it is handed: handed the
  // same list five times, five places would share one place in the order.
  it('hands each place the list with the ones before it already in', () => {
    const toggle = vi.fn();
    addAll(list('a', ['x', 'y']), [place('p'), place('q'), place('r')], toggle);
    expect(toggle.mock.calls.map(([c, p]) => [p.slug, slugs(c)])).toEqual([
      ['p', ['x', 'y']],
      ['q', ['x', 'y', 'p']],
      ['r', ['x', 'y', 'p', 'q']],
    ]);
    expect(toggle.mock.calls.map(([c]) => c.collection_places.at(-1).sort_order)).toEqual([2, 3, 4]);
  });

  // `toggle` takes a place out of a list it is in: one already there, or
  // handed twice, is left where it is.
  it('leaves alone a place the list already holds', () => {
    const toggle = vi.fn();
    addAll(list('a', ['x']), [place('x'), place('p'), place('p')], toggle);
    expect(toggle.mock.calls.map(([, p]) => p.slug)).toEqual(['p']);
  });
});
