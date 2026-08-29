// @vitest-environment jsdom
//
// The bookmark's three-way branch.
//
// Every place card, every detail screen and the search results share one
// save control, and what a tap on it does depends on facts none of them
// hold: whether anybody is signed in, whether they have a list to put it
// in, and whether that answer has arrived yet. The third is the one that
// shipped wrong — `data.length === 0` is true while the first fetch is
// still out, which sent people who *had* collections to "Name your list".
//
// It renders `AuthSheet` and `SaveSheet` itself, which is why this is a
// rendered test rather than a test of a function.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Collection, Place } from './data';

const world = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  mine: {
    data: [] as unknown[], loading: false, loaded: true,
    error: null as string | null, reload: () => {},
  },
  historyOn: false,
}));
const goTo = vi.hoisted(() => vi.fn());
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const removePlaceFromCollection = vi.hoisted(() => vi.fn(async () => {}));
const logPlaceEvent = vi.hoisted(() => vi.fn(async () => {}));
const reload = vi.hoisted(() => vi.fn());

vi.mock('../nav', () => ({ goTo }));
vi.mock('./auth', () => ({ useAuth: () => ({ session: world.session }) }));
vi.mock('./city', () => ({ useCity: () => ({ city: { id: 'hanoi' } }) }));
vi.mock('./i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useMyCollections: (ownerId?: string | null) => (ownerId
    ? { ...world.mine, reload }
    : { data: [], loading: false, loaded: true, error: null, reload }),
  // `loaded` as well as the value: `SaveProvider` only believes the flag
  // once the row it describes has arrived, because the empty preferences
  // now read as recording. A mock without it says "still loading" and
  // suppresses every event.
  useMyPreferences: () => ({ loaded: true, data: { history_on: world.historyOn } }),
  addPlaceToCollection,
  removePlaceFromCollection,
  logPlaceEvent,
}));

import { SaveProvider, useSave } from './save';

const place = { slug: 'cong-caphe', name_en: 'Cong Caphe', name_vi: 'Cộng' } as unknown as Place;

const list = (slug: string, members: string[] = []): Collection => ({
  slug,
  title_en: slug,
  collection_places: members.map((m, i) => ({ sort_order: i, places: { slug: m } })),
} as unknown as Collection);

/** A consumer, because `useSave` is the whole surface under test. */
function Tapper({ target = place }: { target?: Place }) {
  const { save, isSaved, mine } = useSave();
  return (
    <>
      <button type="button" onClick={() => save(target)}>tap the bookmark</button>
      <span data-testid="saved">{String(isSaved(target.slug))}</span>
      <span data-testid="count">{mine.data.length}</span>
    </>
  );
}

const mount = (node: React.ReactNode = <Tapper />) =>
  render(<SaveProvider>{node}</SaveProvider>);

const tap = () => fireEvent.click(screen.getByText('tap the bookmark'));

beforeEach(() => {
  world.session = { user: { id: 'u1' } };
  world.mine = { data: [], loading: false, loaded: true, error: null, reload: () => {} };
  world.historyOn = false;
  goTo.mockClear();
  addPlaceToCollection.mockClear();
  removePlaceFromCollection.mockClear();
  logPlaceEvent.mockClear();
  reload.mockClear();
});

describe('signed out', () => {
  it('asks them to sign in rather than doing nothing', () => {
    world.session = null;
    mount();
    tap();
    expect(screen.getByText('Save places you love')).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });

  // Nothing is saved for nobody: the lists hook is handed no owner, so the
  // bookmark on every card draws empty rather than inheriting whatever the
  // last session left behind.
  it('never reports a place as saved', () => {
    world.session = null;
    world.mine = { ...world.mine, data: [list('trips', ['cong-caphe'])] };
    mount();
    expect(screen.getByTestId('saved').textContent).toBe('false');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});

describe('signed in with nowhere to put it', () => {
  // Straight to making the list, carrying the place: the collection
  // arrives with its first member rather than arriving empty.
  it('goes to the form with the place in hand', () => {
    mount();
    tap();
    expect(goTo).toHaveBeenCalledWith('Collections', {
      screen: 'CollectionForm', initial: false, params: { addPlaceSlug: 'cong-caphe' },
    });
  });

  // The bug this is here for: `data` is just as empty while the first
  // fetch is still out — the moment after launch a bookmark is likeliest
  // to be tapped — and branching on that emptiness sent people who *had*
  // collections to "Name your list".
  it('does not mistake a load still in flight for having no lists', () => {
    world.mine = { ...world.mine, data: [], loaded: false, loading: true };
    mount();
    tap();
    expect(goTo).not.toHaveBeenCalled();
  });

  // Nor a failed one: an error is not an answer about how many lists
  // somebody has.
  it('does not mistake a failed load for having no lists', () => {
    world.mine = { ...world.mine, data: [], loaded: true, error: 'offline' };
    mount();
    tap();
    expect(goTo).not.toHaveBeenCalled();
  });

  it('asks again when the first load never landed', () => {
    world.mine = { ...world.mine, data: [], loaded: false, loading: false };
    mount();
    tap();
    expect(reload).toHaveBeenCalled();
  });
});

describe('signed in with somewhere to put it', () => {
  beforeEach(() => {
    world.mine = { ...world.mine, data: [list('coffee'), list('weekend', ['cong-caphe'])] };
  });

  it('opens the sheet rather than navigating away', () => {
    mount();
    tap();
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByText('coffee')).toBeTruthy();
    expect(screen.getByText('weekend')).toBeTruthy();
  });

  it('reads the place as saved when any list holds it', () => {
    mount();
    expect(screen.getByTestId('saved').textContent).toBe('true');
  });

  it('adds it to the list that was tapped', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledWith('coffee', 'cong-caphe', 0));
  });

  it('takes it back out of a list that already holds it', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('weekend'));
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalledWith('weekend', 'cong-caphe'));
    expect(addPlaceToCollection).not.toHaveBeenCalled();
  });

  it('refetches the lists so every copy agrees', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});

// The event is noted here rather than in the sheet because this is the one
// place both verbs pass through — and only after the write succeeded: an
// event for a save that did not happen is worse than no event.
describe('what gets remembered', () => {
  beforeEach(() => {
    world.mine = { ...world.mine, data: [list('coffee')] };
  });

  it('notes the save once the write landed', async () => {
    world.historyOn = true;
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(logPlaceEvent)
      .toHaveBeenCalledWith('u1', 'cong-caphe', 'save', 'hanoi', true));
  });

  it('passes the opt-in along as it stands', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(logPlaceEvent)
      .toHaveBeenCalledWith('u1', 'cong-caphe', 'save', 'hanoi', false));
  });

  it('notes nothing when the write was refused', async () => {
    addPlaceToCollection.mockImplementationOnce(async () => { throw new Error('refused'); });
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalled());
    expect(logPlaceEvent).not.toHaveBeenCalled();
  });
});
