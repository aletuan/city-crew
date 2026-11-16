// @vitest-environment jsdom
// A person's page (16 Nov 2026): the first step of a profile, built only
// from what was already public — the profile and the lists a person
// published. What is checked here is what a reader is shown: whose page
// it is, which lists are on it and which are not, what stands across the
// top, and the friend button by what stands between the two of you.
//
// Every person in these fixtures has their own handle, name and face,
// and who is shown is asserted both ways — the right one there, the
// reader not (`CLAUDE.md`'s lesson from 15 Nov, when a card named the
// reader as the author of somebody else's list).
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf, waitFor, within } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { FriendshipRow } from '../lib/friends';
import type { Collection } from '../lib/types';
import { bgHex, colors } from '../theme';

type AlertButton = { text: string; onPress?: () => void };
const alert = vi.hoisted(() => vi.fn<(title: string, body?: string, buttons?: AlertButton[]) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

const data = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(async (_me: string, _other: string): Promise<void> => {}),
  acceptFriendRequest: vi.fn(async (_requester: string, _me: string): Promise<void> => {}),
  blockUser: vi.fn(async (_id: string): Promise<void> => {}),
  unblockUser: vi.fn(async (_me: string, _id: string): Promise<void> => {}),
  report: vi.fn((_target: unknown) => {}),
}));
// The report flow is its own component with its own tests; what matters
// here is what this page hands it.
vi.mock('../components/reportFlow', () => ({ useReport: () => ({ report: data.report, node: null }) }));

type Who = { id: string; handle: string; full_name: string; avatar_url: string; bio?: string | null };
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, reload: vi.fn() },
  blocks: { data: [] as string[], reload: vi.fn() },
  mutual: {} as Record<string, number>,
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

const state = vi.hoisted(() => ({
  me: 'me-id' as string | null,
  people: {} as Record<string, Who>,
  asked: [] as (string | null)[],
  lookup: { loading: false, error: null as string | null, reload: vi.fn() },
  shelf: [] as unknown[],
  places: [] as unknown[],
  likes: {} as Record<string, number>,
  common: { places: [] as unknown[], lists: [] as string[] },
  commonAsked: [] as [string | null, string | null][],
  inCommonOn: true,
  topFriendOn: true,
  role: null as 'editor' | 'guide' | null,
  roleAsked: [] as [string | null, string | null][],
  lang: 'en' as 'en' | 'vi',
  scheme: 'dark' as 'dark' | 'light',
}));
vi.mock('../lib/auth', () => ({
  useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }),
}));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: state.shelf, loading: false, reload: () => {} }),
  usePlaces: () => ({ data: state.places, loading: false, reload: () => {} }),
  useLikes: () => ({ likes: state.likes }),
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sendFriendRequest: data.sendFriendRequest,
  acceptFriendRequest: data.acceptFriendRequest,
  blockUser: data.blockUser,
  unblockUser: data.unblockUser,
  // What the two have in common, as the database answered it; `commonAsked`
  // keeps who it was asked for and about.
  useInCommonQuery: (me: string | null, other: string | null) => {
    state.commonAsked.push([me, other]);
    return { data: state.common, loading: false, error: null, reload: () => {} };
  },
  // The mark the person wears, as the database answered it; `roleAsked`
  // keeps who asked and about whom.
  useRoleOfQuery: (me: string | null, person: string | null) => {
    state.roleAsked.push([me, person]);
    return { data: state.role, loading: false, error: null, reload: () => {} };
  },
  useProfileByHandle: (h: string | null) => {
    state.asked.push(h);
    return { data: h ? state.people[h] ?? null : null, ...state.lookup };
  },
}));
// The switch that hides "In common" (`IN_COMMON_ON`), read each time so a
// test can stand on either side of it. On here unless a test says
// otherwise, so the section that is built stays tested while it is off.
vi.mock('../lib/person', async (orig) => {
  const real = await orig<typeof import('../lib/person')>();
  // And the one that hides the header's friend button (`TOP_FRIEND_ON`).
  return { ...real, get IN_COMMON_ON() { return state.inCommonOn; }, get TOP_FRIEND_ON() { return state.topFriendOn; } };
});
// The tab bar's duck, which hears every scroll of the page.
const duck = vi.hoisted(() => vi.fn());
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => duck }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: state.scheme }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import PersonScreen from './PersonScreen';

const LAN: Who = { id: 'lan-id', handle: 'lan', full_name: 'Lan Phạm', avatar_url: 'https://faces/lan.jpg', bio: 'Coffee first, then the rest.' };

const list = (slug: string, over: Partial<Collection> = {}): Collection => ({
  id: slug, slug, title_en: `List ${slug}`, title_vi: `Bộ ${slug}`, title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null, curator_handle: '@lan', cover: null,
  owner_id: 'lan-id', is_public: true, city_id: 'hanoi', collection_places: [],
  ...over,
} as Collection);

const members = (n: number) => Array.from({ length: n }, (_, i) => ({ sort_order: i, places: { slug: `p${i}` } }));

const flush = async () => { await act(async () => {}); };
const show = async (handle = 'lan') => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(<PersonScreen navigation={navigation as unknown as Nav} route={{ params: { handle } } as RootRoute<'Person'>} />);
  await flush();
  return navigation;
};

beforeEach(() => {
  state.me = 'me-id';
  state.people = { lan: LAN };
  state.asked = [];
  state.lookup = { loading: false, error: null, reload: vi.fn() };
  state.shelf = [];
  state.places = [];
  state.likes = {};
  state.common = { places: [], lists: [] };
  state.commonAsked = [];
  state.inCommonOn = true;
  state.topFriendOn = true;
  state.role = null;
  state.roleAsked = [];
  state.lang = 'en';
  state.scheme = 'dark';
  crew.ships.data = [];
  crew.ships.reload.mockClear();
  crew.blocks.data = [];
  crew.blocks.reload.mockClear();
  crew.mutual = {};
  data.blockUser.mockReset();
  data.blockUser.mockImplementation(async () => {});
  data.unblockUser.mockReset();
  data.unblockUser.mockImplementation(async () => {});
  data.report.mockClear();
  alert.mockClear();
  data.sendFriendRequest.mockClear();
  data.acceptFriendRequest.mockClear();
});
afterEach(cleanup);

describe('whose page it is', () => {
  // Name first, as their own Profile heads them (owner, 16 Nov 2026):
  // the exception to the handle-first of every row of people.
  it('is headed by the person’s name, beside the picture, with their handle under and their bio', async () => {
    await show();
    const name = screen.getByTestId('person-name');
    const handle = screen.getByTestId('person-handle');
    expect(name.textContent).toBe('Lan Phạm');
    expect(handle.textContent).toBe('@lan');
    expect(screen.getByTestId('person-bio').textContent).toBe('Coffee first, then the rest.');
    // Name strong, handle quiet.
    expect(textStyleOf(name)?.color).toBe(colors.text);
    expect(textStyleOf(handle)?.color).toBe(colors.textTertiary);
    expect(Number(textStyleOf(name)?.fontSize)).toBeGreaterThan(Number(textStyleOf(handle)?.fontSize));
    // Both beside the picture, the handle right under the name: one
    // column in the picture's row. The handle ran under the whole row
    // for an evening, a picture's width left of its name.
    const row = screen.getByTestId('person-cover').nextElementSibling as HTMLElement;
    expect(viewStyleOf(row).flexDirection).toBe('row');
    const column = name.parentElement!;
    expect([...column.children]).toEqual([name, handle]);
    expect(column.parentElement).toBe(row);
    expect(viewStyleOf(column).flexDirection).not.toBe('row');
    // The column gives rather than pushing the friend button out, and
    // its two lines are the picture's half under the cover.
    expect(viewStyleOf(column).flex).toBe(1);
    expect(Number(textStyleOf(name)?.lineHeight) + Number(textStyleOf(handle)?.lineHeight)).toBe(48);
  });

  // "11 collections" stood under the head until 16 Nov 2026; the
  // collections are right there to be seen.
  it('counts nothing under the head', async () => {
    state.shelf = [list('one'), list('two')];
    await show();
    expect(screen.queryByTestId('person-counts')).toBeNull();
    expect(screen.queryByText(/^\d+ collections?$/)).toBeNull();
    expect(screen.getAllByTestId('person-list')).toHaveLength(2);
  });

  it('wears their face, not the reader’s, ringed in the page’s own ground', async () => {
    await show();
    const face = screen.getByTestId('person-cover').nextElementSibling!.firstElementChild as HTMLElement;
    expect(face.querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
    expect(viewStyleOf(face)).toMatchObject({ borderWidth: 4, borderColor: bgHex.dark });
  });

  it('asks for the profile by the handle it was opened with, the `@` and case off', async () => {
    await show('@Lan');
    expect(state.asked.every((h) => h === 'lan')).toBe(true);
    expect(screen.getByTestId('person-handle').textContent).toBe('@lan');
  });

  it('draws no name line and no bio for somebody who wrote neither', async () => {
    state.people = { lan: { ...LAN, full_name: '', bio: null } };
    await show();
    // Headed by the handle, `@` and all, where a name would stand —
    // beside the picture — and no second line saying it again.
    const handle = screen.getByTestId('person-handle');
    expect(handle.textContent).toBe('@lan');
    expect((screen.getByTestId('person-cover').nextElementSibling as HTMLElement).contains(handle)).toBe(true);
    expect(textStyleOf(handle)?.color).toBe(colors.text);
    // Alone in its column, in the middle of the picture's lower half.
    expect([...handle.parentElement!.children]).toEqual([handle]);
    expect(viewStyleOf(handle.parentElement!)).toMatchObject({ minHeight: 48, justifyContent: 'center' });
    expect(screen.getAllByText('@lan')).toHaveLength(1);
    expect(screen.queryByTestId('person-name')).toBeNull();
    expect(screen.queryByTestId('person-bio')).toBeNull();
  });

  it('goes back through the navigation prop', async () => {
    const navigation = await show();
    fireEvent.click(screen.getByTestId('person-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

// A local guide's star or an editor's medal, on the picture (owner, 16
// Nov 2026). Only the account itself could see it until then, on its
// own Profile; here it tells somebody else the desk trusts this account
// to keep places.
describe('the mark of a role', () => {
  const face = () => screen.getByTestId('person-cover').nextElementSibling!.firstElementChild as HTMLElement;

  it('wears no mark for a person with no role, and asks about this person as the reader', async () => {
    await show();
    expect(screen.queryByTestId('person-role')).toBeNull();
    expect(screen.queryByTestId('role-badge')).toBeNull();
    expect(new Set(state.roleAsked.map((a) => a.join('/')))).toEqual(new Set([`me-id/${LAN.id}`]));
  });

  it('draws a guide’s star on the picture, named for VoiceOver', async () => {
    state.role = 'guide';
    await show();
    const disc = screen.getByRole('button', { name: 'Local Guide' });
    expect(face().contains(disc)).toBe(true);
    expect(disc.querySelector('[data-icon="star"]')).toBeTruthy();
    // The name is not written on the page: the disc is a mark.
    expect(screen.queryByText('Local Guide')).toBeNull();
    // On the corner of the picture, laid over it.
    expect(viewStyleOf(screen.getByTestId('person-role')).position).toBe('absolute');
  });

  // The app's sheet, as the badges on your own Profile open — and about
  // a Local Guide, not "you": the page may be anybody's.
  it('says what a Local Guide can do, in a sheet, about them and not to you', async () => {
    state.role = 'guide';
    await show();
    expect(screen.queryByTestId('badge-sheet-head')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    const head = screen.getByTestId('badge-sheet-head');
    expect(head.textContent).toBe('Local Guide');
    expect(head.querySelector('[data-icon="star"]')).toBeTruthy();
    // One frame, not two (owner, 16 Nov 2026): the title stands on the
    // sheet as other sheets' titles do, and the card is the words'.
    const frame = viewStyleOf(screen.getByTestId('badge-sheet-head'));
    expect([frame.borderWidth, frame.backgroundColor]).toEqual([undefined, undefined]);
    expect(viewStyleOf(screen.getByTestId('badge-sheet-body')).borderWidth).toBe(1);
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('A Local Guide can edit, and add photos to, places in their collections and places they imported.');
    // Closed by the backdrop, then the fade react-native-web runs.
    fireEvent.click(screen.getByLabelText('Close'));
    document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
    await waitFor(() => expect(screen.queryByTestId('badge-sheet-head')).toBeNull());
  });

  it('draws an editor’s medal, called Super User, with its own words', async () => {
    state.role = 'editor';
    await show();
    const disc = screen.getByRole('button', { name: 'Super User' });
    expect(disc.querySelector('[data-icon="medal"]')).toBeTruthy();
    expect(disc.querySelector('[data-icon="star"]')).toBeNull();
    fireEvent.click(disc);
    expect(screen.getByTestId('badge-sheet-head').textContent).toBe('Super User');
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('A Super User can edit, and add photos to, every place in the app.');
  });

  it('says it in Vietnamese', async () => {
    state.lang = 'vi';
    state.role = 'guide';
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('Local Guide có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của họ hoặc các địa điểm họ đã nhập.');
  });

  // Your own page wears your own mark, as other people see it — and
  // says it as they read it.
  it('wears your own mark on your own page, in the same words', async () => {
    state.me = LAN.id;
    state.role = 'guide';
    await show();
    expect(state.roleAsked.at(-1)).toEqual([LAN.id, LAN.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    expect(screen.getByTestId('badge-sheet-body').textContent).toMatch(/^A Local Guide can edit/);
  });

  // Nobody signed in is not told (the database refuses): the question
  // goes out with no reader, which the hook answers with no mark.
  it('asks as nobody when signed out', async () => {
    state.me = null;
    await show();
    expect(state.roleAsked.at(-1)).toEqual([null, LAN.id]);
    expect(screen.queryByTestId('role-badge')).toBeNull();
  });
});

describe('their lists', () => {
  it('shows the lists they published, newest first, and nobody else’s', async () => {
    state.shelf = [
      list('new', { collection_places: members(17) as Collection['collection_places'] }),
      list('minh-list', { owner_id: 'minh-id' }),
      list('desk', { owner_id: null }),
      list('old'),
    ];
    state.likes = { new: 3 };
    await show();
    const tiles = screen.getAllByTestId('person-list');
    expect(tiles.map((x) => x.textContent)).toEqual(['List new17 places · 3 likes', 'List old0 places']);
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
  });

  // The page is one anybody can open: a private list is never on it,
  // even when the shelf it is handed holds one.
  it('never shows a private list', async () => {
    state.shelf = [list('secret', { is_public: false }), list('open')];
    await show();
    expect(screen.getAllByTestId('person-list').map((x) => x.textContent)).toEqual(['List open0 places']);
  });

  it('says one of each in the singular, and titles a list in the reader’s language', async () => {
    state.shelf = [list('one', { collection_places: members(1) as Collection['collection_places'] })];
    state.likes = { one: 1 };
    await show();
    expect(screen.getByTestId('person-list').textContent).toBe('List one1 place · 1 like');
    cleanup();
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('person-list').textContent).toBe('Bộ one1 địa điểm · 1 lượt thích');
  });

  it('opens a list’s own page on a press', async () => {
    state.shelf = [list('new'), list('old')];
    const navigation = await show();
    fireEvent.click(screen.getAllByTestId('person-list')[1]);
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionDetail', { slug: 'old' });
  });

  it('sets them two to a row, with an empty slot beside an odd one out', async () => {
    state.shelf = [list('a'), list('b'), list('c')];
    await show();
    const [a, b, c] = screen.getAllByTestId('person-list');
    expect(a.parentElement).toBe(b.parentElement);
    expect(c.parentElement).not.toBe(a.parentElement);
    expect(c.parentElement!.children).toHaveLength(2);
    expect(viewStyleOf(c.parentElement!.lastElementChild as HTMLElement).flex).toBe(1);
  });

  it('says there are none yet, in a card, for somebody who has published nothing', async () => {
    state.shelf = [list('minh-list', { owner_id: 'minh-id' })];
    await show();
    expect(screen.queryAllByTestId('person-list')).toEqual([]);
    expect(within(screen.getByTestId('person-no-lists')).getByText('No public collections yet')).toBeTruthy();
  });
});

describe('the cover', () => {
  const coverSrc = () => screen.getByTestId('person-cover').querySelector('img')?.getAttribute('src') ?? null;

  it('is the cover of their newest list that has one, and each tile wears its own', async () => {
    state.shelf = [
      list('bare'),
      list('chosen', { cover: { photo_uri: 'https://covers/chosen.jpg' } }),
      list('older', { cover: { photo_uri: 'https://covers/older.jpg' } }),
    ];
    await show();
    expect(coverSrc()).toBe('https://covers/chosen.jpg');
    expect(screen.queryByTestId('person-cover-tint')).toBeNull();
    // The bare one wears the tint; the other two their own photographs.
    expect(screen.getAllByTestId('person-list').map((x) => x.querySelector('img')?.getAttribute('src') ?? null))
      .toEqual([null, 'https://covers/chosen.jpg', 'https://covers/older.jpg']);
  });

  // Not somebody else's photograph across a page that is not theirs.
  it('is not another person’s list’s cover', async () => {
    state.shelf = [list('minh-list', { owner_id: 'minh-id', cover: { photo_uri: 'https://covers/minh.jpg' } })];
    await show();
    expect(coverSrc()).toBeNull();
    expect(screen.getByTestId('person-cover-tint')).toBeTruthy();
  });

  it('is the accent’s tint for somebody with no list, or none with a photograph', async () => {
    await show();
    expect(viewStyleOf(screen.getByTestId('person-cover-tint')).backgroundColor).toBe(colors.accentSoft);
    cleanup();
    state.shelf = [list('bare')];
    await show();
    expect(viewStyleOf(screen.getByTestId('person-cover-tint')).backgroundColor).toBe(colors.accentSoft);
  });
});

// The props a component was last given, found by walking the fibers —
// for the two handlers jsdom never calls: a row's layout, a page's scroll.
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
/** The row of acts laid out with its foot at 300, and the page scrolled. */
const layRow = () => act(() => {
  (propsWhere((q) => q.testID === 'person-acts').onLayout as (e: unknown) => void)({ nativeEvent: { layout: { y: 250, height: 50 } } });
});
const scrollTo = (y: number) => act(() => {
  (propsWhere((q) => typeof q.onScroll === 'function' && 'contentContainerStyle' in q).onScroll as (e: unknown) => void)({
    nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 2000 }, layoutMeasurement: { width: 390, height: 844 } },
  });
});

// What there is to do about a person, in a row of its own under the head
// (owner, 16 Nov 2026). The friend button stood at the end of the name's
// row and, at 44, cut a long name and its handle.
describe('the row of acts', () => {
  const edge = (requester: string, addressee: string, status: 'pending' | 'accepted'): FriendshipRow =>
    ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z', responded_at: null }) as FriendshipRow;
  const headRow = () => screen.getByTestId('person-cover').nextElementSibling as HTMLElement;

  it('holds the friend button and Message, under the head and over the bio', async () => {
    await show();
    const acts = screen.getByTestId('person-acts');
    expect(viewStyleOf(acts).flexDirection).toBe('row');
    // The friend button first, then Message.
    expect(acts.contains(screen.getByTestId('person-add'))).toBe(true);
    expect(acts.contains(screen.getByTestId('person-message'))).toBe(true);
    expect(screen.getByTestId('person-add').compareDocumentPosition(screen.getByTestId('person-message')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Out of the name's row, which the name now has to itself.
    expect(headRow().contains(screen.getByTestId('person-add'))).toBe(false);
    expect(headRow().compareDocumentPosition(acts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(acts.compareDocumentPosition(screen.getByTestId('person-bio')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Not built yet, and said so: dimmed, "Soon" beside the word, and no
  // press at all — nothing pretends to answer one.
  it('draws Message as not yet a button: dimmed, said to be coming, and no press', async () => {
    const navigation = await show();
    const message = screen.getByTestId('person-message');
    expect(message.textContent).toBe('Message' + 'Soon');
    const face = message.firstElementChild as HTMLElement;
    expect(viewStyleOf(face)).toMatchObject({ opacity: 0.45, minHeight: 44, backgroundColor: colors.surfaceCard });
    expect(message.getAttribute('aria-disabled')).toBe('true');
    expect(message.getAttribute('aria-label')).toBe('Message, Soon');
    fireEvent.click(message);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(data.sendFriendRequest).not.toHaveBeenCalled();
    cleanup();
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('person-message').textContent).toBe('Nhắn tin' + 'Sắp có');
  });

  it('holds what already stands too, as the grey words', async () => {
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    await show();
    expect(screen.getByTestId('person-acts').contains(screen.getByTestId('person-friends'))).toBe(true);
    expect(screen.getByTestId('person-message')).toBeTruthy();
  });

  // No friend button, no row: your own page, and nobody signed in.
  it('is not drawn on your own page, nor signed out', async () => {
    state.me = LAN.id;
    await show();
    expect(screen.queryByTestId('person-acts')).toBeNull();
    expect(screen.queryByTestId('person-message')).toBeNull();
    cleanup();
    state.me = null;
    await show();
    expect(screen.queryByTestId('person-acts')).toBeNull();
  });
});

// Three rows of collections down, Add friend is a scroll back up — so
// once its row has gone under the header, the header offers it again,
// small, beside the ⋯ (owner, 16 Nov 2026).
describe('the friend button in the header', () => {
  const edge = (requester: string, addressee: string, status: 'pending' | 'accepted'): FriendshipRow =>
    ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z', responded_at: null }) as FriendshipRow;

  // Hidden, not removed (owner, 16 Nov 2026): as shipped the header
  // gains nothing on scroll, and the ⋯ stays where it was, alone.
  it('is switched off as shipped: the header stays the ⋯ alone, however far the page scrolls', async () => {
    const real = await vi.importActual<typeof import('../lib/person')>('../lib/person');
    expect(real.TOP_FRIEND_ON).toBe(false);
    state.topFriendOn = real.TOP_FRIEND_ON;
    await show();
    layRow();
    scrollTo(900);
    expect(screen.queryByTestId('person-top-add')).toBeNull();
    expect(screen.getByTestId('person-more')).toBeTruthy();
    // The row under the name is as it was.
    expect(screen.getByTestId('person-add')).toBeTruthy();
    expect(screen.getByTestId('person-message')).toBeTruthy();
  });

  it('is not there until the row has scrolled away, and goes when the row is back', async () => {
    await show();
    layRow();
    expect(screen.queryByTestId('person-top-add')).toBeNull();
    scrollTo(300);
    // At the row's foot is not past it.
    expect(screen.queryByTestId('person-top-add')).toBeNull();
    scrollTo(301);
    const top = screen.getByTestId('person-top-add');
    expect(top.textContent).toBe('Add friend');
    // The chip's 32, where the row's is 44.
    expect(viewStyleOf(top.firstElementChild!.firstElementChild as HTMLElement).minHeight).toBe(32);
    expect(viewStyleOf(screen.getByTestId('person-add').firstElementChild!.firstElementChild as HTMLElement).minHeight).toBe(44);
    // Before the ⋯, in the header.
    expect(top.compareDocumentPosition(screen.getByTestId('person-more')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    scrollTo(120);
    expect(screen.queryByTestId('person-top-add')).toBeNull();
  });

  // Before the row is laid out there is no foot to be past.
  it('waits for the row to be laid out', async () => {
    await show();
    scrollTo(900);
    expect(screen.queryByTestId('person-top-add')).toBeNull();
  });

  it('sends the request, and then says nothing: a fact is not worth the header', async () => {
    await show();
    layRow();
    scrollTo(500);
    await act(async () => { fireEvent.click(screen.getByTestId('person-top-add')); });
    expect(data.sendFriendRequest).toHaveBeenCalledExactlyOnceWith('me-id', 'lan-id');
    // One pledge, both buttons: the row says Requested, the header nothing.
    expect(screen.getByTestId('person-requested')).toBeTruthy();
    expect(screen.queryByTestId('person-top-add')).toBeNull();
    expect(screen.queryByTestId('person-top-requested')).toBeNull();
  });

  it('offers Accept there to somebody who asked, and nothing for a friend', async () => {
    crew.ships.data = [edge('lan-id', 'me-id', 'pending')];
    await show();
    layRow();
    scrollTo(500);
    expect(screen.getByTestId('person-top-accept').textContent).toBe('Accept');
    cleanup();
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    await show();
    layRow();
    scrollTo(500);
    expect(screen.queryByTestId('person-top-friends')).toBeNull();
    expect(screen.queryByTestId('person-top-add')).toBeNull();
  });

  // The tab bar still ducks: every scroll is passed on to it.
  it('still passes every scroll to the tab bar', async () => {
    await show();
    duck.mockClear();
    scrollTo(40);
    scrollTo(80);
    expect(duck).toHaveBeenCalledTimes(2);
  });
});

describe('the friend button', () => {
  const edge = (requester: string, addressee: string, status: 'pending' | 'accepted'): FriendshipRow =>
    ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z', responded_at: null }) as FriendshipRow;

  it('offers Add friend to a stranger and sends the request as the reader', async () => {
    await show();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add friend' })); });
    expect(data.sendFriendRequest).toHaveBeenCalledExactlyOnceWith('me-id', 'lan-id');
    expect(screen.getByTestId('person-requested').textContent).toBe('Requested');
  });

  // The page's one act, at the button scale's 44 and in Edit profile's
  // dress; a row of people keeps the 32 (owner, 16 Nov 2026).
  it('draws Add friend at 44 on the page, on the card’s surface', async () => {
    await show();
    const add = screen.getByTestId('person-add').firstElementChild!.firstElementChild as HTMLElement;
    expect(viewStyleOf(add)).toMatchObject({
      minHeight: 44, backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    });
  });

  // What already stands is a fact: grey words and a mark, no pill, and
  // nothing to press. A clock while it waits, a tick once it is so.
  it('says Requested and Friends as words with a mark, not as pills', async () => {
    crew.ships.data = [edge('me-id', 'lan-id', 'pending')];
    await show();
    const waiting = screen.getByTestId('person-requested');
    expect(waiting.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('time-outline');
    expect([viewStyleOf(waiting).borderWidth, viewStyleOf(waiting).backgroundColor]).toEqual([undefined, undefined]);
    expect(viewStyleOf(waiting).minHeight).toBe(44);
    expect(waiting.closest('[role="button"]')).toBeNull();
    cleanup();
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    await show();
    const friends = screen.getByTestId('person-friends');
    expect(friends.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('checkmark');
    expect(friends.textContent).toBe('Friends');
  });

  // The line that counts their lists counts only that. Until 16 Nov 2026
  // it also said, to a friend, how many places the two both save; that is
  // the "In common" section now.
  it('says Friends for a friend, and the count line says nothing of the two of you', async () => {
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    crew.mutual = { 'lan-id': 4 };
    await show();
    expect(screen.getByTestId('person-friends').textContent).toBe('Friends');
  });

  it('offers Accept to somebody who asked, and accepts their request', async () => {
    crew.ships.data = [edge('lan-id', 'me-id', 'pending')];
    await show();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })); });
    expect(data.acceptFriendRequest).toHaveBeenCalledExactlyOnceWith('lan-id', 'me-id');
  });

  it('has none on your own page, across a block, or signed out', async () => {
    state.people = { lan: { ...LAN, id: 'me-id' } };
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    cleanup();
    state.people = { lan: LAN };
    crew.blocks.data = ['lan-id'];
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    cleanup();
    crew.blocks.data = [];
    state.me = null;
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    // The page itself is still theirs.
    expect(screen.getByTestId('person-handle').textContent).toBe('@lan');
  });
});

// The ⋯ in the header (16 Nov 2026): report the person, block them, or
// take a block back. The block stood in a sheet on a list's page until
// that day, behind the author's face — which opens this page now.
// What the reader and this person have in common (owner, 16 Nov 2026):
// the places both keep in public collections, and the public collections
// both liked. For anybody signed in, a friend or not.
describe('in common', () => {
  const banh = { slug: 'banh', name_en: 'Banh', name_vi: 'Bánh', name_ja: null, photo_uri: 'https://p/banh.jpg' };
  const oc = { slug: 'oc', name_en: 'Snails', name_vi: 'Ốc', name_ja: null, photo_uri: null };
  const names = (testID: string) => screen.getAllByTestId(testID).map((x) => x.textContent);

  // Hidden, not removed (owner, 16 Nov 2026): as shipped the section is
  // not mounted, so it draws nothing and asks the database nothing —
  // even for two people with plenty in common.
  it('is switched off as shipped: nothing drawn, nothing asked', async () => {
    const real = await vi.importActual<typeof import('../lib/person')>('../lib/person');
    expect(real.IN_COMMON_ON).toBe(false);
    state.inCommonOn = real.IN_COMMON_ON;
    state.common = { places: [banh, oc], lists: ['minh-list'] };
    state.shelf = [list('minh-list', { owner_id: 'minh-id' }), list('new')];
    await show();
    expect(screen.queryByTestId('person-in-common')).toBeNull();
    expect(screen.queryByText('In common')).toBeNull();
    expect(state.commonAsked).toEqual([]);
    // The rest of the page is as it was.
    expect(screen.getAllByTestId('person-list')).toHaveLength(1);
  });

  it('asks about this person, as the reader', async () => {
    await show();
    expect(state.commonAsked.at(-1)).toEqual(['me-id', 'lan-id']);
  });

  it('draws nothing where nothing is shared', async () => {
    await show();
    expect(screen.queryByTestId('person-in-common')).toBeNull();
    expect(screen.queryByText('In common')).toBeNull();
  });

  it('lists the places both keep, each with its own name and photograph, above their collections', async () => {
    state.common = { places: [banh, oc], lists: [] };
    state.shelf = [list('new')];
    await show();
    const section = screen.getByTestId('person-in-common');
    expect(within(section).getByText('In common')).toBeTruthy();
    expect(within(section).getByText('Places you both keep')).toBeTruthy();
    expect(names('common-place')).toEqual(['Banh', 'Snails']);
    const [first, second] = screen.getAllByTestId('common-place');
    expect(first.querySelector('img')!.getAttribute('src')).toBe('https://p/banh.jpg');
    // No photograph: the tint, not a hole.
    expect(second.querySelector('img')).toBeNull();
    // One kind alone draws that row alone.
    expect(screen.queryByTestId('common-lists')).toBeNull();
    expect(within(section).queryByText('Collections you both liked')).toBeNull();
    // Between the head and the person's own collections.
    const head = screen.getByTestId('person-handle');
    const own = screen.getByTestId('person-list');
    expect(head.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(own) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names a place in the reader’s language and opens it by its slug', async () => {
    state.common = { places: [banh, oc], lists: [] };
    state.lang = 'vi';
    const navigation = await show();
    expect(names('common-place')).toEqual(['Bánh', 'Ốc']);
    expect(screen.getByText('Điểm chung')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('common-place')[1]);
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('PlaceDetail', { slug: 'oc' });
  });

  it('lists the collections both liked from the shelf, in the order answered, and opens one', async () => {
    state.common = { places: [], lists: ['desk-eats', 'minh-list'] };
    state.shelf = [
      list('minh-list', { owner_id: 'minh-id', cover: { photo_uri: 'https://covers/minh.jpg' } }),
      list('desk-eats', { owner_id: null }),
    ];
    const navigation = await show();
    expect(screen.getByText('Collections you both liked')).toBeTruthy();
    expect(names('common-list')).toEqual(['List desk-eats', 'List minh-list']);
    expect(screen.getAllByTestId('common-list')[1].querySelector('img')!.getAttribute('src')).toBe('https://covers/minh.jpg');
    expect(screen.queryByTestId('common-places')).toBeNull();
    // Somebody else's list is in common without being this person's own.
    expect(screen.queryAllByTestId('person-list')).toEqual([]);
    fireEvent.click(screen.getAllByTestId('common-list')[0]);
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionDetail', { slug: 'desk-eats' });
  });

  // A slug the shelf does not hold is a list this reader cannot open.
  it('leaves out a liked list the shelf does not hold, and the section with it when that was all', async () => {
    state.common = { places: [], lists: ['gone'] };
    await show();
    expect(screen.queryByTestId('person-in-common')).toBeNull();
    cleanup();
    state.common = { places: [banh], lists: ['gone', 'kept'] };
    state.shelf = [list('kept', { owner_id: 'minh-id' })];
    await show();
    expect(names('common-list')).toEqual(['List kept']);
    // Both rows: the second label stands off the first row.
    expect(names('common-place')).toEqual(['Banh']);
  });

  // Five of each at most (owner, 16 Nov 2026): the first pair it was
  // tried on had thirty collections liked in common, a strip of thirty
  // tiles above the collections the page is about.
  it('shows the first five of each kind, in the order answered', async () => {
    const many = Array.from({ length: 8 }, (_, i) => `l${i}`);
    state.common = {
      places: Array.from({ length: 7 }, (_, i) => ({ ...banh, slug: `p${i}`, name_en: `Place ${i}` })),
      // One the shelf does not hold, among the first five answered: it
      // does not use up a place in the row.
      lists: ['gone', ...many],
    };
    state.shelf = many.map((slug) => list(slug, { owner_id: 'minh-id' }));
    await show();
    expect(names('common-place')).toEqual(['Place 0', 'Place 1', 'Place 2', 'Place 3', 'Place 4']);
    expect(names('common-list')).toEqual(['List l0', 'List l1', 'List l2', 'List l3', 'List l4']);
    // A row that was cut says what its five are: the database answers the
    // most recent first.
    expect(screen.getByTestId('common-places-label').textContent).toBe('Places you both keep · 5 most recent');
    expect(screen.getByTestId('common-lists-label').textContent).toBe('Collections you both liked · 5 most recent');
    cleanup();
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('common-places-label').textContent).toBe('Địa điểm cả hai cùng lưu · 5 gần đây nhất');
    expect(screen.getByTestId('common-lists-label').textContent).toBe('Bộ sưu tập cùng thích · 5 gần đây nhất');
  });

  // "Most recent" of five is the five: a row that shows all there is says
  // nothing more than its name. Counted after the shelf is consulted — a
  // sixth the reader cannot open is not a sixth.
  it('says nothing of recency on a row that was not cut', async () => {
    state.common = {
      places: Array.from({ length: 5 }, (_, i) => ({ ...banh, slug: `p${i}`, name_en: `Place ${i}` })),
      lists: ['l0', 'l1', 'l2', 'l3', 'l4', 'gone'],
    };
    state.shelf = ['l0', 'l1', 'l2', 'l3', 'l4'].map((slug) => list(slug, { owner_id: 'minh-id' }));
    await show();
    expect(screen.getByTestId('common-places-label').textContent).toBe('Places you both keep');
    expect(screen.getByTestId('common-lists-label').textContent).toBe('Collections you both liked');
  });

  it('shows it to somebody who is not a friend, and asks nothing signed out or on your own page', async () => {
    state.common = { places: [banh], lists: [] };
    await show();
    expect(screen.getByRole('button', { name: 'Add friend' })).toBeTruthy();
    expect(screen.getByTestId('person-in-common')).toBeTruthy();
    cleanup();
    state.me = null;
    await show();
    expect(state.commonAsked.at(-1)).toEqual([null, 'lan-id']);
    cleanup();
    state.me = 'me-id';
    state.people = { lan: { ...LAN, id: 'me-id' } };
    await show();
    expect(state.commonAsked.at(-1)).toEqual(['me-id', 'me-id']);
  });
});

describe('the ⋯', () => {
  /** Press a row of the open sheet; the sheet closes, then the row acts. */
  const pick = (testID: string) => {
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId(testID));
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
  };
  const pressInAlert = (text: string) => alert.mock.calls.at(-1)![2]!.find((b) => b.text === text)!.onPress!();
  const open = () => fireEvent.click(screen.getByTestId('person-more'));

  // On the title's line, as the way back is: the header's own 44pt
  // button, bare, hung past the margin by the glyph's empty edge. It was
  // a bare 22pt glyph for a morning and stood a row above "Profile"
  // (owner's phone, 16 Nov 2026).
  it('stands in the header’s own 44pt box, bare, hung to the margin like Crew’s', async () => {
    await show();
    const boxed = (el: HTMLElement) => [el, ...el.querySelectorAll('*')]
      .some((n) => getComputedStyle(n as HTMLElement).width === '44px');
    const more = screen.getByTestId('person-more');
    expect(boxed(more)).toBe(true);
    // The same box the way back stands in.
    expect(boxed(screen.getByTestId('person-back'))).toBe(true);
    expect(more.getAttribute('aria-label')).toBe('More');
    const margins: string[] = [];
    for (let n: HTMLElement | null = more; n && margins.length < 6; n = n.parentElement) {
      margins.push(getComputedStyle(n).marginRight);
    }
    expect(margins).toContain('-13px');
  });

  it('names who it is about and offers a report and a block', async () => {
    await show();
    expect(screen.queryByTestId('person-menu-block')).toBeNull();
    open();
    // The sheet is headed by the name, the handle under it with its `@`.
    // Each said twice now: on the page's head, and on the sheet's.
    expect(screen.getAllByText('Lan Phạm').length).toBe(2);
    expect(screen.getAllByText('@lan').length).toBe(2);
    expect(screen.getByTestId('person-menu-report')).toBeTruthy();
    expect(screen.getByTestId('person-menu-block').textContent).toContain('Block @lan');
    expect(screen.queryByTestId('person-menu-unblock')).toBeNull();
  });

  it('heads the sheet with the handle alone for somebody with no name', async () => {
    state.people = { lan: { ...LAN, full_name: '', avatar_url: '' } };
    await show();
    // Once before the sheet (the page's head), once more on it — and no
    // name line under either.
    expect(screen.getAllByText('@lan')).toHaveLength(1);
    open();
    expect(screen.getAllByText('@lan')).toHaveLength(2);
  });

  it('hands the desk the person, not a list', async () => {
    await show();
    open();
    pick('person-menu-report');
    expect(data.report).toHaveBeenCalledExactlyOnceWith({
      kind: 'profile', id: 'lan-id', name: 'Lan Phạm', avatarUrl: 'https://faces/lan.jpg',
    });
    cleanup();
    data.report.mockClear();
    state.people = { lan: { ...LAN, full_name: '', avatar_url: '' } };
    await show();
    open();
    pick('person-menu-report');
    expect(data.report).toHaveBeenCalledExactlyOnceWith({ kind: 'profile', id: 'lan-id', name: '@lan', avatarUrl: undefined });
  });

  it('blocks only after the confirmation, then reads the crew and the blocks again', async () => {
    await show();
    open();
    pick('person-menu-block');
    expect(alert.mock.calls.at(-1)![0]).toBe('Block @lan?');
    expect(alert.mock.calls.at(-1)![2]!.map((b) => b.text)).toEqual(['Cancel', 'Block']);
    expect(data.blockUser).not.toHaveBeenCalled();
    await act(async () => { pressInAlert('Block'); });
    expect(data.blockUser).toHaveBeenCalledExactlyOnceWith('lan-id');
    // A block also ends a friendship, so both are read again.
    expect(crew.ships.reload).toHaveBeenCalledTimes(1);
    expect(crew.blocks.reload).toHaveBeenCalledTimes(1);
  });

  it('says so when the block fails, and reads nothing again', async () => {
    data.blockUser.mockImplementation(async () => { throw new Error('nope'); });
    await show();
    open();
    pick('person-menu-block');
    await act(async () => { pressInAlert('Block'); });
    expect(alert.mock.calls.at(-1)![0]).toBe('Could not block');
    expect(crew.blocks.reload).not.toHaveBeenCalled();
  });

  it('offers to take a block back in place of making one, as the reader', async () => {
    crew.blocks.data = ['lan-id'];
    await show();
    open();
    expect(screen.queryByTestId('person-menu-block')).toBeNull();
    pick('person-menu-unblock');
    expect(alert.mock.calls.at(-1)![0]).toBe('Unblock @lan?');
    expect(data.unblockUser).not.toHaveBeenCalled();
    await act(async () => { pressInAlert('Unblock'); });
    expect(data.unblockUser).toHaveBeenCalledExactlyOnceWith('me-id', 'lan-id');
    expect(crew.blocks.reload).toHaveBeenCalledTimes(1);
    expect(data.blockUser).not.toHaveBeenCalled();
  });

  it('says so when taking it back fails', async () => {
    crew.blocks.data = ['lan-id'];
    data.unblockUser.mockImplementation(async () => { throw new Error('nope'); });
    await show();
    open();
    pick('person-menu-unblock');
    await act(async () => { pressInAlert('Unblock'); });
    expect(alert.mock.calls.at(-1)![0]).toBe('Could not unblock');
    expect(crew.blocks.reload).not.toHaveBeenCalled();
  });

  it('is not there on your own page, signed out, or with nobody to show', async () => {
    state.people = { lan: { ...LAN, id: 'me-id' } };
    await show();
    expect(screen.queryByTestId('person-more')).toBeNull();
    cleanup();
    state.people = { lan: LAN };
    state.me = null;
    await show();
    expect(screen.queryByTestId('person-more')).toBeNull();
    cleanup();
    state.me = 'me-id';
    state.people = {};
    await show('ghost');
    expect(screen.queryByTestId('person-more')).toBeNull();
  });

  it('closes when dismissed', async () => {
    await show();
    open();
    fireEvent.click(screen.getAllByLabelText('Close').at(-1)!);
    await flush();
    expect(screen.getByTestId('person-more')).toBeTruthy();
  });
});

describe('when there is nobody to show', () => {
  it('turns while the profile is on its way', async () => {
    state.people = {};
    state.lookup = { loading: true, error: null, reload: vi.fn() };
    await show();
    expect(screen.getByTestId('person-loading')).toBeTruthy();
    expect(screen.queryByTestId('person-missing')).toBeNull();
  });

  it('says it could not load, and asks again', async () => {
    state.people = {};
    state.lookup = { loading: false, error: 'timeout', reload: vi.fn() };
    await show();
    expect(screen.getByTestId('person-failed')).toBeTruthy();
    fireEvent.click(screen.getByTestId('person-retry'));
    expect(state.lookup.reload).toHaveBeenCalledTimes(1);
  });

  it('says nobody is here for a handle no profile answers to, or none at all', async () => {
    state.people = {};
    await show('ghost');
    expect(screen.getByTestId('person-missing')).toBeTruthy();
    expect(screen.queryByTestId('person-cover')).toBeNull();
    cleanup();
    state.asked = [];
    await show('@');
    expect(screen.getByTestId('person-missing')).toBeTruthy();
    // Nothing to ask about: no lookup by an empty handle.
    expect(state.asked.every((h) => h === null)).toBe(true);
  });
});
