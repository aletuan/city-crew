// @vitest-environment jsdom
//
// One collection, opened. What is pinned here is who is allowed to do what
// to it, and that every control does what its label says:
//
// - the owner's list says Private or Public at the foot of its card, and
//   that word opens the sheet that changes it; an overflow menu with Add /
//   Plan a trip / Edit / Share / Delete, and Add and Plan in the dock once
//   the card has scrolled away;
// - somebody else's list credits its curator, offers a heart that likes or
//   unlikes it, and a menu of Save a copy / Share / Report — never Edit or
//   Delete;
// - signed out, the heart and "Save a copy" open the sign-in sheet rather
//   than failing;
// - publishing is refused (as a sentence, not a Postgres code) while places
//   are still under review — the Public row is dimmed and says why — and
//   otherwise flips the flag, reloads both catalogs and says so in a
//   banner that goes by itself after three seconds;
// - reordering happens on the list itself: the owner holds a card and
//   drags it to where it lands (or uses VoiceOver's Move up / Move down),
//   a tip under the title says so, and the order saves itself a beat
//   after the last move, the whole sequence in one write;
// - deleting is behind a confirmation and tells the taste profile;
// - either menu turns the cards into a grid of tiles and back, and the
//   choice is the reader's, kept for every list.
//
// Mocks sit at the screen's own seams: the `lib/*` hooks it reads and the
// `lib/data` writes it calls. `membersOf` and `publishBlockers` stay real,
// because which places count as "blocking" is exactly the rule the banner
// has to agree with. `PlaceCard` is a stand-in that names its place — it
// has its own rendering concerns and what this screen owes it is the tap.

import React from 'react';
import { AccessibilityInfo, Alert, LayoutAnimation, PanResponder, type PanResponderCallbacks } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Collection, Place } from '../lib/types';
import { CATEGORIES } from '../lib/categories';
import { colors } from '../theme';

const spies = vi.hoisted(() => ({
  goTo: vi.fn(),
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
  profileLookup: vi.fn((_h: string | null) => ({ data: null as null | { id?: string; full_name?: string; avatar_url: string }, loading: false })),
  blockUser: vi.fn(async (_id: string) => {}),
}));

const state = vi.hoisted(() => ({
  uid: 'me' as string | null,
  ducked: false,
  profile: { handle: 'andy', avatar_url: '' } as { handle: string; avatar_url: string },
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

vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null, profile: state.profile }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
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
vi.mock('../lib/save', () => {
  const useSave = () => ({
    mine: { data: state.mine, loading: state.mineLoading, reload: spies.mineReload },
    askToSignIn: spies.askToSignIn,
    isSaved: () => false,
    save: vi.fn(),
  });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
vi.mock('../lib/city', () => {
  const m = { useCity: () => ({ city: state.city }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../nav', () => ({ goTo: spies.goTo }));
vi.mock('../lib/tasteProfile', () => ({ useNoteEvent: () => spies.note }));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  deleteCollection: spies.deleteCollection,
  reorderCollection: spies.reorderCollection,
  setCollectionPublic: spies.setCollectionPublic,
  useProfileByHandle: spies.profileLookup,
  blockUser: spies.blockUser,
}));
vi.mock('../components/reportFlow', () => ({
  useReport: () => ({ report: spies.report, canReport: spies.canReport, node: null }),
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined, useTabBarDucked: () => state.ducked }));
// A props-recorder for the card: its looks are its own suite's business.
// Filed by slug on every render, so a test can play the accessibility
// actions VoiceOver would on the card as last drawn.
type CardProps = {
  place: { slug: string; name_en: string };
  onPress: () => void;
  chip?: string | null;
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
  slug, name_en: name, name_vi: name, name_ja: null, neighborhood_en: `${name} area`, place_photos: [],
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

const focusListeners: (() => void)[] = [];
const nav = () => {
  focusListeners.length = 0;
  const parent = { navigate: vi.fn() };
  const n = {
    navigate: vi.fn(), goBack: vi.fn(), getParent: vi.fn(() => parent),
    // The dock hands its slot back on focus; a test fires it through here.
    addListener: vi.fn((_e: string, cb: () => void) => { focusListeners.push(cb); return () => {}; }),
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
 * "Add place" footer, until 15 Oct 2026) the menu's copy is the last one.
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

/**
 * Choose who can see the list: the word at the card's foot opens the
 * sheet, and a row is pressed. The row runs its choice 220ms after the
 * sheet starts to close (see `SheetRows`), so the clock is wound past it.
 */
const chooseVisibility = (key: 'public' | 'private') => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    pickVisibility(key);
  } finally {
    vi.useRealTimers();
  }
};
/** The same, for a test already on the fake clock. */
const pickVisibility = (key: 'public' | 'private') => {
  fireEvent.click(screen.getByTestId('collection-visibility'));
  fireEvent.click(screen.getByTestId(`sheet-action-${key}`));
  act(() => { vi.advanceTimersByTime(220); });
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
  spies.blockUser.mockImplementation(async () => {});
  spies.profileLookup.mockImplementation(() => ({ data: null, loading: false }));
  state.uid = 'me';
  state.ducked = false;
  state.profile = { handle: 'andy', avatar_url: '' };
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
  it('prints the title, description, places in sort order, and Private at the card\u2019s foot', () => {
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
    // In the foot, before the count — not under the title any more.
    expect(screen.getByTestId('collection-stats').textContent).toBe('Private·3 places');
    expect(screen.getByTestId('collection-visibility').textContent).toBe('Private');
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
    expect(screen.getByTestId('collection-visibility').textContent).toBe('Public');
    expect(screen.getByText(/1 place$/)).toBeTruthy();
    expect(screen.queryByText(/Private/)).toBeNull();
  });

  // A curator may like their own list (owner, 17 Oct 2026): the same
  // heart, pressable, at any count.
  it('gives the owner of a public list the same heart, and it likes', () => {
    state.mine = [collection({ is_public: true })];
    state.likes = { 'old-quarter': 7 };
    show();
    expect(screen.getByText('7')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(spies.toggleLike).toHaveBeenCalledWith(expect.objectContaining({ slug: 'old-quarter' }));
  });

  it('draws the owner\u2019s heart before anybody has liked the list', () => {
    state.mine = [collection({ is_public: true })];
    state.likes = {};
    show();
    const heart = screen.getByRole('button', { name: 'Like' });
    expect(heart.querySelector('[data-icon="heart-outline"]')).toBeTruthy();
    // And no zero beside it.
    expect(heart.textContent).toBe('');
  });

  it('opens a place from its card', () => {
    const { raw } = show();
    fireEvent.click(screen.getByText('card:Cafe Giang'));
    expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cafe' });
  });

  // The old dashed slot at the end of the list stays gone; adding is the
  // card's quiet button and the menu's row (owner, 16 Oct 2026).
  it('ends a non-empty list with no Add place slot', () => {
    show();
    expect(screen.queryByText('From search or your bookmarks')).toBeNull();
  });

  it('greets an empty list with one invitation to Explore, and no footer', () => {
    state.mine = [collection({}, [])];
    const { parent } = show();
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.queryByText('No places in this collection yet.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan a trip' })).toBeNull();
    expect(screen.getByText(/0 places/)).toBeTruthy();
    fireEvent.click(screen.getByText('Explore places'));
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
  });

  it('offers the owner the full menu and nothing meant for visitors', () => {
    show();
    openMenu();
    for (const label of ['Add place', 'Edit collection', 'Share', 'Delete collection']) {
      expect(menuRow(label)).toBeTruthy();
    }
    // The order is changed on the list itself now, by holding a card.
    expect(screen.queryByText('Reorder places')).toBeNull();
    expect(screen.queryByText('Save a copy')).toBeNull();
    expect(screen.queryByText('Report this list')).toBeNull();
  });

  it('keeps who can see the list out of the menu, either way round', () => {
    for (const is_public of [false, true]) {
      state.mine = [collection({ is_public })];
      show();
      openMenu();
      expect(menuRow('Delete collection')).toBeTruthy();
      expect(screen.queryByText('Make public')).toBeNull();
      expect(screen.queryByText('Make private')).toBeNull();
      cleanup();
    }
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

  // The description sits in a card on the theme's own surface, with the
  // owner's pencil on it (owner, 15 Oct 2026).
  it('draws the description in a card, and the owner’s pencil opens the form', () => {
    const { raw } = show();
    const card = screen.getByTestId('collection-desc');
    expect(card.textContent).toContain('Where we eat.');
    expect(getComputedStyle(card).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    // Your face leads (owner, 16 Oct 2026); the pencil stays, the menu's own framed one.
    expect(screen.getByTestId('collection-curator').textContent).toBe('@andy');
    expect(card.querySelector('[data-icon="document-text-outline"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit description' }).querySelector('[data-icon="create-outline"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      slug: 'old-quarter', title: 'Old Quarter eats', desc: 'Where we eat.',
    });
  });

  // The line and the pencil are the press, not the whole card: the
  // chips under the line are the list's filter (see "the chips").
  it('invites the owner to write one when there is none, the line and the pencil the press', () => {
    state.mine = [collection({ desc_en: null })];
    const { raw } = show();
    expect(screen.queryByTestId('collection-desc')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a description' }));
    const card = screen.getByTestId('collection-desc-empty');
    expect(card.textContent).toMatch(/^@andyAdd a description/);
    // An action, not a sentence that could pass for the description: a
    // plus and the words, in the accent (18 Oct 2026).
    const add = screen.getByTestId('collection-desc-add');
    expect(add.querySelector('[data-icon="add"]')?.getAttribute('data-color')).toBe(String(colors.accent));
    expect(screen.queryByText(/Add a few words/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit description' }).querySelector('[data-icon="create-outline"]')).toBeTruthy();
    expect(card.getAttribute('role')).not.toBe('button');
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      slug: 'old-quarter', title: 'Old Quarter eats', desc: '',
    });
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
      'This list is private. Tap Private at the foot of its card to make it public — share links are on the way.',
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
  it('asks who can see the list, says what each answer means, and ticks the one given', () => {
    show();
    fireEvent.click(screen.getByTestId('collection-visibility'));
    expect(screen.getByText('Who can see this list?')).toBeTruthy();
    const pub = screen.getByTestId('sheet-action-public');
    const priv = screen.getByTestId('sheet-action-private');
    expect(pub.textContent).toBe('PublicShown in Explore and in search');
    expect(priv.textContent).toBe('PrivateOnly you can see it');
    expect(priv.querySelector('[data-testid="sheet-selected"]')).toBeTruthy();
    expect(pub.querySelector('[data-testid="sheet-selected"]')).toBeNull();
    expect(priv.getAttribute('aria-selected')).toBe('true');
    expect(pub.getAttribute('aria-selected')).not.toBe('true');
  });

  it('moves the tick to Public on a public list', () => {
    state.mine = [collection({ is_public: true })];
    show();
    fireEvent.click(screen.getByTestId('collection-visibility'));
    expect(screen.getByTestId('sheet-action-public').querySelector('[data-testid="sheet-selected"]')).toBeTruthy();
    expect(screen.getByTestId('sheet-action-private').querySelector('[data-testid="sheet-selected"]')).toBeNull();
  });

  it('writes nothing when the answer chosen is the one already given', () => {
    for (const is_public of [false, true]) {
      state.mine = [collection({ is_public })];
      show();
      chooseVisibility(is_public ? 'public' : 'private');
      expect(spies.setCollectionPublic).not.toHaveBeenCalled();
      expect(screen.queryByText('Undo')).toBeNull();
      cleanup();
    }
  });

  it('draws the padlock or the globe as the foot\u2019s glyph, with a chevron and no pin', () => {
    show();
    let foot = screen.getByTestId('collection-stats');
    expect(foot.querySelector('[data-icon="lock-closed-outline"]')).toBeTruthy();
    expect(foot.querySelector('[data-icon="chevron-down"]')).toBeTruthy();
    expect(foot.querySelector('[data-icon="location-outline"]')).toBeNull();
    cleanup();
    state.mine = [collection({ is_public: true })];
    show();
    foot = screen.getByTestId('collection-stats');
    expect(foot.querySelector('[data-icon="globe-outline"]')).toBeTruthy();
    expect(foot.querySelector('[data-icon="lock-closed-outline"]')).toBeNull();
  });

  it('makes a list public, reloads both catalogs, and says so with no Undo', async () => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    show();
    chooseVisibility('public');
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', true);
    expect(await screen.findByText('This collection is now public')).toBeTruthy();
    expect(spies.mineReload).toHaveBeenCalled();
    expect(spies.colsReload).toHaveBeenCalled();
    // The way back is the word at the card's foot, not a button here.
    expect(screen.queryByText('Undo')).toBeNull();
    // VoiceOver cannot see a banner arrive, so it is told.
    expect(announce).toHaveBeenCalledWith('This collection is now public');
    announce.mockRestore();
  });

  it('puts the banner away by itself after three seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      show();
      pickVisibility('public');
      await act(async () => {});
      expect(screen.getByTestId('collection-banner')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(2999); });
      expect(screen.getByTestId('collection-banner')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.queryByTestId('collection-banner')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs no clock on a visit with nothing to say', () => {
    const ease = vi.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      show();
      act(() => { vi.advanceTimersByTime(3000); });
      expect(ease).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      ease.mockRestore();
    }
  });

  it('gives a new message its own three seconds', async () => {
    // The write lands, so the list the screen reads back has changed and
    // the sheet's other answer is the live one.
    spies.setCollectionPublic.mockImplementation(async (_slug: string, next: boolean) => {
      state.mine = [collection({ is_public: next })];
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      show();
      pickVisibility('public');
      await act(async () => {});
      act(() => { vi.advanceTimersByTime(2000); });
      // Changed back before the first message had gone.
      pickVisibility('private');
      await act(async () => {});
      expect(screen.getByText('This collection is private again')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(2500); });
      expect(screen.getByText('This collection is private again')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(500); });
      expect(screen.queryByTestId('collection-banner')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('eases the banner in and out, but not under Reduce Motion', async () => {
    const ease = vi.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
    show();
    chooseVisibility('public');
    fireEvent.click(await screen.findByTestId('collection-banner'));
    // Once to open the row, once to close it.
    expect(ease).toHaveBeenCalledTimes(2);
    cleanup();
    ease.mockClear();
    const reduce = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    show();
    await act(async () => {});
    chooseVisibility('public');
    fireEvent.click(await screen.findByTestId('collection-banner'));
    expect(ease).not.toHaveBeenCalled();
    reduce.mockRestore();
    ease.mockRestore();
  });

  it('makes a public list private again', async () => {
    state.mine = [collection({ is_public: true })];
    show();
    chooseVisibility('private');
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', false);
    expect(await screen.findByText('This collection is private again')).toBeTruthy();
  });

  it('dismisses the banner when it is tapped', async () => {
    show();
    chooseVisibility('public');
    const banner = await screen.findByText('This collection is now public');
    fireEvent.click(banner);
    expect(screen.queryByText('This collection is now public')).toBeNull();
  });

  it('refuses while places are pending or rejected, and says which in words', () => {
    state.places = [
      PHO,
      place('cafe', 'Cafe Giang', { is_published: false, review_status: 'pending' } as Partial<Place>),
      place('museum', 'Fine Arts Museum', { is_published: false, review_status: 'flagged' } as Partial<Place>),
    ];
    show();
    fireEvent.click(screen.getByTestId('collection-visibility'));
    const row = screen.getByTestId('sheet-action-public');
    // On the row reached for, in place of what Public would mean.
    expect(row.textContent).toBe(
      'PublicPrivate until every place is live — 1 place is not public yet, and 1 was not accepted.',
    );
    expect(row.getAttribute('aria-disabled')).toBe('true');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(row);
      act(() => { vi.runAllTimers(); });
    } finally {
      vi.useRealTimers();
    }
    expect(spies.setCollectionPublic).not.toHaveBeenCalled();
    // The sheet stays open over a refused tap, and nothing is said.
    expect(screen.getByTestId('sheet-action-public')).toBeTruthy();
    expect(screen.queryByTestId('collection-banner')).toBeNull();
    // Private stays a live row.
    expect(screen.getByTestId('sheet-action-private').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('pluralises the blocker sentence', () => {
    const pending = { is_published: false, review_status: 'pending' } as Partial<Place>;
    state.places = [place('pho', 'Pho 10', pending), place('cafe', 'Cafe Giang', pending), MUSEUM];
    show();
    fireEvent.click(screen.getByTestId('collection-visibility'));
    expect(screen.getByText('Private until every place is live — 2 places are not public yet.')).toBeTruthy();
  });

  it('still lets a blocked list be made private', async () => {
    state.mine = [collection({ is_public: true })];
    state.places = [place('pho', 'Pho 10', { review_status: 'flagged' } as Partial<Place>), CAFE, MUSEUM];
    show();
    // Public itself is live while it is the answer already given.
    fireEvent.click(screen.getByTestId('collection-visibility'));
    expect(screen.getByTestId('sheet-action-public').getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByTestId('sheet-action-public').textContent).toBe('PublicShown in Explore and in search');
    cleanup();
    spies.setCollectionPublic.mockImplementation(async (_slug: string, next: boolean) => {
      state.mine = [collection({ is_public: next })];
    });
    show();
    chooseVisibility('private');
    expect(spies.setCollectionPublic).toHaveBeenCalledWith('old-quarter', false);
    expect(await screen.findByText('This collection is private again')).toBeTruthy();
    // And the way back is now dimmed, with the reason on it.
    fireEvent.click(screen.getByTestId('collection-visibility'));
    expect(screen.getByTestId('sheet-action-public').textContent)
      .toBe('PublicPrivate until every place is live — 1 was not accepted.');
  });

  it('says so when the write fails, and shows no banner', async () => {
    spies.setCollectionPublic.mockRejectedValueOnce(new Error('offline'));
    show();
    chooseVisibility('public');
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not publish', 'offline'));
    expect(spies.mineReload).not.toHaveBeenCalled();
    expect(screen.queryByText('This collection is now public')).toBeNull();
  });

  it('names the other direction when making private fails', async () => {
    state.mine = [collection({ is_public: true })];
    spies.setCollectionPublic.mockRejectedValueOnce(new Error('nope'));
    show();
    chooseVisibility('private');
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
  let announce: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    cardProps.clear();
    responder.config = null;
    announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); announce.mockRestore(); });

  it('lets the owner hold any card of the list as it is, with no mode to enter first', () => {
    show();
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    for (const slug of ['pho', 'cafe', 'museum']) expect(card(slug).onLongPress).toBeTypeOf('function');
    // The rest of the screen stays what it was: the menu.
    expect(button('More')).toBeTruthy();
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
    expect(announce).not.toHaveBeenCalled();
    await pastTheBeat();
    expect(spies.reorderCollection).toHaveBeenCalledTimes(1);
    expect(spies.reorderCollection).toHaveBeenCalledWith('old-quarter', ['cafe', 'pho', 'museum']);
    // Said to VoiceOver, which cannot see the card land; nothing drawn
    // beside the ⋯, where it used to push the title over on every drag.
    expect(announce).toHaveBeenCalledWith('Order saved');
    for (const label of ['Saving…', 'Saved']) expect(screen.queryByText(label)).toBeNull();
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
    expect(announce).not.toHaveBeenCalled();
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
    // Once, when the last order is in, not once per write.
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('goes back to the saved order and says so when the order cannot be saved', async () => {
    spies.reorderCollection.mockRejectedValueOnce(new Error('timeout'));
    show();
    down('pho');
    await pastTheBeat();
    expect(alert).toHaveBeenCalledWith('Could not save the order', 'timeout');
    expect(cards()).toEqual(['card:Pho 10', 'card:Cafe Giang', 'card:Fine Arts Museum']);
    expect(announce).not.toHaveBeenCalled();
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

it('does not show instructional tip boxes in collections', () => {
  show();
  expect(document.querySelector('[data-testid^="tip-"]')).toBeNull();
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
    expect(screen.getByTestId('collection-curator').textContent).toBe('@hanoicrew');
    expect(screen.getByTestId('collection-stats').textContent).toContain('0 places');
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

  it('Save a copy opens the form with the source, its description untouched and the order', () => {
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      copyFrom: {
        sourceId: 'c1',
        cityId: 'hanoi',
        title: 'Old Quarter eats',
        // No "Copied from" line: where a copy came from is `copied_from`
        // on the row and the curator's Activity, not the copy's text.
        desc: 'Where we eat.',
        placeSlugs: ['pho', 'cafe', 'museum'],
        // The kinds the original's owner hid go with it; this one has none.
        kinds: { hidden: [] },
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
    // The sheet names what was reached for: a copy, not a place.
    expect(spies.askToSignIn).toHaveBeenCalledWith('copy', expect.any(Function));
    expect(raw.navigate).not.toHaveBeenCalled();
  });

  // Finished on the reader's return, as the render that knows they are
  // signed in — and finished as far as the form only: nothing is written
  // until they press its button. See `lib/resume`.
  it('opens the copy form once the guest who asked has signed in', () => {
    const navigation = nav();
    const route = { params: { slug: 'old-quarter' } } as RootRoute<'CollectionDetail'>;
    const { rerender } = render(<CollectionDetailScreen navigation={navigation.n} route={route} />);
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    const resume = spies.askToSignIn.mock.calls.at(-1)![1] as () => void;
    state.uid = 'u2';
    rerender(<CollectionDetailScreen navigation={navigation.n} route={route} />);
    act(() => { resume(); });
    expect(spies.askToSignIn).toHaveBeenCalledOnce();
    expect(navigation.raw.navigate).toHaveBeenCalledWith('CollectionForm', expect.objectContaining({
      copyFrom: expect.objectContaining({ cityId: expect.any(String) }),
    }));
  });

  it('a list with no owner is never treated as yours', () => {
    state.cols = [theirs({ owner_id: null })];
    show();
    openMenu();
    expect(screen.queryByText('Delete collection')).toBeNull();
    expect(menuRow('Save a copy')).toBeTruthy();
  });
});

// ── the door to a day ──
//
// The planner has seeded plans from collections since 12 Oct 2026; the
// owner's review asked for the step to be on the list itself, at its foot
// where the Add place slot stood, wearing the planner's own paw. The
// planner decides the city, so this button only sends the slug.
describe('Plan a trip', () => {
  // Never on the card (owner, 16 Oct 2026): the menu always, the dock once
  // scrolled — see "the actions and the dock".
  it('is not on the card', () => {
    show();
    expect(screen.queryByRole('button', { name: 'Plan a trip' })).toBeNull();
    expect(screen.queryByTestId('collection-add')).toBeNull();
  });

  it('is in the owner’s menu, under Add place, wearing the paw, and sends the list as a fresh ask each time', () => {
    show();
    openMenu();
    const row = screen.getByTestId('collection-menu-plan');
    expect(row.querySelector('[data-icon="paw-outline"]')).toBeTruthy();
    const labels = [...document.querySelectorAll('[aria-modal] [role="button"]')].map((b) => b.textContent);
    expect(labels.indexOf('Plan a trip')).toBe(labels.indexOf('Add place') + 1);
    fireEvent.click(row);
    expect(spies.goTo).toHaveBeenCalledWith('Ideas', { screen: 'IdeasHome', params: { from: 'old-quarter', at: expect.any(Number) } });
    const first = spies.goTo.mock.calls[0][1].params.at;
    openMenu();
    fireEvent.click(screen.getByTestId('collection-menu-plan'));
    expect(spies.goTo.mock.calls[1][1].params.at).toBeGreaterThanOrEqual(first);
  });

  it('is not offered on a list with nothing to plan from', () => {
    state.mine = [collection({}, [])];
    show();
    openMenu();
    expect(screen.queryByTestId('collection-menu-plan')).toBeNull();
    expect(menuRow('Add place')).toBeTruthy();
  });

  it('leads a visitor’s menu, above Save a copy', () => {
    state.mine = [];
    state.cols = [theirs()];
    show();
    openMenu();
    const labels = [...document.querySelectorAll('[aria-modal] [role="button"]')].map((b) => b.textContent);
    expect(labels.filter(Boolean).slice(0, 2)).toEqual(['Plan a trip', 'Save a copy']);
  });

  it('is not in a visitor’s menu for an empty list', () => {
    state.mine = [];
    state.cols = [theirs({}, [])];
    show();
    openMenu();
    expect(screen.queryByTestId('collection-menu-plan')).toBeNull();
    expect(menuRow('Save a copy')).toBeTruthy();
  });
});

// A visitor reads the description in the same card, with no pencil,
// led by the curator rather than the note glyph; with no description the
// card still carries the curator and the count (owner, 16 Oct 2026).
describe('the description, for a visitor', () => {
  it('is the same card, without the pencil', () => {
    state.mine = [];
    state.cols = [theirs()];
    show();
    expect(screen.getByTestId('collection-desc').textContent).toContain('Where we eat.');
    // The face says whose words, so the note glyph gives way to it.
    expect(screen.getByTestId('collection-desc').querySelector('[data-icon="document-text-outline"]')).toBeNull();
    expect(screen.getByTestId('collection-desc').textContent).toMatch(/^@hanoicrewWhere we eat\./);
    expect(screen.queryByRole('button', { name: 'Edit description' })).toBeNull();
  });

  it('is the curator and the count when there is none, and never an invitation', () => {
    state.mine = [];
    state.cols = [theirs({ desc_en: null })];
    show();
    expect(screen.getByTestId('collection-desc').textContent).toMatch(/^@hanoicrew.*places/);
    expect(screen.queryByTestId('collection-desc-empty')).toBeNull();
    expect(screen.queryByText('Add a description')).toBeNull();
  });
});

// The list's chips, inside the description card (owner, 15 Oct 2026):
// every kind its places carry, most places first, less what the owner
// hid, in the pill a place's card wears — and the list's filter: any
// number chosen, a place kept if it carries any of them, nothing chosen
// the whole list, no "All" chip and no second row of chips.
describe('the chips', () => {
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  const cats = (...categories: string[]) => ({ categories } as Partial<Place>);
  // Eats on three, Cafés and Culture on one each, Nightlife on one.
  const eatery = () => {
    state.places = [
      place('pho', 'Pho 10', cats('eats')),
      place('cafe', 'Cafe Giang', cats('cafes', 'eats', 'nightlife')),
      place('museum', 'Fine Arts Museum', cats('heritage')),
      place('bun', 'Bun Cha', cats('eats')),
    ];
  };
  const four = ['pho', 'cafe', 'museum', 'bun'].map((sl) => place(sl, sl));
  const cards = () => screen.getAllByText(/^card:/).map((e) => e.textContent);
  const chip = (k: string) => screen.getByTestId(`collection-kinds-${k}`);
  const on = (k: string) => chip(k).getAttribute('aria-selected') === 'true';
  // A theme colour as the browser reports it: rgba() kept, hex converted.
  const rgba = (c: string) => (c.startsWith('#') ? rgb(c) : c.replace(/,(?=\S)/g, ', '));
  // The pill inside the button: `PressableScale`'s animated view, then it.
  const pillOf = (k: string) => chip(k).firstElementChild!.firstElementChild as HTMLElement;

  it('shows every kind the places carry, most places first, under the words, in the card’s pill', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    const card = screen.getByTestId('collection-desc');
    const row = screen.getByTestId('collection-kinds');
    expect(card.contains(row)).toBe(true);
    // Eats leads on three of four; the ones-each follow in the filter
    // row's order. No threshold and no count beside the words.
    expect(row.textContent).toBe('EatsCafésCultureNightlife');
    // The pill a place's card wears: a dot in the category's colour, no glyph.
    const dot = pillOf('eats').firstElementChild as HTMLElement;
    expect(getComputedStyle(dot).backgroundColor).toBe(rgb(CATEGORIES.eats.color));
    expect(row.querySelector('[data-icon]')).toBeNull();
    // One row of chips: none under the card.
    expect(screen.queryByTestId('collection-filter')).toBeNull();
    expect(screen.queryByText('All')).toBeNull();
  });

  it('leaves out what the owner hid', () => {
    eatery();
    state.mine = [collection({ kinds_hidden: ['eats'], kinds_added: ['nature'] }, four)];
    show();
    // A kind once "put on" is retired with the threshold: it shows only
    // if a place carries it.
    expect(screen.getByTestId('collection-kinds').textContent).toBe('CafésCultureNightlife');
  });

  it('speaks the reader’s language', () => {
    eatery();
    state.lang = 'vi';
    state.mine = [collection({}, four)];
    show();
    expect(screen.getByTestId('collection-kinds').textContent).toBe('Ăn uốngCà phêVăn hóaVề đêm');
  });

  it('draws no row where the places carry nothing', () => {
    state.mine = [collection()];
    show();
    expect(screen.getByTestId('collection-desc')).toBeTruthy();
    expect(screen.queryByTestId('collection-kinds')).toBeNull();
  });

  it('narrows to any chosen kind, says how many, and clears in one tap', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    expect(chip('eats').getAttribute('role')).toBe('button');
    expect(['eats', 'cafes', 'heritage', 'nightlife'].some(on)).toBe(false);
    expect(cards()).toHaveLength(4);
    fireEvent.click(chip('nightlife'));
    expect(on('nightlife')).toBe(true);
    expect(cards()).toEqual(['card:Cafe Giang']);
    expect(screen.getByTestId('collection-filter-count').textContent).toBe('1 of 4 places');
    // Lit as Explore's chips are, and only while chosen: the glass a step
    // heavier, its border drawn in the glass's own line — not an accent
    // ring — and the word in the accent.
    const lit = getComputedStyle(pillOf('nightlife'));
    const unlit = getComputedStyle(pillOf('eats'));
    expect(lit.borderTopColor).not.toBe(unlit.borderTopColor);
    expect(lit.backgroundColor).not.toBe(unlit.backgroundColor);
    expect(lit.borderTopColor).toBe(rgba(String(colors.borderGlass)));
    expect(lit.borderTopColor).not.toBe(rgba(String(colors.accent)));
    // Any, not all: a second chip widens, in the list's own order.
    fireEvent.click(chip('heritage'));
    expect(cards()).toEqual(['card:Cafe Giang', 'card:Fine Arts Museum']);
    expect(screen.getByTestId('collection-filter-count').textContent).toBe('2 of 4 places');
    // Tapped again, a chip lets go of its kind.
    fireEvent.click(chip('nightlife'));
    expect(cards()).toEqual(['card:Fine Arts Museum']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(['eats', 'cafes', 'heritage', 'nightlife'].some(on)).toBe(false);
    expect(cards()).toHaveLength(4);
    expect(screen.queryByTestId('collection-filter-count')).toBeNull();
  });

  it('counts in the reader’s language', () => {
    eatery();
    state.lang = 'vi';
    state.mine = [collection({}, four)];
    show();
    fireEvent.click(chip('eats'));
    expect(screen.getByTestId('collection-filter-count').textContent).toBe('3 trên 4 địa điểm');
    expect(screen.getByRole('button', { name: 'Bỏ lọc' })).toBeTruthy();
  });

  // A filter of one kind narrows nothing, so its pill is a label.
  it('makes no button of the one chip on a list of one kind', () => {
    state.places = [place('pho', 'Pho 10', cats('eats')), place('bun', 'Bun Cha', cats('eats'))];
    state.mine = [collection({}, [place('pho', 'p'), place('bun', 'b')])];
    show();
    const row = screen.getByTestId('collection-kinds');
    expect(row.textContent).toBe('Eats');
    expect(row.querySelector('[role="button"]')).toBeNull();
  });

  // Narrowed, a card names the chosen kind it answers to — the first in
  // the card's order — as a card under a chip does on Explore.
  it('has each card name the chosen kind it answers to', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    expect(cardProps.get('cafe')!.chip ?? null).toBeNull();
    fireEvent.click(chip('nightlife'));
    expect(cardProps.get('cafe')!.chip).toBe('nightlife');
    // Eats leads the card, so it answers before Nightlife.
    fireEvent.click(chip('eats'));
    expect(cardProps.get('cafe')!.chip).toBe('eats');
  });

  // No order to change among places the reader cannot all see.
  it('stops the owner reordering while narrowed', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    expect(cardProps.get('pho')!.onLongPress).toBeTruthy();
    fireEvent.click(chip('eats'));
    expect(cardProps.get('pho')!.onLongPress).toBeUndefined();
    fireEvent.click(chip('eats'));
    expect(cardProps.get('pho')!.onLongPress).toBeTruthy();
  });

  it('plans from the whole list while narrowed', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    fireEvent.click(chip('eats'));
    openMenu();
    expect(screen.getByTestId('collection-menu-plan')).toBeTruthy();
  });

  // A chosen kind the list no longer carries is let go, not kept as a
  // filter nothing can match.
  it('lets go of a chosen kind the places stop carrying', () => {
    eatery();
    state.mine = [collection({}, four)];
    show();
    fireEvent.click(chip('nightlife'));
    state.places = [
      place('pho', 'Pho 10', cats('eats')),
      place('cafe', 'Cafe Giang', cats('cafes', 'eats')),
      place('museum', 'Fine Arts Museum', cats('heritage')),
      place('bun', 'Bun Cha', cats('eats')),
    ];
    fireEvent.click(chip('heritage'));
    expect(screen.queryByTestId('collection-kinds-nightlife')).toBeNull();
    expect(cards()).toEqual(['card:Fine Arts Museum']);
    // With the one kind left let go, nothing is chosen: the whole list.
    fireEvent.click(chip('heritage'));
    expect(cards()).toHaveLength(4);
    expect(screen.queryByTestId('collection-filter-count')).toBeNull();
  });

  // The owner with no words yet: the line and the pencil open the form;
  // the chips under the line filter, not open it.
  it('rides under the owner’s invitation, which no longer takes the chips’ taps', () => {
    eatery();
    const { raw } = (() => { state.mine = [collection({ desc_en: null }, four)]; return show(); })();
    const invite = screen.getByTestId('collection-desc-empty');
    expect(invite.contains(screen.getByTestId('collection-kinds'))).toBe(true);
    expect(screen.queryByTestId('collection-desc')).toBeNull();
    fireEvent.click(chip('eats'));
    expect(raw.navigate).not.toHaveBeenCalled();
    expect(cards()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Add a description' }));
    expect(raw.navigate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    expect(raw.navigate).toHaveBeenCalledTimes(2);
  });

  // A visitor's list with chips and no words still gets the card, but no
  // note glyph — there is no note.
  it('gives a visitor the card for chips alone, without the note glyph', () => {
    eatery();
    state.mine = [];
    state.cols = [theirs({ desc_en: null }, four)];
    show();
    const card = screen.getByTestId('collection-desc');
    expect(card.textContent).toBe('@hanoicrewEatsCafésCultureNightlife4 places');
    expect(card.querySelector('[data-icon="document-text-outline"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit description' })).toBeNull();
  });

  it('carries the kinds the original’s owner hid into a copy', () => {
    eatery();
    state.mine = [];
    state.cols = [theirs({ kinds_hidden: ['eats'] }, four)];
    const { raw } = show();
    openMenu();
    fireEvent.click(menuRow('Save a copy'));
    endModalFade();
    return waitFor(() => expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', expect.objectContaining({
      copyFrom: expect.objectContaining({ kinds: { hidden: ['eats'] } }),
    })));
  });
});

// The card's head and foot (owner, 16 Oct 2026): the curator leads a
// visitor's card, the count and the heart end every card, and the handle
// opens a sheet to report the list or block the person behind it.
describe('the introduction card', () => {
  beforeEach(() => {
    state.mine = [];
    state.cols = [theirs()];
  });
  const sheetRow = (name: string | RegExp) => screen.queryByRole('button', { name });

  it('keeps the heart in the foot, beside nothing but the count', () => {
    show();
    const foot = screen.getByTestId('collection-stats');
    expect(foot.querySelector('[data-icon="heart-outline"]')).toBeTruthy();
    expect(foot.querySelector('[data-icon="location-outline"]')).toBeTruthy();
  });

  it('leaves a visitor\u2019s header with the title alone', () => {
    show();
    expect(screen.queryByText(/·/)).toBeNull();
    expect(screen.getAllByText('@hanoicrew')).toHaveLength(1);
  });

  it('offers only the report for an editorial handle with nobody behind it', () => {
    show();
    fireEvent.click(screen.getByTestId('collection-curator'));
    expect(sheetRow(/Report this list/)).toBeTruthy();
    expect(sheetRow(/Block/)).toBeNull();
  });

  it('opens the report sheet for this list from the curator sheet', () => {
    vi.useFakeTimers();
    try {
      show();
      fireEvent.click(screen.getByTestId('collection-curator'));
      fireEvent.click(sheetRow(/Report this list/)!);
      vi.runAllTimers();
      expect(spies.report).toHaveBeenCalledWith(expect.objectContaining({ kind: 'collection', ownerId: 'curator' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks the owner of the list once confirmed, where a person stands behind the handle', async () => {
    spies.profileLookup.mockImplementation(() => ({ data: { id: 'curator', full_name: 'Thai Ba Son', avatar_url: '' }, loading: false }));
    vi.useFakeTimers();
    try {
      show();
      fireEvent.click(screen.getByTestId('collection-curator'));
      // The sheet names the person, with the handle under the name.
      expect(screen.getByText('Thai Ba Son')).toBeTruthy();
      fireEvent.click(sheetRow(/Block @hanoicrew/)!);
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
    expect(alert.mock.calls.at(-1)![0]).toBe('Block @hanoicrew?');
    expect(spies.blockUser).not.toHaveBeenCalled();
    pressInAlert('Block');
    expect(spies.blockUser).toHaveBeenCalledWith('curator');
    await waitFor(() => expect(alert.mock.calls.at(-1)![0]).toBe('@hanoicrew is blocked'));
  });

  it('says so when the block fails', async () => {
    state.cachedAvatar = 'https://img/face.jpg';
    spies.blockUser.mockImplementation(async () => { throw new Error('nope'); });
    vi.useFakeTimers();
    try {
      show();
      fireEvent.click(screen.getByTestId('collection-curator'));
      fireEvent.click(sheetRow(/Block @hanoicrew/)!);
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
    pressInAlert('Block');
    await waitFor(() => expect(alert.mock.calls.at(-1)![0]).toBe('Could not block'));
  });

  it('is not a button where there is nothing to do — signed out', () => {
    state.uid = null;
    spies.canReport.mockImplementation(() => false);
    show();
    expect(screen.getByTestId('collection-curator').getAttribute('role')).not.toBe('button');
  });

  it('closes the sheet when dismissed', () => {
    show();
    fireEvent.click(screen.getByTestId('collection-curator'));
    fireEvent.click(screen.getAllByLabelText('Close').at(-1)!);
    endModalFade();
    expect(sheetRow(/Report this list/)).toBeNull();
  });

  it('leads your own list with your own face and handle, from your profile, as no button', () => {
    state.cols = [];
    state.profile = { handle: 'andy', avatar_url: 'https://img/me.jpg' };
    state.mine = [collection({ curator_handle: '@old-handle' })];
    show();
    const row = screen.getByTestId('collection-curator');
    expect(row.textContent).toBe('@andy');
    expect(row.getAttribute('role')).not.toBe('button');
    expect(row.querySelector('img[src="https://img/me.jpg"]')).toBeTruthy();
    const card = screen.getByTestId('collection-desc');
    expect(card.querySelector('[data-icon="document-text-outline"]')).toBeNull();
    expect(screen.getByTestId('collection-stats')).toBeTruthy();
    // Still nobody looked up, and still no credit in the header.
    expect(spies.profileLookup).toHaveBeenCalledWith(null);
    expect(screen.getAllByText('@andy')).toHaveLength(1);
  });

  it('draws a face slot for your own list with no photo, and the note glyph only with no handle', () => {
    state.cols = [];
    state.mine = [collection()];
    show();
    expect(screen.getByTestId('collection-curator').querySelector('[data-icon="person-outline"]')).toBeTruthy();
    cleanup();
    state.profile = { handle: '', avatar_url: '' };
    show();
    expect(screen.queryByTestId('collection-curator')).toBeNull();
    expect(screen.getByTestId('collection-desc').querySelector('[data-icon="document-text-outline"]')).toBeTruthy();
  });
});

// The list's two actions (owner, 16 Oct 2026): at the end of the card at
// the top, and in the tab bar's dock once the card has scrolled away and
// the bar has ducked — never both at once.
describe('the actions and the dock', () => {
  /** The props of the first committed element `pick` accepts. */
  const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, unknown> => {
    type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
    const stack: Fiber[] = [host[key].stateNode.current];
    while (stack.length) {
      const fb = stack.pop()!;
      const p = fb.memoizedProps;
      if (p && typeof p === 'object' && pick(p)) return p;
      if (fb.sibling) stack.push(fb.sibling);
      if (fb.child) stack.push(fb.child);
    }
    throw new Error('nothing matched');
  };
  // The list's own `onScroll`, as the FlatList would call it.
  const listScroll = (y: number) => act(() => {
    const p = propsWhere((q) => typeof q.onScroll === 'function' && 'ListHeaderComponent' in q);
    (p.onScroll as (e: unknown) => void)({ nativeEvent: { contentOffset: { x: 0, y } } });
  });
  /** Lay the card out 300 tall at the top, then scroll the list to `y`. */
  const pastTheCard = (y = 400) => {
    act(() => {
      const p = propsWhere((q) => q.testID === 'collection-intro');
      (p.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { y: 8, height: 300 } } });
    });
    listScroll(y);
  };
  const settle = () => act(() => { vi.advanceTimersByTime(400); });

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });


  it('keeps Add place in the ⋯ menu as well', () => {
    show();
    openMenu();
    expect(menuRow('Add place')).toBeTruthy();
  });


  // The whole island is the press, as Explore's is.
  const island = () => screen.getByTestId('collection-dock').firstElementChild as HTMLElement;

  it('rises into the dock once the card has gone and the bar has ducked', () => {
    state.ducked = true;
    const { parent } = show();
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
    pastTheCard();
    settle();
    // Explore's shape (owner, 17 Oct 2026): the plan said in two lines,
    // then the gradient "+ Địa điểm" — the very pill Explore's dock ends in.
    expect(screen.getByTestId('collection-dock').textContent)
      .toBe('Plan a tripUse it for a tripPlace');
    expect(island().querySelector('[data-icon="paw"]')).toBeTruthy();
    fireEvent.click(island());
    expect(spies.goTo).toHaveBeenCalledWith('Ideas', expect.objectContaining({ params: expect.objectContaining({ from: 'old-quarter' }) }));
    spies.goTo.mockClear();
    const add = screen.getByTestId('collection-dock-add');
    expect(add.querySelector('[data-icon="add"]')).toBeTruthy();
    // The noun on screen, the whole act for VoiceOver.
    expect(add.getAttribute('aria-label')).toBe('Add place');
    fireEvent.click(add);
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
    // The pill is its own press, not the island's.
    expect(spies.goTo).not.toHaveBeenCalled();
  });

  it('says it in the owner\u2019s chosen words, in Vietnamese', () => {
    state.lang = 'vi';
    state.ducked = true;
    show();
    pastTheCard();
    settle();
    expect(screen.getByTestId('collection-dock').textContent)
      .toBe('Lên kế hoạchDùng cho chuyến điĐịa điểm');
  });

  it('offers a visitor the copy as the gradient pill', () => {
    state.ducked = true;
    state.mine = [];
    state.cols = [theirs()];
    const { raw } = show();
    pastTheCard();
    settle();
    expect(screen.getByTestId('collection-dock').textContent)
      .toBe('Plan a tripUse it for a tripSave a copy');
    expect(screen.queryByTestId('collection-dock-add')).toBeNull();
    const pill = screen.getByTestId('collection-dock-copy');
    // The ⋯ menu's copy glyph, not a plus.
    expect(pill.querySelector('[data-icon="duplicate-outline"]')).toBeTruthy();
    expect(pill.querySelector('[data-icon="add"]')).toBeNull();
    // The same copy the ⋯ menu makes: the form, waiting, nothing written.
    fireEvent.click(pill);
    expect(raw.navigate).toHaveBeenCalledWith('CollectionForm', {
      copyFrom: expect.objectContaining({ sourceId: 'c1', cityId: 'hanoi' }),
    });
    expect(spies.goTo).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in before the copy', () => {
    state.ducked = true;
    state.uid = null;
    state.mine = [];
    state.cols = [theirs()];
    const { raw } = show();
    pastTheCard();
    settle();
    fireEvent.click(screen.getByTestId('collection-dock-copy'));
    expect(spies.askToSignIn).toHaveBeenCalledWith('copy', expect.any(Function));
    expect(raw.navigate).not.toHaveBeenCalledWith('CollectionForm', expect.anything());
  });

  it('is the plan alone where there is no city to file a copy under', () => {
    state.ducked = true;
    state.mine = [];
    state.cols = [theirs({ city_id: null } as Partial<Collection>)];
    state.city = null;
    show();
    pastTheCard();
    settle();
    expect(screen.getByTestId('collection-dock').textContent).toBe('Plan a tripUse it for a trip');
    expect(screen.queryByTestId('collection-dock-copy')).toBeNull();
    fireEvent.click(island());
    expect(spies.goTo).toHaveBeenCalledWith('Ideas', expect.anything());
  });

  it('stays away while the card is still on screen, or while the bar holds the dock', () => {
    state.ducked = true;
    show();
    pastTheCard(200);
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
    cleanup();
    state.ducked = false;
    show();
    pastTheCard();
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
  });

  it('goes when the reader scrolls back to the card', () => {
    state.ducked = true;
    show();
    pastTheCard();
    settle();
    expect(screen.getByTestId('collection-dock')).toBeTruthy();
    listScroll(100);
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
  });

  it('never rises on a list with nothing to plan from', () => {
    state.ducked = true;
    state.mine = [collection({}, [])];
    show();
    pastTheCard();
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
  });

  // Coming back to the screen hands the slot back to the bar, which
  // reappears on arrival; the dock waits for the bar to leave again.
  it('hands the dock back to the bar when the screen is focused again', () => {
    state.ducked = true;
    show();
    pastTheCard();
    settle();
    expect(screen.getByTestId('collection-dock')).toBeTruthy();
    act(() => focusListeners.forEach((cb) => cb()));
    settle();
    expect(screen.queryByTestId('collection-dock')).toBeNull();
  });
});

// Two ways to look at a list (owner, 22 Oct 2026): the cards, or a grid of
// three to a row. One choice for every list, kept on the phone; the way
// between them is a row in either menu, named for where it goes. The grid
// shows the list's order and does not change it — that is the cards' job
// until the grid learns to drag.
describe('the grid', () => {
  const VIEW = 'citycrew.collection.view';
  beforeEach(async () => { await AsyncStorage.removeItem(VIEW); });
  afterEach(async () => { await AsyncStorage.removeItem(VIEW); });
  const toGrid = () => { openMenu(); fireEvent.click(menuRow('Grid view')); endModalFade(); };
  const tiles = () => [0, 1, 2].map((i) => screen.getByTestId(`collection-tile-${i}`).textContent);

  it('opens on the cards, and the menu offers the grid', () => {
    show();
    expect(screen.getByText('card:Pho 10')).toBeTruthy();
    expect(screen.queryByTestId('collection-tile-0')).toBeNull();
    openMenu();
    expect(menuRow('Grid view')).toBeTruthy();
  });

  it('draws the places as tiles in the list’s order, and remembers the choice', () => {
    show();
    toGrid();
    expect(tiles()).toEqual([
      expect.stringContaining('Pho 10'), expect.stringContaining('Cafe Giang'), expect.stringContaining('Fine Arts Museum'),
    ]);
    expect(screen.queryByText('card:Pho 10')).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(VIEW, 'grid');
  });

  it('names the way back, and takes it', () => {
    show();
    toGrid();
    openMenu();
    expect(screen.queryByText('Grid view')).toBeNull();
    fireEvent.click(menuRow('List view'));
    expect(screen.getByText('card:Pho 10')).toBeTruthy();
    expect(screen.queryByTestId('collection-tile-0')).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(VIEW, 'list');
  });

  it('opens on the grid when that was the last choice, on any list', async () => {
    await AsyncStorage.setItem(VIEW, 'grid');
    state.mine = [];
    state.cols = [theirs()];
    show();
    await waitFor(() => expect(screen.getByTestId('collection-tile-0')).toBeTruthy());
  });

  it('opens a place from its tile', () => {
    const { raw } = show();
    toGrid();
    fireEvent.click(screen.getByTestId('collection-tile-1'));
    expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cafe' });
  });

  it('lifts nothing in the grid, even on the owner’s own list', () => {
    show();
    expect(screen.getByTestId('drag-pho')).toBeTruthy();
    toGrid();
    expect(document.querySelector('[data-testid^="drag-"]')).toBeNull();
  });

  // How a list is looked at is the reader's, whoever made the list.
  it('is in a visitor’s menu too, and leads it when nothing else does', () => {
    state.mine = [];
    state.city = null;
    state.cols = [theirs({ city_id: null } as Partial<Collection>, [])];
    show();
    openMenu();
    const rows = [...document.querySelectorAll('[aria-modal] [role="button"]')].filter((b) => b.textContent);
    expect(rows[0].textContent).toBe('Grid view');
    // The first row carries no rule above it; every row after it does.
    const rule = (el: Element) => parseFloat(getComputedStyle(el).borderTopWidth) || 0;
    expect(rule(rows[0])).toBe(0);
    expect(rule(rows[1])).toBeGreaterThan(0);
  });
});
