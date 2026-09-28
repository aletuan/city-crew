// @vitest-environment jsdom
//
// What the app is told about a reader, and what it is allowed to remember.
//
// How a taste is weighed is `taste.ts`'s, held at 100% in Node. What is
// left here is which signals reach it — the reader's own lists, their
// likes, the places they suggested, and, only with the history switch on,
// the places they opened and passed over — and the one thing this file
// promises the privacy policy: with the switch off, nothing is noted and
// nothing noted is read back. `tasteFrom` is stood in for so that what
// is under test is the wiring, not the maths.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '../uitest/render';
import type { Place } from './types';

const place = (slug: string, over: Partial<Place> = {}) => ({ slug, ...over } as Place);

const world = vi.hoisted(() => ({
  uid: 'me' as string | null,
  prefs: { loaded: true, data: { history_on: false, categories: [] as string[] } },
  places: [] as unknown[],
  mine: [] as unknown[],
  collections: [] as unknown[],
  myLikes: [] as string[],
  city: { id: 'hanoi' } as { id: string } | null,
}));
const spies = vi.hoisted(() => ({
  tasteFrom: vi.fn((_signals: Record<string, unknown>) => ({ affinity: {} })),
  fetchPassedOver: vi.fn(async (_uid: string, _since: string) => ['passed-a']),
  logPlaceEvent: vi.fn(async () => {}),
}));

vi.mock('./auth', () => ({ useAuth: () => ({ session: world.uid ? { user: { id: world.uid } } : null }) }));
vi.mock('./catalog', () => ({
  usePlaces: () => ({ data: world.places }),
  useCatalog: () => ({ collections: { data: world.collections }, myLikes: world.myLikes }),
}));
vi.mock('./city', () => ({ useCity: () => ({ city: world.city }) }));
vi.mock('./save', () => ({ useSave: () => ({ mine: { data: world.mine } }) }));
vi.mock('./data', () => ({
  fetchPassedOver: spies.fetchPassedOver,
  logPlaceEvent: spies.logPlaceEvent,
  useMyPreferences: () => world.prefs,
}));
vi.mock('./taste', () => ({ tasteFrom: spies.tasteFrom }));

import { useBrowseTaste, useNoteEvent, usePlanProfile } from './tasteProfile';

const slugs = (xs: unknown) => (xs as Place[]).map((p) => p.slug);
const lastSignals = () => spies.tasteFrom.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
  world.uid = 'me';
  world.prefs = { loaded: true, data: { history_on: false, categories: [] } };
  world.places = [
    place('saved-a'), place('mine-b', { submitted_by: 'me' }), place('liked-c'), place('elsewhere'),
  ];
  world.mine = [{ slug: 'my-list', members: [place('saved-a')] }];
  world.collections = [
    { id: 'c-liked', slug: 'liked-list', members: [place('liked-c')] },
    { id: 'c-other', slug: 'other-list', members: [place('elsewhere')] },
  ];
  world.myLikes = ['c-liked'];
  world.city = { id: 'hanoi' };
  for (const f of Object.values(spies)) f.mockClear();
  return () => vi.useRealTimers();
});

describe('the planner’s profile', () => {
  let seen: ReturnType<typeof usePlanProfile>;
  const Probe = () => { seen = usePlanProfile(); return null; };

  it('reads the reader’s own lists, suggestions and likes — and not a list they did not like', () => {
    render(<Probe />);
    const s = lastSignals();
    expect(slugs(s.saved)).toEqual(['saved-a']);
    expect(slugs(s.suggested)).toEqual(['mine-b']);
    expect(slugs(s.liked)).toEqual(['liked-c']);
    expect(seen.taste).toEqual({ affinity: {} });
    expect(seen.budgetVnd).toBeNull();
  });

  it('with the history switch off, never reads what was passed over', async () => {
    render(<Probe />);
    await act(async () => {});
    expect(spies.fetchPassedOver).not.toHaveBeenCalled();
    expect(lastSignals().passedOver).toEqual([]);
  });

  it('with it on, reads the last ninety days of it and weighs it', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual(['passed-a']));
    expect(spies.fetchPassedOver).toHaveBeenCalledWith('me', '2026-06-30T09:00:00.000Z');
  });

  it('forgets it again the moment the switch goes off', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    const { rerender } = render(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual(['passed-a']));
    world.prefs = { loaded: true, data: { history_on: false, categories: [] } };
    rerender(<Probe />);
    await waitFor(() => expect(lastSignals().passedOver).toEqual([]));
  });

  it('keeps going without it when the read fails', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    spies.fetchPassedOver.mockRejectedValueOnce(new Error('offline'));
    render(<Probe />);
    await act(async () => {});
    expect(lastSignals().passedOver).toEqual([]);
    expect(seen.taste).not.toBeNull();
  });

  it('knows nothing about a guest', () => {
    world.uid = null;
    render(<Probe />);
    expect(seen.taste).toBeNull();
    expect(spies.tasteFrom).not.toHaveBeenCalled();
  });
});

describe('the browse taste', () => {
  let seen: Awaited<ReturnType<typeof useBrowseTaste>>;
  const Probe = () => { seen = useBrowseTaste(); return null; };

  it('leads with the kinds the reader picked, dropping any the app no longer has', () => {
    world.prefs = { loaded: true, data: { history_on: false, categories: ['cafes', 'no-such-kind', 'cafes'] } };
    render(<Probe />);
    const s = lastSignals();
    expect(s.preferred).toEqual(['cafes']);
    expect(slugs(s.saved)).toEqual(['saved-a']);
    expect(seen).toEqual({ affinity: {} });
  });

  // Browsing ranks for everyone who opens the tab; what somebody passed
  // over is the planner's to weigh, with their switch on, and not this.
  it('never reads what was passed over, even with the switch on', async () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    await act(async () => {});
    expect(spies.fetchPassedOver).not.toHaveBeenCalled();
    expect(lastSignals()).not.toHaveProperty('passedOver');
  });

  it('knows nothing about a guest', () => {
    world.uid = null;
    render(<Probe />);
    expect(seen).toBeNull();
  });
});

// The privacy policy's own sentence, as code: with history off, nothing
// is noted. `logPlaceEvent` refuses on `allowed: false`; what this hook
// owes it is the right answer for `allowed`.
describe('noting what the reader does', () => {
  let note: ReturnType<typeof useNoteEvent>;
  const Probe = () => { note = useNoteEvent(); return null; };

  it('notes with the switch on, for this reader and this city', () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', 'hanoi', true);
  });

  it('says not allowed with the switch off', () => {
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', 'hanoi', false);
  });

  // Before the preferences row has arrived the switch reads as its
  // default, which is not the reader's answer. Until it is, the answer
  // is no.
  it('says not allowed while the switch has not loaded, whatever it reads', () => {
    world.prefs = { loaded: false, data: { history_on: true, categories: [] } };
    render(<Probe />);
    note('pho-10', 'save');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'save', 'hanoi', false);
  });

  it('passes no city when none is chosen', () => {
    world.prefs = { loaded: true, data: { history_on: true, categories: [] } };
    world.city = null;
    render(<Probe />);
    note('pho-10', 'open');
    expect(spies.logPlaceEvent).toHaveBeenCalledWith('me', 'pho-10', 'open', null, true);
  });
});
