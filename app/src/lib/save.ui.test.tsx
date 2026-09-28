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
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Collection, Place } from './data';
import { DAILY_CAPS, DAILY_LIMIT } from './quota';

const world = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  mine: {
    data: [] as unknown[], loading: false, loaded: true,
    error: null as string | null, reload: () => {},
  },
  historyOn: false,
  userId: undefined as string | null | undefined,
  listsFor: [] as (string | null | undefined)[],
  prefsFor: [] as (string | null | undefined)[],
}));
const goTo = vi.hoisted(() => vi.fn());
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const removePlaceFromCollection = vi.hoisted(() => vi.fn(async () => {}));
const logPlaceEvent = vi.hoisted(() => vi.fn(async () => {}));
const reload = vi.hoisted(() => vi.fn());

vi.mock('../nav', () => ({ goTo }));
vi.mock('./auth', () => ({ useAuth: () => ({ session: world.session, userId: world.userId }) }));
vi.mock('./city', () => ({ useCity: () => ({ city: { id: 'hanoi' } }) }));
vi.mock('./i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useMyCollections: (ownerId?: string | null) => (world.listsFor.push(ownerId), ownerId
    ? { ...world.mine, reload }
    : { data: [], loading: false, loaded: true, error: null, reload }),
  // `loaded` as well as the value: `SaveProvider` only believes the flag
  // once the row it describes has arrived, because the empty preferences
  // now read as recording. A mock without it says "still loading" and
  // suppresses every event.
  useMyPreferences: (ownerId?: string | null) => {
    world.prefsFor.push(ownerId);
    return { loaded: true, data: { history_on: world.historyOn } };
  },
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
  world.userId = undefined;
  world.listsFor = [];
  world.prefsFor = [];
  world.mine = { data: [], loading: false, loaded: true, error: null, reload: () => {} };
  world.historyOn = false;
  goTo.mockClear();
  addPlaceToCollection.mockClear();
  removePlaceFromCollection.mockClear();
  logPlaceEvent.mockClear();
  reload.mockClear();
});

// The lists hydrate with the catalog rather than a session read later:
// a bookmark that filled in a round trip after the card it sits on read
// as the app loading twice. See `Auth.userId`.
describe('whose lists, before the session is read', () => {
  it('the reader the last launch remembered — lists and preferences both', () => {
    world.session = null;
    world.userId = 'u1';
    world.mine = { ...world.mine, data: [list('weekend', ['cong-caphe'])] };
    mount();
    expect(world.listsFor.at(-1)).toBe('u1');
    expect(world.prefsFor.at(-1)).toBe('u1');
    expect(screen.getByTestId('saved').textContent).toBe('true');
  });

  it('the session’s reader over the one remembered', () => {
    world.userId = 'u2';
    mount();
    expect(world.listsFor.at(-1)).toBe('u1');
    expect(world.prefsFor.at(-1)).toBe('u1');
  });

  // Opening a sheet is an act, not a read: it waits for the real session.
  it('still asks a remembered-but-unconfirmed reader to sign in to save', () => {
    world.session = null;
    world.userId = 'u1';
    mount();
    tap();
    expect(screen.getByText('Save places you love')).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });
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

// A refused save is said, not swallowed — and the one refusal a reader can
// act on, the daily cap, is said in words of the app's own rather than the
// policy's.
describe('when the write is refused', () => {
  let alert: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    world.mine = { ...world.mine, data: [list('coffee')] };
    alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { alert.mockRestore(); });

  it('names the daily cap, with its number, and comes back tomorrow', async () => {
    addPlaceToCollection.mockImplementationOnce(async () => { throw new Error(DAILY_LIMIT); });
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(alert).toHaveBeenCalledOnce());
    expect(alert).toHaveBeenCalledWith(
      'That is enough for today',
      `You can save ${DAILY_CAPS.placesIntoLists} places a day. Come back tomorrow.`,
    );
    // Nothing happened, so nothing is asked again and nothing is noted.
    expect(reload).not.toHaveBeenCalled();
    expect(logPlaceEvent).not.toHaveBeenCalled();
  });

  it('says what went wrong for any other refusal', async () => {
    addPlaceToCollection.mockImplementationOnce(async () => { throw new Error('Network request failed'); });
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save', 'Network request failed'));
  });

  it('says it even when what was thrown is not an Error', async () => {
    addPlaceToCollection.mockImplementationOnce(async () => { throw 'offline'; });
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save', 'offline'));
  });
});

// The two sheets this provider draws, and their ways out.
describe('the sheets’ ways out', () => {
  // react-native-web's Modal keeps a closed sheet in the tree until its
  // fade-out ends, and jsdom never ends an animation — so the test ends
  // it, the way the browser would, before asking whether the sheet left.
  const fadeOut = () => {
    for (const el of document.querySelectorAll('[class*="r-animationKeyframes"]')) fireEvent.animationEnd(el);
  };
  it('closes the sign-in sheet without going anywhere', async () => {
    world.session = null;
    mount();
    tap();
    fireEvent.click(screen.getAllByLabelText('Close')[0]);
    fadeOut();
    await waitFor(() => expect(screen.queryByText('Save places you love')).toBeNull());
    expect(goTo).not.toHaveBeenCalled();
  });

  it('takes a guest to Sign in, over the Profile stack rather than instead of it', async () => {
    world.session = null;
    mount();
    tap();
    fireEvent.click(screen.getByText('Sign in'));
    expect(goTo).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
    fadeOut();
    await waitFor(() => expect(screen.queryByText('Save places you love')).toBeNull());
  });

  it('closes the lists sheet on Done', async () => {
    world.mine = { ...world.mine, data: [list('coffee')] };
    mount();
    tap();
    fireEvent.click(await screen.findByTestId('save-done'));
    fadeOut();
    await waitFor(() => expect(screen.queryByText('coffee')).toBeNull());
  });

  it('starts a new list with the place in hand', async () => {
    world.mine = { ...world.mine, data: [list('coffee')] };
    mount();
    tap();
    fireEvent.click(await screen.findByText('New collection'));
    expect(goTo).toHaveBeenCalledWith('Collections', {
      screen: 'CollectionForm', initial: false, params: { addPlaceSlug: 'cong-caphe' },
    });
    fadeOut();
    await waitFor(() => expect(screen.queryByText('coffee')).toBeNull());
  });
});
