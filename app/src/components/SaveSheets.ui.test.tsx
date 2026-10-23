// @vitest-environment jsdom
//
// The bookmark's three-way branch.
//
// Every place card, every detail screen and the search results share one
// save control, and what a tap on it does depends on facts none of them
// hold: whether anybody is signed in, whether they have a list to put it
// in, and whether that answer has arrived yet. The third is the one that
// shipped wrong — `data.length === 0` is true while the first fetch is
// still out, which sent people who *had* collections to "New collection".
//
// A rendered test rather than a test of a function, because the answer
// to a tap is a sheet. `lib/save` holds the state and `SaveSheets` draws
// it, so this mounts the two together, as `App.tsx` does — and lives here
// rather than beside the provider because lint keeps `lib/` from
// importing a component, its tests included. It was `lib/save.ui.test.tsx`
// until 20 Oct 2026, when the drawing moved out of the provider.

import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Collection, Place } from '../lib/data';
import { DAILY_CAPS, DAILY_LIMIT } from '../lib/quota';

const world = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  mine: {
    data: [] as unknown[], loading: false, loaded: true,
    error: null as string | null, reload: () => {},
    loadedAt: null as number | null, fromCache: false,
  },
  historyOn: false,
  userId: undefined as string | null | undefined,
  listsFor: [] as (string | null | undefined)[],
  prefsFor: [] as (string | null | undefined)[],
}));
const goTo = vi.hoisted(() => vi.fn());
// The root as the tab bar holds it, with the reader on Places (route
// `Explore`). `ready` false is a launch before the container mounted.
const navRef = vi.hoisted(() => ({
  ready: true,
  isReady() { return this.ready; },
  getRootState: () => ({ index: 1, routes: [{ name: 'Ideas' }, { name: 'Explore' }] }),
}));
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const removePlaceFromCollection = vi.hoisted(() => vi.fn(async () => {}));
const logPlaceEvent = vi.hoisted(() => vi.fn(async () => {}));
const reload = vi.hoisted(() => vi.fn());

vi.mock('../nav', () => ({ goTo, navRef }));
vi.mock('../lib/auth', () => {
  const m = { useAuth: () => ({ session: world.session, userId: world.userId }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/city', () => {
  const m = { useCity: () => ({ city: { id: 'hanoi' } }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/data', async (orig) => ({
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

import { SaveProvider, useMyLists, useSave, useSaveActions } from '../lib/save';
import SaveSheets from './SaveSheets';
import { dropResume, takeResume } from '../lib/resume';

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
  render(<SaveProvider>{node}<SaveSheets /></SaveProvider>);

const tap = () => fireEvent.click(screen.getByText('tap the bookmark'));

beforeEach(() => {
  world.session = { user: { id: 'u1' } };
  world.userId = undefined;
  world.listsFor = [];
  world.prefsFor = [];
  world.mine = { data: [], loading: false, loaded: true, error: null, reload: () => {}, loadedAt: null, fromCache: false };
  world.historyOn = false;
  goTo.mockClear();
  navRef.ready = true;
  dropResume();
  addPlaceToCollection.mockClear();
  removePlaceFromCollection.mockClear();
  logPlaceEvent.mockClear();
  reload.mockClear();
});

// The lists hydrate with the catalog rather than a session read later:
// a bookmark that filled in a round trip after the card it sits on read
// as the app loading twice. See `Auth.userId`.
// The SOLID review's split (19 Oct 2026): the lists and the acts are two
// hooks, the lists are the whole `Fetch`, and `useSave` is still both.
describe('the two halves', () => {
  // Read off a holder, written after render: a component must not change
  // what it does not own while it renders.
  const seen: {
    lists?: ReturnType<typeof useMyLists>;
    acts?: ReturnType<typeof useSaveActions>;
    both?: ReturnType<typeof useSave>;
  } = {};
  function Probe() {
    const lists = useMyLists();
    const acts = useSaveActions();
    const both = useSave();
    useEffect(() => { Object.assign(seen, { lists, acts, both }); });
    return null;
  }

  it('hands out the lists as the whole Fetch, error and loadedAt included', () => {
    world.mine = { ...world.mine, error: 'offline', loadedAt: 1234, fromCache: true, data: [list('weekend', ['cong-caphe'])] };
    render(<SaveProvider><Probe /></SaveProvider>);
    expect(seen.lists).toMatchObject({ error: 'offline', loadedAt: 1234, fromCache: true, loading: false });
    expect(seen.lists!.data.map((c) => c.slug)).toEqual(['weekend']);
    expect(seen.lists!.reload).toBe(reload);
  });

  it('hands out the acts on their own, and both as useSave', () => {
    world.mine = { ...world.mine, data: [list('weekend', ['cong-caphe'])] };
    render(<SaveProvider><Probe /></SaveProvider>);
    expect(Object.keys(seen.acts!).sort()).toEqual(['askToSignIn', 'isSaved', 'save']);
    expect(seen.acts!.isSaved('cong-caphe')).toBe(true);
    expect(seen.both!.save).toBe(seen.acts!.save);
    expect(seen.both!.mine.data.map((c) => c.slug)).toEqual(['weekend']);
  });

  it('reads as nothing saved and nothing loaded outside a provider', () => {
    render(<Probe />);
    expect(seen.lists).toMatchObject({ data: [], loaded: false, error: null, loadedAt: null });
    expect(seen.acts!.isSaved('anything')).toBe(false);
    seen.acts!.save({} as never);
    seen.acts!.askToSignIn();
    seen.lists!.reload();
  });
});

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
    expect(screen.getByText('Save this place')).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe('signed out', () => {
  it('asks them to sign in rather than doing nothing', () => {
    world.session = null;
    mount();
    tap();
    expect(screen.getByText('Save this place')).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });

  // The sheet names what was reached for. It used to say "Save places you
  // love" whatever was tapped, a heart included.
  it('names a place when a bookmark opened it', () => {
    world.session = null;
    mount();
    tap();
    expect(screen.getByText('Save this place')).toBeTruthy();
    expect(screen.queryByText('Like this collection')).toBeNull();
  });

  it('names the collection when a heart opened it', () => {
    world.session = null;
    function Liker() {
      const { askToSignIn } = useSave();
      return <button type="button" onClick={() => askToSignIn('like')}>tap the heart</button>;
    }
    mount(<Liker />);
    fireEvent.click(screen.getByText('tap the heart'));
    expect(screen.getByText('Like this collection')).toBeTruthy();
    expect(screen.queryByText('Save this place')).toBeNull();
  });

  // The reason is kept apart from the sheet being open, so the title
  // does not change while it fades out. A bookmark sets its own each time
  // rather than inheriting the heart's.
  it('names a place when a bookmark follows a heart', () => {
    world.session = null;
    function Both() {
      const { askToSignIn } = useSave();
      return (
        <>
          <button type="button" onClick={() => askToSignIn('like')}>tap the heart</button>
          <Tapper />
        </>
      );
    }
    mount(<Both />);
    fireEvent.click(screen.getByText('tap the heart'));
    tap();
    expect(screen.getByText('Save this place')).toBeTruthy();
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
  // collections to "New collection".
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
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledWith('coffee', 'cong-caphe', 0, undefined));
  });

  // A list of your own carries its id; passing it spares the lookup.
  it('passes the list’s own id along with it', async () => {
    world.mine = { ...world.mine, data: [{ ...list('coffee'), id: 'c-1' } as Collection, { ...list('weekend', ['cong-caphe']), id: 'w-1' } as Collection] };
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    fireEvent.click(screen.getByText('weekend'));
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledWith('coffee', 'cong-caphe', 0, 'c-1'));
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalledWith('weekend', 'cong-caphe', 'w-1'));
  });

  // After the last member, not at the count: with 0 and 2 left after a
  // removal, the count (2) is a position already taken.
  it('puts it after the last member of a list with a gap in it', async () => {
    const gappy = {
      ...list('gappy'),
      collection_places: [
        { sort_order: 0, places: { slug: 'a' } },
        { sort_order: 2, places: { slug: 'c' } },
      ],
    } as unknown as Collection;
    world.mine = { ...world.mine, data: [gappy] };
    mount();
    tap();
    fireEvent.click(await screen.findByText('gappy'));
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledWith('gappy', 'cong-caphe', 3, undefined));
  });

  it('takes it back out of a list that already holds it', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('weekend'));
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalledWith('weekend', 'cong-caphe', undefined));
    expect(addPlaceToCollection).not.toHaveBeenCalled();
  });

  it('refetches the lists so every copy agrees', async () => {
    mount();
    tap();
    fireEvent.click(await screen.findByText('coffee'));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});

// A tick moves when it is tapped (owner, 23 Oct 2026). It used to wait for
// the ids, the write and a reload of every list before the box filled —
// "a while later the status changes". The write is the database's
// business; the box is the reader's.
describe('a tick moves when it is tapped', () => {
  let alert: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    world.mine = { ...world.mine, data: [list('coffee'), list('weekend', ['cong-caphe'])] };
    alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { alert.mockRestore(); });

  /** A write that lands when the test says so. */
  const held = () => {
    let land!: () => void;
    let refuse!: (e: unknown) => void;
    const p = new Promise<void>((res, rej) => { land = res; refuse = rej; });
    return { p, land: () => act(async () => { land(); }), refuse: (e: unknown) => act(async () => { refuse(e); }) };
  };
  /** The row's tick as a screen reader hears it: 'true' or 'false'. */
  const box = (name: string) => {
    const row = screen.getAllByRole('checkbox').find((el) => el.textContent?.startsWith(name));
    return String(screen.queryAllByRole('checkbox', { checked: true }).includes(row!));
  };
  const open = async () => { tap(); await screen.findByText('coffee'); };
  const click = (name: string) => fireEvent.click(screen.getByText(name));
  const app = () => <SaveProvider><Tapper /><SaveSheets /></SaveProvider>;

  it('ticks the box, its count and the bookmark before the write lands', async () => {
    world.mine = { ...world.mine, data: [list('coffee')] };
    const w = held();
    addPlaceToCollection.mockImplementationOnce(() => w.p);
    mount();
    await open();
    click('coffee');
    expect(box('coffee')).toBe('true');
    expect(screen.getByText('1 place')).toBeTruthy();
    expect(screen.getByTestId('saved').textContent).toBe('true');
    expect(reload).not.toHaveBeenCalled();
    await w.land();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  // In, then straight back out: two writes, in the order they were asked,
  // and the box says out the whole time after the second tap.
  it('takes it back out on a second tap, after the first write', async () => {
    const w = held();
    addPlaceToCollection.mockImplementationOnce(() => w.p);
    mount();
    await open();
    click('coffee');
    click('coffee');
    expect(box('coffee')).toBe('false');
    expect(removePlaceFromCollection).not.toHaveBeenCalled();
    await w.land();
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalledWith('coffee', 'cong-caphe', undefined));
    expect(addPlaceToCollection.mock.invocationCallOrder[0]).toBeLessThan(removePlaceFromCollection.mock.invocationCallOrder[0]);
    expect(box('coffee')).toBe('false');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // In, out, in again while the first write is still out: one chain per
  // row, so the third tap is not a second insert racing the first — and
  // the out it cancelled is never sent.
  it('sends one write for in-out-in while the first is still out', async () => {
    const w = held();
    addPlaceToCollection.mockImplementationOnce(() => w.p);
    mount();
    await open();
    click('coffee');
    click('coffee');
    click('coffee');
    expect(box('coffee')).toBe('true');
    expect(addPlaceToCollection).toHaveBeenCalledTimes(1);
    await w.land();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(addPlaceToCollection).toHaveBeenCalledTimes(1);
    expect(removePlaceFromCollection).not.toHaveBeenCalled();
  });

  it('asks for the lists once after two lists were ticked, not once each', async () => {
    const w = held();
    addPlaceToCollection.mockImplementationOnce(() => w.p);
    mount();
    await open();
    click('coffee');
    click('weekend');
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalled());
    expect(reload).not.toHaveBeenCalled();
    await w.land();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect([box('coffee'), box('weekend')]).toEqual(['true', 'false']);
  });

  // Tapped again before the reload brought the first write back: the
  // second tap is a removal, because the first one is known to have landed.
  it('remembers what it wrote when tapped again before the lists come back', async () => {
    mount();
    await open();
    click('coffee');
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    click('coffee');
    await waitFor(() => expect(removePlaceFromCollection).toHaveBeenCalledWith('coffee', 'cong-caphe', undefined));
    expect(box('coffee')).toBe('false');
  });

  it('puts the box back when the write is refused', async () => {
    addPlaceToCollection.mockImplementationOnce(async () => { throw new Error('Network request failed'); });
    mount();
    await open();
    click('coffee');
    await waitFor(() => expect(alert).toHaveBeenCalledOnce());
    expect(box('coffee')).toBe('false');
    expect(screen.getByTestId('saved').textContent).toBe('true');
  });

  // In landed, out was refused: the box says what the database holds,
  // which is in — not where the chain started.
  it('leaves the box where the last write left it when a later one is refused', async () => {
    const w = held();
    addPlaceToCollection.mockImplementationOnce(() => w.p);
    removePlaceFromCollection.mockImplementationOnce(async () => { throw new Error('offline'); });
    mount();
    await open();
    click('coffee');
    click('coffee');
    await w.land();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save', 'offline'));
    expect(box('coffee')).toBe('true');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // The overlay stays until a load newer than the writes lands, and then
  // the database's word is the one shown — here it disagrees, which is
  // how the test can see the overlay go.
  it('gives way to the lists once a load newer than the writes lands', async () => {
    const r = render(app());
    await open();
    click('coffee');
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    world.mine = { ...world.mine, loadedAt: 1 };
    r.rerender(app());
    expect(box('coffee')).toBe('true');
    world.mine = { ...world.mine, loadedAt: Date.now() + 60_000 };
    r.rerender(app());
    expect(box('coffee')).toBe('false');
    // And the next tap starts from that word, not from the write before it.
    click('coffee');
    expect(box('coffee')).toBe('true');
    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledTimes(2));
    expect(removePlaceFromCollection).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.queryByText('Save this place')).toBeNull());
    expect(goTo).not.toHaveBeenCalled();
  });

  it('takes a guest to Sign in, over the Profile stack rather than instead of it', async () => {
    world.session = null;
    mount();
    tap();
    fireEvent.click(screen.getByText('Sign in / Sign up'));
    expect(goTo).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
    fadeOut();
    await waitFor(() => expect(screen.queryByText('Save this place')).toBeNull());
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

// What the sheet remembers for the reader's return — see `lib/resume`.
describe('finishing what a guest started', () => {
  function Asker({ run }: { run: () => void }) {
    const { askToSignIn } = useSave();
    return <button type="button" onClick={() => askToSignIn('like', run)}>tap the heart</button>;
  }

  it('remembers the bookmark and the tab it was tapped on', () => {
    world.session = null;
    mount();
    tap();
    const r = takeResume(Date.now());
    expect(r?.tab).toBe('Explore');
    expect(typeof r?.run).toBe('function');
  });

  // The act runs on a later render than the one the guest tapped, and it
  // must be that later render's `save` — the guest's own would only raise
  // the sheet again. With no lists yet, a signed-in save goes to the form.
  it('finishes the save as the reader who has just signed in', () => {
    world.session = null;
    const { rerender } = mount();
    tap();
    const r = takeResume(Date.now())!;
    world.session = { user: { id: 'u1' } };
    rerender(<SaveProvider><Tapper /><SaveSheets /></SaveProvider>);
    r.run!();
    expect(goTo).toHaveBeenCalledWith('Collections', {
      screen: 'CollectionForm', initial: false, params: { addPlaceSlug: 'cong-caphe' },
    });
  });

  it('carries the act a screen hands over, as it was handed', () => {
    const run = vi.fn();
    world.session = null;
    mount(<Asker run={run} />);
    fireEvent.click(screen.getByText('tap the heart'));
    expect(takeResume(Date.now())?.run).toBe(run);
  });

  it('keeps it through "Sign in" and forgets it on "Close"', () => {
    world.session = null;
    mount();
    tap();
    fireEvent.click(screen.getByText('Sign in / Sign up'));
    expect(takeResume(Date.now())).not.toBeNull();
    tap();
    fireEvent.click(screen.getAllByLabelText('Close')[0]);
    expect(takeResume(Date.now())).toBeNull();
  });

  it('has no tab to go back to before the navigator is ready', () => {
    navRef.ready = false;
    world.session = null;
    mount();
    tap();
    expect(takeResume(Date.now())?.tab).toBeNull();
  });
});
