// @vitest-environment jsdom
//
// One collection, opened. What is pinned here is who is allowed to do what
// to it, and that every control does what its label says:
//
// - the owner's list has a padlock or "Public" in the byline, an overflow
//   menu with Add / Edit / Reorder / Share / Make public|private / Delete,
//   and an "Add place" slot at the end of a non-empty list;
// - somebody else's list credits its curator, offers a heart that likes or
//   unlikes it, and a menu of Save a copy / Share / Report — never Edit or
//   Delete;
// - signed out, the heart and "Save a copy" open the sign-in sheet rather
//   than failing;
// - publishing refuses (as a sentence, not a Postgres code) while places
//   are still under review, and otherwise flips the flag, reloads both
//   catalogs and offers Undo;
// - reordering happens on the list itself: the owner holds a card and
//   drags it to where it lands (or uses VoiceOver's Move up / Move down),
//   a tip under the title says so, and the order saves itself a beat
//   after the last move, the whole sequence in one write;
// - deleting is behind a confirmation and tells the taste profile.
//
// Mocks sit at the screen's own seams: the `lib/*` hooks it reads and the
// `lib/data` writes it calls. `membersOf` and `publishBlockers` stay real,
// because which places count as "blocking" is exactly the rule the banner
// has to agree with. `PlaceCard` is a stand-in that names its place — it
// has its own rendering concerns and what this screen owes it is the tap.

import React from 'react';
import { Alert, PanResponder, type PanResponderCallbacks } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Collection, Place } from '../lib/types';

const spies = vi.hoisted(() => ({
  deleteCollection: vi.fn(async (_slug: string) => {}),
  reorderCollection: vi.fn(async (_slug: string, _slugs: string[]) => {}),
  setCollectionPublic: vi.fn(async (_slug: string, _next: boolean) => {}),
  toggleLike: vi.fn(async (_c: { id: string; slug: string }) => {}),
  askToSignIn: vi.fn(),
  mineReload: vi.fn(),
  colsReload: vi.fn(),
  note: vi.fn(),
  report: vi.fn(),
  canReport: vi.fn((_t: { kind: string; id: string; ownerId?: string | null }) => true),
  profileLookup: vi.fn((_h: string | null) => ({ data: null as null | { avatar_url: string }, loading: false })),
}));

const state = vi.hoisted(() => ({
  uid: 'me' as string | null,
  mine: [] as unknown[],
  cols: [] as unknown[],
  places: [] as unknown[],
  colsLoading: false,
  mineLoading: false,
  placesLoading: false,
  likes: {} as Record<string, number>,
  myLikes: [] as string[],
  cachedAvatar: null as string | null,
  city: { id: 'hanoi' } as { id: string } | null,
  lang: 'en' as 'en' | 'vi' | 'ja',
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/i18n', () => ({
  // The real fallback order, so a test can switch language and the screen
  // chooses its text the way it does in the app.
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null, ja: string | null) => {
      if (state.lang === 'vi') return vi ?? en ?? '';
      if (state.lang === 'ja') return ja ?? en ?? vi ?? '';
      return en ?? vi ?? '';
    },
  }),
}));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: state.cols, loading: state.colsLoading, reload: spies.colsReload }),
  usePlaces: () => ({ data: state.places, loading: state.placesLoading }),
  useLikes: () => ({ likes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
  useCuratorAvatar: () => state.cachedAvatar,
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({
    mine: { data: state.mine, loading: state.mineLoading, reload: spies.mineReload },
    askToSignIn: spies.askToSignIn,
    isSaved: () => false,
    save: vi.fn(),
  }),
}));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city }) }));
vi.mock('../lib/tasteProfile', () => ({ useNoteEvent: () => spies.note }));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  deleteCollection: spies.deleteCollection,
  reorderCollection: spies.reorderCollection,
  setCollectionPublic: spies.setCollectionPublic,
  useProfileByHandle: spies.profileLookup,
}));
vi.mock('../components/reportFlow', () => ({
  useReport: () => ({ report: spies.report, canReport: spies.canReport, node: null }),
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));
// A props-recorder for the card: its looks are its own suite's business.
// Filed by slug on every render, so a test can play the accessibility
// actions VoiceOver would on the card as last drawn.
type CardProps = {
  place: { slug: string; name_en: string };
  onPress: () => void;
  onLongPress?: (e: { nativeEvent: { pageY: number } }) => void;
  delayLongPress?: number;
  onPressOut?: () => void;
  accessibilityHint?: string;
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (e: { nativeEvent: { actionName: string } }) => void;
};
const cardProps = vi.hoisted(() => new Map<string, CardProps>());
vi.mock('../components/PlaceCard', async () => {
  const { Pressable, Text } = await import('react-native');
  return {
    default: (p: CardProps) => {
      cardProps.set(p.place.slug, p);
      return (
        <Pressable accessibilityRole="button" onPress={p.onPress}>
          <Text>{`card:${p.place.name_en}`}</Text>
        </Pressable>
      );
    },
  };
});

import CollectionDetailScreen from './CollectionDetailScreen';

// The list's drag responder, as the screen made it: the real one, with
// its callbacks kept so a test can play the touch system's side. The
// hold is the card's own long press (the stand-in above records it); the
// responder then claims the touch on the finger's first move, is granted
// it, and hears every move and the release.
const responder = vi.hoisted(() => ({ config: null as null | PanResponderCallbacks }));
const realCreate = PanResponder.create.bind(PanResponder);
vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
  responder.config = config;
  return realCreate(config);
});

// The screen's `Alert` is react-native-web's; spy on that object.
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

const live = { is_published: true, review_status: 'approved' };
const place = (slug: string, name: string, over: Partial<Place> = {}): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, neighborhood_en: `${name} area`,
  ...live, ...over,
} as unknown as Place);

const PHO = place('pho', 'Pho 10');
const CAFE = place('cafe', 'Cafe Giang');
const MUSEUM = place('museum', 'Fine Arts Museum', { neighborhood_en: null } as Partial<Place>);

const collection = (over: Partial<Collection> = {}, members: Place[] = [PHO, CAFE, MUSEUM]): Collection => ({
  id: 'c1', slug: 'old-quarter', title_en: 'Old Quarter eats', title_vi: 'vi', title_ja: null,
  desc_en: 'Where we eat.', desc_vi: null, desc_ja: null,
  curator_handle: null, cover: null, owner_id: 'me', is_public: false, city_id: 'hanoi',
  collection_places: members.map((m, i) => ({ sort_order: i, places: { slug: m.slug } })),
  ...over,
} as Collection);

/** Somebody else's public list, arriving through the public query. */
const theirs = (over: Partial<Collection> = {}, members?: Place[]) => collection({
  owner_id: 'curator', is_public: true, curator_handle: '@hanoicrew', ...over,
}, members);

const nav = () => {
  const parent = { navigate: vi.fn() };
  const n = {
    navigate: vi.fn(), goBack: vi.fn(), getParent: vi.fn(() => parent),
  };
  return { n: n as unknown as Nav, parent, raw: n };
};

const show = (slug = 'old-quarter') => {
  const navigation = nav();
  render(
    <CollectionDetailScreen
      navigation={navigation.n}
      route={{ params: { slug } } as RootRoute<'CollectionDetail'>}
    />,
  );
  return navigation;
};

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const openMenu = () => fireEvent.click(button('More'));
/**
 * A row in the overflow menu, by its label. The modal portals to the end of
 * the document, so when a label also appears on the page (the owner's
 * "Add place" footer) the menu's copy is the last one.
 */
const menuRow = (label: string) => screen.getAllByText(label).at(-1)!;

/**
 * Finish the menu's fade. jsdom runs no CSS animations, so react-native-web's
 * modal never hears its `animationend` and a closed menu would stay mounted.
 * The listener sits on some wrapper above the dialog; it ignores events not
 * aimed at itself, so each ancestor is told in turn.
 */
const endModalFade = () => {
  for (let el = document.querySelector('[aria-modal]')?.parentElement; el; el = el.parentElement) {
    fireEvent.animationEnd(el);
  }
};

/** Press a button in the last alert shown, by its label. */
const pressInAlert = (label: string) => {
  const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === label)!.onPress?.();
};

beforeEach(() => {
  vi.clearAllMocks();
  alert.mockImplementation(() => {});
  spies.deleteCollection.mockImplementation(async () => {});
  spies.reorderCollection.mockImplementation(async () => {});
  spies.setCollectionPublic.mockImplementation(async () => {});
  spies.canReport.mockImplementation(() => true);
  spies.profileLookup.mockImplementation(() => ({ data: null, loading: false }));
  state.uid = 'me';
  state.mine = [collection()];
  state.cols = [];
  state.places = [PHO, CAFE, MUSEUM];
  state.colsLoading = false;
  state.mineLoading = false;
  state.placesLoading = false;
  state.likes = {};
  state.myLikes = [];
  state.cachedAvatar = null;
  state.city = { id: 'hanoi' };
  state.lang = 'en';
});

describe('before the list is there', () => {
  it('shows a spinner, not "not found", while any catalog is still loading', () => {
    state.mine = [];
    state.mineLoading = true;
    show();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Collection not found.')).toBeNull();
  });

  it('says the collection is not found once everything has loaded without it', () => {
    state.mine = [];
    const { raw } = show();
    expect(screen.getByText('Collection not found.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    // No empty-list invitation for a list that is not there.
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
    expect(screen.queryByText('No places in this collection yet.')).toBeNull();
    fireEvent.click(button('Back'));
    expect(raw.goBack).toHaveBeenCalled();
  });

  it('offers no menu for a list that is not found', () => {
    state.mine = [];
    show();
    expect(screen.getByText('Collection not found.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('holds the menu back while your own lists load, so the owner never gets the visitor menu', () => {
    // Your list is only in `mine` here — a private one is in nothing else —
    // so until it answers there is no row saying the list is yours.
    state.mine = [];
    state.mineLoading = true;
    show();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(screen.queryByText('Save a copy')).toBeNull();
  });

  it('finds a public list in the public catalog when it is not among your own', () => {
    state.mine = [];
    state.cols = [theirs()];
    show();
    expect(screen.getByText('Old Quarter eats')).toBeTruthy();
  });
});

describe('your own list', () => {
  it('prints the title, description, places in sort order and a private byline', () => {
    state.mine = [collection({
      collection_places: [
        { sort_order: 2, places: { slug: 'pho' } },
        { sort_order: 0, places: { slug: 'museum' } },
        { sort_order: 1, places: { slug: 'cafe' } },
      ],
    })];
    show();
    expect(screen.getByText('Old Quarter eats')).toBeTruthy();
    expect(screen.getByText('Where we eat.')).toBeTruthy();
    const cards = screen.getAllByText(/^card:/).map((e) => e.textContent);
    expect(cards).toEqual(['card:Fine Arts Museum', 'card:Cafe Giang', 'card:Pho 10']);
    expect(screen.getByText(/3 places\s+·\s+Private/)).toBeTruthy();
    expect(screen.queryByText('Public')).toBeNull();
    // No self-credit and no heart on your own list.
    expect(screen.queryByRole('button', { name: /like/i })).toBeNull();
  });

  it('shows a description written only in Japanese to a Japanese reader', () => {
    state.lang = 'ja';
    state.mine = [collection({ desc_en: null, desc_vi: null, desc_ja: '旧市街で食べる。' })];
    show();
    expect(screen.getByText('旧市街で食べる。')).toBeTruthy();
  });

  it('says "place" for one, and "Public" once published', () => {
    state.mine = [collection({ is_public: true }, [PHO])];
    show();
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText(/1 place$/)).toBeTruthy();
    expect(screen.queryByText(/Private/)).toBeNull();
  });

  it('shows the like tally to the owner of a public list, but not as a button', () => {
    state.mine = [collection({ is_public: true })];
    state.likes = { 'old-quarter': 7 };
    show();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /like/i })).toBeNull();
  });

  it('opens a place from its card', () => {
    const { raw } = show();
    fireEvent.click(screen.getByText('card:Cafe Giang'));
    expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cafe' });
  });

  it('ends a non-empty list with an Add place slot that goes to Explore', () => {
    const { parent } = show();
    expect(screen.getByText('From search or your bookmarks')).toBeTruthy();
    fireEvent.click(screen.getByText('From search or your bookmarks'));
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
  });

  it('greets an empty list with one invitation to Explore, and no footer slot', () => {
    state.mine = [collection({}, [])];
    const { parent } = show();
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.queryByText('No places in this collection yet.')).toBeNull();
    expect(screen.queryByText('From search or your bookmarks')).toBeNull();
    expect(screen.getByText(/0 places/)).toBeTruthy();
    fireEvent.click(screen.getByText('Explore places'));
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
  });

  it('offers the owner the full menu and nothing meant for visitors', () => {
    show();
    openMenu();
    for (const label of ['Add place', 'Edit collection', 'Share', 'Make public', 'Delete collection']) {
      expect(menuRow(label)).toBeTruthy();
    }
    // The order is changed on the list itself now, by holding a card.
    expect(screen.queryByText('Reorder places')).toBeNull();
    expect(screen.queryByText('Save a copy')).toBeNull();
    expect(screen.queryByText('Report this list')).toBeNull();
  });

  it('labels the publish row by the action it takes on a public list', () => {
    state.mine = [collection({ is_public: true })];
    show();
    openMenu();
    expect(menuRow('Make private')).toBeTruthy();
    expect(screen.queryByText('Make public')).toBeNull();
  });

  it('Add place in the menu closes the menu and goes to Explore', async () => {
    const { parent } = show();
    openMenu();
    fireEvent.click(menuRow('Add place'));
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
    // The menu closed behind the action. jsdom runs no CSS animations, so
    // the fade-out's end is signalled by hand; a menu still `visible` would
    // ignore it and stay mounted.
    endModalFade();
    await waitFor(() => expect(screen.queryByText('Edit collection')).toBeNull());
  });

  it('Edit hands the form the slug, title and description', () => {
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Edit collection'));
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      slug: 'old-quarter', title: 'Old Quarter eats', desc: 'Where we eat.',
    });
  });

  it('Share explains that this private list can be made public, and links are coming', () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Share'));
    expect(alert).toHaveBeenCalledWith(
      'Sharing is coming',
      'This list is private. You can make it public from this menu — share links are on the way.',
    );
  });

  it('closes the menu from a backdrop VoiceOver can name', async () => {
    show();
    openMenu();
    fireEvent.click(button('Close menu'));
    endModalFade();
    await waitFor(() => expect(screen.queryByText('Edit collection')).toBeNull());
  });
});

describe('publishing', () => {
  it('makes a list public, reloads both catalogs and offers Undo', async () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', true);
    expect(await screen.findByText('This collection is now public')).toBeTruthy();
    expect(spies.mineReload).toHaveBeenCalled();
    expect(spies.colsReload).toHaveBeenCalled();

    // Undo is the same switch, the other way.
    fireEvent.click(screen.getByText('Undo'));
    expect(spies.setCollectionPublic).toHaveBeenLastCalledWith('old-quarter', false);
    expect(await screen.findByText('This collection is private again')).toBeTruthy();
  });

  it('makes a public list private again', async () => {
    state.mine = [collection({ is_public: true })];
    show();
    openMenu();
    fireEvent.click(menuRow('Make private'));
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', false);
    expect(await screen.findByText('This collection is private again')).toBeTruthy();
  });

  it('dismisses the banner when it is tapped', async () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    const banner = await screen.findByText('This collection is now public');
    fireEvent.click(banner);
    expect(screen.queryByText('This collection is now public')).toBeNull();
  });

  it('makes Undo a button of its own, not nested inside another', async () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    await screen.findByText('This collection is now public');
    const undo = button('Undo');
    // A button inside a button is one element to VoiceOver.
    expect(undo.parentElement!.closest('[role="button"]')).toBeNull();
    fireEvent.click(undo);
    expect(spies.setCollectionPublic).toHaveBeenLastCalledWith('old-quarter', false);
  });

  it('refuses while places are pending or rejected, and says which in words', () => {
    state.places = [
      PHO,
      place('cafe', 'Cafe Giang', { is_published: false, review_status: 'pending' } as Partial<Place>),
      place('museum', 'Fine Arts Museum', { is_published: false, review_status: 'flagged' } as Partial<Place>),
    ];
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    expect(spies.setCollectionPublic).not.toHaveBeenCalled();
    expect(screen.getByText(
      'Private until every place is live — 1 place is not public yet, and 1 was not accepted.',
    )).toBeTruthy();
    // Nothing to undo: nothing happened.
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('pluralises the blocker sentence', () => {
    const pending = { is_published: false, review_status: 'pending' } as Partial<Place>;
    state.places = [place('pho', 'Pho 10', pending), place('cafe', 'Cafe Giang', pending), MUSEUM];
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    expect(screen.getByText('Private until every place is live — 2 places are not public yet.')).toBeTruthy();
  });

  it('still lets a blocked list be made private', async () => {
    state.mine = [collection({ is_public: true })];
    state.places = [place('pho', 'Pho 10', { review_status: 'flagged' } as Partial<Place>), CAFE, MUSEUM];
    show();
    openMenu();
    fireEvent.click(menuRow('Make private'));
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', false);
    expect(await screen.findByText('This collection is private again')).toBeTruthy();
  });

  it('says so when the write fails, and shows no banner', async () => {
    spies.setCollectionPublic.mockRejectedValueOnce(new Error('offline'));
    show();
    openMenu();
    fireEvent.click(menuRow('Make public'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not publish', 'offline'));
    expect(spies.mineReload).not.toHaveBeenCalled();
    expect(screen.queryByText('This collection is now public')).toBeNull();
  });

  it('names the other direction when making private fails', async () => {
    state.mine = [collection({ is_public: true })];
    spies.setCollectionPublic.mockRejectedValueOnce(new Error('nope'));
    show();
    openMenu();
    fireEvent.click(menuRow('Make private'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not make private', 'nope'));
  });
});

describe('reordering', () => {
  const card = (slug: string) => cardProps.get(slug)!;
  const act11y = (slug: string, actionName: string) =>
    act(() => { card(slug).onAccessibilityAction!({ nativeEvent: { actionName } }); });
  /** One step, the way VoiceOver takes it. */
  const down = (slug: string) => act11y(slug, 'moveDown');
  const up = (slug: string) => act11y(slug, 'moveUp');
  // Where the finger is when the card lifts. Any page position: the drag
  // is measured from here.
  const Y0 = 480;
  const cfg = () => responder.config!;
  const evt = {} as never;
  const at = (dy: number) => ({ moveY: Y0 + dy }) as never;
  /** The hold completes: the card's long press. */
  const lift = (slug: string) => act(() => { card(slug).onLongPress!({ nativeEvent: { pageY: Y0 } }); });
  /** The finger's first move: the list asks for the touch and, if it wants
   *  it, is granted it, and the card's button is told it has lost it. */
  const claim = (slug: string) => {
    let wanted = false;
    act(() => {
      wanted = !!cfg().onMoveShouldSetPanResponderCapture!(evt, at(0));
      if (wanted) {
        cfg().onPanResponderGrant!(evt, at(0));
        card(slug).onPressOut!();
      }
    });
    return wanted;
  };
  const move = (dy: number) => act(() => { cfg().onPanResponderMove!(evt, at(dy)); });
  const drop = () => act(() => { cfg().onPanResponderRelease!(evt, at(0)); });
  /** A whole drag: hold, first move, the moves, let go. */
  const dragBy = (slug: string, ...dys: number[]) => {
    lift(slug);
    claim(slug);
    for (const dy of dys) move(dy);
    drop();
  };
  const el = (slug: string) => screen.getByTestId(`drag-${slug}`);
  /** The card as React Native Web measures it, by hand: jsdom has no
   *  ResizeObserver, and the handler is left on the node for one. */
  const measure = (slug: string, height: number) => act(() => {
    (el(slug) as unknown as { __reactLayoutHandler: (e: unknown) => void })
      .__reactLayoutHandler({ nativeEvent: { layout: { height } } });
  });
  const cards = () => screen.getAllByText(/^card:/).map((e) => e.textContent);
  /** Past the beat the screen waits after the last move. On a fake clock:
   *  a real 700 ms wait was the flake under coverage, where the whole run
   *  slows and the beat is no longer a beat. */
  const pastTheBeat = () => act(async () => { await vi.advanceTimersByTimeAsync(700); });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    cardProps.clear();
    responder.config = null;
  });
  afterEach(() => { vi.useRealTimers(); });

  it('lets the owner hold any card of the list as it is, with no mode to enter first', () => {
    show();
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    for (const slug of ['pho', 'cafe', 'museum']) expect(card(slug).onLongPress).toBeTypeOf('function');
    // The rest of the screen stays what it was: the menu, the Add slot.
    expect(button('More')).toBeTruthy();
    expect(screen.getByText('From search or your bookmarks')).toBeTruthy();
    for (const label of ['Done', 'Saving…', 'Saved']) expect(screen.queryByText(label)).toBeNull();
  });

  it('lifts a card only after a hold, so a tap still opens it', () => {
    const { raw } = show();
    expect(card('pho').delayLongPress).toBeGreaterThanOrEqual(300);
    fireEvent.click(screen.getByText('card:Cafe Giang'));
    expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cafe' });
  });

  it('offers no hold on a list of one', () => {
    state.mine = [collection({}, [PHO])];
    show();
    expect(card('pho').onLongPress).toBeUndefined();
    expect(card('pho').accessibilityActions).toBeUndefined();
    expect(screen.queryByTestId('drag-pho')).toBeNull();
  });

  it('offers no hold to a visitor', () => {
    state.mine = [];
    state.cols = [collection({ owner_id: 'curator', is_public: true })];
    show();
    expect(screen.getByText('card:Pho 10')).toBeTruthy();
    expect(card('pho').onLongPress).toBeUndefined();
  });

  // The list's responder must never meet an ordinary scroll or tap: it
  // wants the touch only once a card is up.
  it('claims the touch only while a card is lifted, and then never gives it back', () => {
    show();
    expect(claim('pho')).toBe(false);
    lift('pho');
    expect(claim('pho')).toBe(true);
    expect(cfg().onPanResponderTerminationRequest!(evt, at(0))).toBe(false);
    drop();
    expect(claim('pho')).toBe(false);
  });

  it('lands a dragged card where it is let go, and saves it a beat later', async () => {
    show();
    lift('pho');
    claim('pho');
    // Past half of the next card (a 320 guess before any card has measured).
    move(170);
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    drop();
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Pho 10', 'card:Fine Arts Museum']);
    expect(spies.reorderCollection).not.toHaveBeenCalled();
    expect(screen.getByText('Saving…')).toBeTruthy();
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['cafe', 'pho', 'museum']);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(spies.mineReload).toHaveBeenCalled();
    expect(spies.colsReload).toHaveBeenCalled();
    // The menu is still there beside the report.
    expect(button('More')).toBeTruthy();
  });

  it('crosses as many cards as the finger does, upward too', async () => {
    show();
    dragBy('museum', -200, -500);
    expect(cards()).toEqual(['card:Fine Arts Museum', 'card:Pho 10', 'card:Cafe Giang']);
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['museum', 'pho', 'cafe']);
  });

  // The second drag has to start from the order the first one left. The
  // responder is made once, so this is what shows it hears the latest
  // order rather than the one the screen opened with.
  it('drags again from the order the last drag left', async () => {
    show();
    dragBy('pho', 170);
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Pho 10', 'card:Fine Arts Museum']);
    dragBy('museum', -500);
    expect(cards()).toEqual(['card:Fine Arts Museum', 'card:Cafe Giang', 'card:Pho 10']);
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['museum', 'cafe', 'pho']);
  });

  // A terminated touch (a call, the app leaving the screen) lands the
  // card where it was over, the same as letting go.
  it('lands the card when the system takes the touch away', () => {
    show();
    lift('pho');
    claim('pho');
    move(170);
    act(() => { cfg().onPanResponderTerminate!(evt, at(170)); });
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Pho 10', 'card:Fine Arts Museum']);
  });

  // While the card is up: the cards it has passed step into the room it
  // left, the list stops scrolling under the drag, and the lifted card's
  // cell is raised over the ones it crosses. All of it undone on landing.
  it('steps the passed cards aside, holds the list still and raises the lifted card', () => {
    show();
    const scroller = () => {
      for (let e = el('pho').parentElement; e; e = e.parentElement) {
        if (getComputedStyle(e).overflowY) return e;
      }
      throw new Error('no scroll view');
    };
    expect(getComputedStyle(scroller()).overflowY).not.toBe('hidden');
    const before = el('pho');
    lift('pho');
    // Held still from the moment it lifts, before the finger has moved.
    expect(getComputedStyle(scroller()).overflowY).toBe('hidden');
    claim('pho');
    move(500);
    // The same card, not a new one: a remount mid-drag is a dropped touch.
    expect(el('pho')).toBe(before);
    expect(el('pho').style.transform).toContain('translateY(500px)');
    expect(el('pho').style.transform).toContain('scale(1.02)');
    expect(el('cafe').style.transform).toBe('translateY(-320px)');
    expect(el('museum').style.transform).toBe('translateY(-320px)');
    expect(getComputedStyle(el('pho').parentElement!).zIndex).toBe('10');
    expect(getComputedStyle(el('cafe').parentElement!).zIndex).not.toBe('10');
    move(170);
    expect(el('cafe').style.transform).toBe('translateY(-320px)');
    expect(el('museum').style.transform).toBe('');
    drop();
    for (const slug of ['pho', 'cafe', 'museum']) {
      expect(el(slug).style.transform).toBe('');
      expect(getComputedStyle(el(slug).parentElement!).zIndex).not.toBe('10');
    }
    expect(getComputedStyle(scroller()).overflowY).not.toBe('hidden');
  });

  // Measured from where the finger was when the card lifted, not from
  // where the touch began or from the top of the page.
  it('follows the finger from where the card lifted', () => {
    show();
    lift('pho');
    claim('pho');
    move(0);
    expect(el('pho').style.transform).toContain('translateY(0px)');
    move(-40);
    expect(el('pho').style.transform).toContain('translateY(-40px)');
  });

  // A card with no photo, or a longer name, is a different height.
  it('measures each card, so crossing a short one takes a shorter drag', () => {
    show();
    measure('cafe', 200);
    lift('pho');
    claim('pho');
    // Passed at half of the measured 200, which the 320 guess would not be.
    move(99);
    expect(el('cafe').style.transform).toBe('');
    move(100);
    expect(el('cafe').style.transform).toBe('translateY(-320px)');
    drop();
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Pho 10', 'card:Fine Arts Museum']);
  });

  it('writes nothing for a card put back where it was', async () => {
    show();
    dragBy('cafe', 400, 10);
    await pastTheBeat();
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    expect(spies.reorderCollection).not.toHaveBeenCalled();
    expect(screen.queryByText('Saving…')).toBeNull();
  });

  // Held, then let go without moving: the finger came up on the card's
  // own button, which is the only thing that hears it. The card goes back.
  it('puts a card back when it is held and let go without a move', async () => {
    show();
    const before = el('pho');
    lift('pho');
    expect(before.style.transform).toContain('scale(1.02)');
    act(() => { card('pho').onPressOut!(); });
    expect(el('pho').style.transform).toBe('');
    // And the list does not think a card is still up.
    expect(claim('pho')).toBe(false);
    await pastTheBeat();
    expect(spies.reorderCollection).not.toHaveBeenCalled();
  });

  // An ordinary tap lets go of the button too, with nothing lifted.
  it('ignores a press that ends without a hold', () => {
    show();
    act(() => { card('pho').onPressOut!(); });
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    expect(screen.queryByText('Saving…')).toBeNull();
  });

  // VoiceOver cannot drag. Each card offers the moves as actions, only
  // the ones that go somewhere, and its hint says the card can be held.
  it('offers Move up and Move down to VoiceOver, except off either end', () => {
    show();
    const names = (slug: string) => card(slug).accessibilityActions!.map((a) => a.name);
    expect(names('pho')).toEqual(['moveDown']);
    expect(names('cafe')).toEqual(['moveUp', 'moveDown']);
    expect(names('museum')).toEqual(['moveUp']);
    expect(card('cafe').accessibilityActions!.map((a) => a.label)).toEqual(['Move up', 'Move down']);
    expect(card('cafe').accessibilityHint).toBe('Hold and drag to change the order.');
  });

  it('saves a run of VoiceOver moves as one write', async () => {
    show();
    // [pho, cafe, museum] → pho down → [cafe, pho, museum] → museum up → [cafe, museum, pho]
    down('pho');
    up('museum');
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Fine Arts Museum', 'card:Pho 10']);
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['cafe', 'museum', 'pho']);
  });

  it('names the actions in the reader\'s language', () => {
    state.lang = 'vi';
    show();
    expect(card('cafe').accessibilityActions!.map((a) => a.label)).toEqual(['Chuyển lên', 'Chuyển xuống']);
    expect(card('cafe').accessibilityHint).toBe('Giữ rồi kéo để đổi thứ tự.');
  });

  // One write in flight, and the latest order after it: a move made while
  // the first write is out is not lost, and not written in parallel.
  it('writes a move made during a write once that write returns', async () => {
    let land!: () => void;
    spies.reorderCollection.mockImplementationOnce(() => new Promise<void>((r) => { land = r; }));
    show();
    down('pho');
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    down('pho');
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    await act(async () => { land(); await vi.advanceTimersByTimeAsync(0); });
    expect(spies.reorderCollection).toHaveBeenCalledTimes(2);
    expect(spies.reorderCollection).toHaveBeenLastCalledWith('old-quarter', ['cafe', 'museum', 'pho']);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('goes back to the saved order and says so when the order cannot be saved', async () => {
    spies.reorderCollection.mockRejectedValueOnce(new Error('timeout'));
    show();
    down('pho');
    await pastTheBeat();
    expect(alert).toHaveBeenCalledWith('Could not save the order', 'timeout');
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    expect(screen.queryByText('Saving…')).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('writes a waiting move when the screen goes', () => {
    const view = render(
      <CollectionDetailScreen
        navigation={nav().n}
        route={{ params: { slug: 'old-quarter' } } as RootRoute<'CollectionDetail'>}
      />,
    );
    down('pho');
    view.unmount();
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['cafe', 'pho', 'museum']);
  });

  it('back leaves the screen straight away, with no mode to leave first', () => {
    const { raw } = show();
    down('pho');
    fireEvent.click(button('Back'));
    expect(raw.goBack).toHaveBeenCalledTimes(1);
  });

  // The draft is only a bridge to the server's answer. Once the server
  // agrees it steps aside, so an order changed later elsewhere shows here.
  it('follows the server again once the server has caught up', async () => {
    const route = { params: { slug: 'old-quarter' } } as RootRoute<'CollectionDetail'>;
    const navigation = nav().n;
    const view = render(<CollectionDetailScreen navigation={navigation} route={route} />);
    down('pho');
    await pastTheBeat();
    state.mine = [collection({}, [CAFE, PHO, MUSEUM])];
    view.rerender(<CollectionDetailScreen navigation={navigation} route={route} />);
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Pho 10', 'card:Fine Arts Museum']);
    state.mine = [collection({}, [MUSEUM, CAFE, PHO])];
    view.rerender(<CollectionDetailScreen navigation={navigation} route={route} />);
    expect(cards()).toEqual(['card:Fine Arts Museum', 'card:Cafe Giang', 'card:Pho 10']);
  });
});

// The tip under the title: shown to the owner of a list that can be put
// in order, and to nobody else. Its dismissal and memory are its own
// suite's business (ReorderTip.ui.test.tsx); what is pinned here is who
// sees it.
describe('the reorder tip', () => {
  const TIP = /Hold a place, then drag it to change the order/;
  const settle = () => act(async () => {});
  beforeEach(async () => {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem('tip.holdToReorder.v1');
  });

  it('tells the owner of a list of two or more', async () => {
    show();
    await settle();
    expect(screen.getByText(TIP)).toBeTruthy();
  });

  // The screen's half of retiring it: a first move tells the tip it has
  // done its job, so it does not come back on the next visit.
  it('is retired by the owner\'s first move', async () => {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    show();
    await settle();
    expect(await AsyncStorage.getItem('tip.holdToReorder.v1')).toBeNull();
    act(() => {
      cardProps.get('pho')!.onAccessibilityAction!({ nativeEvent: { actionName: 'moveDown' } });
    });
    await settle();
    expect(await AsyncStorage.getItem('tip.holdToReorder.v1')).toBe('1');
    // Still on screen for this visit.
    expect(screen.getByText(TIP)).toBeTruthy();
  });

  it('says nothing on a list of one', async () => {
    state.mine = [collection({}, [PHO])];
    show();
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });

  it('says nothing to a visitor', async () => {
    state.mine = [];
    state.cols = [collection({ owner_id: 'curator', is_public: true })];
    show();
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });
});

describe('deleting', () => {
  it('asks first, naming the list, and Cancel does nothing', () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Delete collection'));
    expect(alert.mock.calls.at(-1)![0]).toBe('Delete this collection?');
    expect(alert.mock.calls.at(-1)![1]).toBe('"Old Quarter eats" will be gone for good.');
    pressInAlert('Cancel');
    expect(spies.deleteCollection).not.toHaveBeenCalled();
  });

  it('deletes, un-saves every member in the taste profile, and leaves', async () => {
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Delete collection'));
    pressInAlert('Delete');
    expect(spies.deleteCollection).toHaveBeenCalledWith('old-quarter');
    await waitFor(() => expect(raw.goBack).toHaveBeenCalled());
    expect(spies.note.mock.calls).toEqual([['pho', 'unsave'], ['cafe', 'unsave'], ['museum', 'unsave']]);
    expect(spies.mineReload).toHaveBeenCalled();
    // The public catalog too, or a deleted public list stays on the shelf.
    expect(spies.colsReload).toHaveBeenCalled();
  });

  it('records nothing and stays put when the delete fails', async () => {
    spies.deleteCollection.mockRejectedValueOnce(new Error('denied'));
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Delete collection'));
    pressInAlert('Delete');
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Could not delete', 'denied'));
    expect(spies.note).not.toHaveBeenCalled();
    expect(raw.goBack).not.toHaveBeenCalled();
  });
});

describe("somebody else's list", () => {
  beforeEach(() => {
    state.mine = [];
    state.cols = [theirs()];
  });

  it('credits the curator, hides owner-only marks and says "No places" when empty', () => {
    state.cols = [theirs({}, [])];
    show();
    expect(screen.getByText(/@hanoicrew\s+·\s+0 places/)).toBeTruthy();
    expect(screen.getByText('No places in this collection yet.')).toBeTruthy();
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
    expect(screen.queryByText('Public')).toBeNull();
    expect(screen.queryByText(/Private/)).toBeNull();
    expect(screen.queryByText('From search or your bookmarks')).toBeNull();
  });

  it('offers Save a copy, Share and Report — never Edit, Reorder, Publish or Delete', () => {
    show();
    openMenu();
    expect(menuRow('Save a copy')).toBeTruthy();
    expect(menuRow('Share')).toBeTruthy();
    expect(menuRow('Report this list')).toBeTruthy();
    for (const label of ['Edit collection', 'Reorder places', 'Make public', 'Make private', 'Delete collection', 'Add place']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('leaves Report out when the report flow says this cannot be reported', () => {
    spies.canReport.mockImplementation(() => false);
    show();
    openMenu();
    expect(spies.canReport).toHaveBeenCalledWith({ kind: 'collection', id: 'c1', ownerId: 'curator' });
    expect(screen.queryByText('Report this list')).toBeNull();
  });

  it('reports the list with its id, owner and title', () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Report this list'));
    expect(spies.report).toHaveBeenCalledWith({
      kind: 'collection', id: 'c1', ownerId: 'curator', name: 'Old Quarter eats',
    });
  });

  it('Share on a public list says there is no link yet', () => {
    show();
    openMenu();
    fireEvent.click(menuRow('Share'));
    expect(alert).toHaveBeenCalledWith(
      'Sharing is coming',
      'This list is public, but there is no link to send yet. Sharing one is on the way.',
    );
  });

  it('Save a copy opens the form with the source, a credit line and the order', () => {
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      copyFrom: {
        cityId: 'hanoi',
        title: 'Old Quarter eats',
        desc: 'Where we eat.\n\nCopied from @hanoicrew',
        placeSlugs: ['pho', 'cafe', 'museum'],
      },
    });
  });

  it('falls back to the city on screen, and omits an absent description', () => {
    state.cols = [theirs({ city_id: null, desc_en: null, curator_handle: null })];
    state.city = { id: 'saigon' };
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      copyFrom: expect.objectContaining({ cityId: 'saigon', desc: '' }),
    });
  });

  it('leaves Save a copy out when no city is known at all', () => {
    state.cols = [theirs({ city_id: null })];
    state.city = null;
    const { raw } = show();
    openMenu();
    // A row that could only close the menu is not offered.
    expect(screen.queryByText('Save a copy')).toBeNull();
    expect(menuRow('Share')).toBeTruthy();
    expect(raw.navigate).not.toHaveBeenCalled();
  });

  it('likes the list from the heart, with its id and slug', () => {
    state.likes = { 'old-quarter': 3 };
    show();
    const heart = button('Like');
    // react-native-web drops `accessibilityState`, so the state is read
    // off the label and the glyph — which is what a reader gets anyway.
    expect(heart.querySelector('[data-icon="heart-outline"]')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(heart);
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'c1', slug: 'old-quarter' });
    expect(spies.askToSignIn).not.toHaveBeenCalled();
  });

  it('draws a liked list as Unlike, and hides a zero tally', () => {
    state.myLikes = ['c1'];
    state.likes = { 'old-quarter': 0 };
    show();
    const heart = button('Unlike');
    expect(heart.querySelector('[data-icon="heart"]')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    fireEvent.click(heart);
    expect(spies.toggleLike).toHaveBeenCalledWith({ id: 'c1', slug: 'old-quarter' });
  });

  it('shows no heart on a list without an id', () => {
    state.cols = [theirs({ id: undefined } as Partial<Collection>)];
    show();
    expect(screen.queryByRole('button', { name: /like/i })).toBeNull();
  });
});

describe('the curator face', () => {
  beforeEach(() => {
    state.mine = [];
    state.cols = [theirs()];
  });

  it('uses the cached avatar and skips the lookup', () => {
    state.cachedAvatar = 'https://img/face.jpg';
    show();
    expect(document.querySelector('img[src="https://img/face.jpg"]')).toBeTruthy();
    expect(spies.profileLookup).toHaveBeenCalledWith(null);
  });

  it('looks the handle up normalised, without the stored "@"', () => {
    spies.profileLookup.mockImplementation(() => ({ data: { avatar_url: 'https://img/looked.jpg' }, loading: false }));
    show();
    expect(spies.profileLookup).toHaveBeenCalledWith('hanoicrew');
    expect(document.querySelector('img[src="https://img/looked.jpg"]')).toBeTruthy();
  });

  it('draws no face for a handle with no profile behind it', () => {
    show();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[data-icon="person-outline"]')).toBeNull();
  });

  it('holds a blank slot while the lookup is still out', () => {
    spies.profileLookup.mockImplementation(() => ({ data: null, loading: true }));
    show();
    expect(document.querySelector('[data-icon="person-outline"]')).toBeTruthy();
  });

  it('never looks anybody up for your own list', () => {
    state.cols = [];
    state.mine = [collection({ curator_handle: '@me' })];
    show();
    expect(spies.profileLookup).toHaveBeenCalledWith(null);
    expect(screen.queryByText(/@me/)).toBeNull();
  });
});

describe('signed out', () => {
  beforeEach(() => {
    state.uid = null;
    state.mine = [];
    state.cols = [theirs()];
  });

  it('the heart opens the sign-in sheet instead of liking', () => {
    show();
    fireEvent.click(button('Like'));
    expect(spies.askToSignIn).toHaveBeenCalledWith('like');
    expect(spies.toggleLike).not.toHaveBeenCalled();
  });

  it('Save a copy opens the sign-in sheet instead of the form', () => {
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    // Saving somebody's list is a save, so the bookmark sheet.
    expect(spies.askToSignIn).toHaveBeenCalledWith();
    expect(raw.navigate).not.toHaveBeenCalled();
  });

  it('a list with no owner is never treated as yours', () => {
    state.cols = [theirs({ owner_id: null })];
    show();
    openMenu();
    expect(screen.queryByText('Delete collection')).toBeNull();
    expect(menuRow('Save a copy')).toBeTruthy();
  });
});
