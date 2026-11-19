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
import { Image } from 'expo-image';
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
  fresh: 0,
  roleAsked: [] as [string | null, string | null][],
  lang: 'en' as 'en' | 'vi',
  scheme: 'dark' as 'dark' | 'light',
  myBio: '',
  myLikes: [] as string[],
  // The reader's own library, the lists lent to them and who their own
  // are shared with — and for whom each of the last two was asked.
  mine: [] as unknown[],
  lent: [] as unknown[],
  lentAsked: [] as (string | null | undefined)[],
  myShares: [] as { collection_id: string; user_id: string; created_at: string }[],
  sharesAsked: [] as (string | null | undefined)[],
}));
vi.mock('../lib/auth', () => ({
  useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }),
  // The reader's own profile, as the form saves it: the bio is what the
  // page reads of it.
  useProfile: () => ({ profile: { bio: state.myBio } }),
}));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: state.shelf, loading: false, reload: () => {} }),
  usePlaces: () => ({ data: state.places, loading: false, reload: () => {} }),
  useLikes: () => ({ likes: state.likes, myLikes: state.myLikes, toggleLike: spies.toggleLike }),
}));
// The heart's two ways out: the like, and the invitation to sign in.
const spies = vi.hoisted(() => ({ toggleLike: vi.fn(async () => {}), askToSignIn: vi.fn() }));
// The way out to another tab. `tabs` is the navigator above the page's
// own stack, which a test takes away to read the page with none; `goTo`
// is the container's, the way a page with no parent has.
const out = vi.hoisted(() => ({ tabs: { navigate: vi.fn() } as { navigate: ReturnType<typeof vi.fn> } | undefined, goTo: vi.fn() }));
vi.mock('../nav', async (orig) => ({ ...(await orig<typeof import('../nav')>()), goTo: out.goTo }));
vi.mock('../lib/save', () => ({
  useSaveActions: () => ({ askToSignIn: spies.askToSignIn }),
  useMyLists: () => ({ data: state.mine, loading: false, reload: () => {} }),
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
  useSharedWithMe: (reader: string | null | undefined) => {
    state.lentAsked.push(reader);
    return { data: reader ? state.lent : [], loading: false, reload: () => {} };
  },
  useMyListShares: (owner: string | null | undefined) => {
    state.sharesAsked.push(owner);
    return { data: owner ? state.myShares : [], loading: false, reload: () => {} };
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
vi.mock('../lib/freshNews', () => ({ useFreshNews: () => ({ fresh: state.fresh }) }));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => duck }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: state.scheme }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

// What only you see on your own page has its own tests (`Counts` in the
// account's, `Requests` beside it); here, only where it stands.
vi.mock('./profile/Counts', () => ({ Counts: () => <div data-testid="owner-counts" /> }));
vi.mock('./person/Requests', () => ({
  Requests: ({ onOpen }: { onOpen: () => void }) => <button type="button" data-testid="owner-requests" onClick={onOpen} />,
}));

import PersonScreen from './PersonScreen';
import { spokenTab } from '../components/FloatingTabBar';

const LAN: Who = { id: 'lan-id', handle: 'lan', full_name: 'Lan Phạm', avatar_url: 'https://faces/lan.jpg', bio: 'Coffee first, then the rest.' };

const list = (slug: string, over: Partial<Collection> = {}): Collection => ({
  id: slug, slug, title_en: `List ${slug}`, title_vi: `Bộ ${slug}`, title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null, curator_handle: '@lan', cover: null,
  owner_id: 'lan-id', is_public: true, city_id: 'hanoi', collection_places: [],
  ...over,
} as Collection);

const members = (n: number) => Array.from({ length: n }, (_, i) => ({ sort_order: i, places: { slug: `p${i}` } }));

const flush = async () => { await act(async () => {}); };
/** The feed's cards. The page had a grid of tiles too, a press of the
 *  heading's count away, from 17 to 19 Nov 2026; the cards are all there
 *  is now, so what was asked of a tile is asked of a card. */
const cards = (): HTMLElement[] => screen.queryAllByTestId('person-act');
/** What each card says it opens: "List one, 0 places". */
const opens = (): (string | null)[] => cards().map((c) => within(c).getByTestId('activity-open').getAttribute('aria-label'));
/** What the page listens for on the navigator, so a test can say the
 *  page was left and come back to. */
const heard: Record<string, (() => void)[]> = {};
const said = (event: 'blur' | 'focus') => act(() => { (heard[event] ?? []).forEach((fn) => fn()); });
const show = async (handle = 'lan', home?: boolean, routeNames?: string[]) => {
  const navigation = {
    goBack: vi.fn(), navigate: vi.fn(), getParent: () => out.tabs,
    getState: () => (routeNames ? { routeNames } : undefined),
    addListener: vi.fn((event: string, fn: () => void) => {
      (heard[event] ??= []).push(fn);
      return () => { heard[event] = heard[event].filter((f) => f !== fn); };
    }),
  };
  render(<PersonScreen navigation={navigation as unknown as Nav} route={{ params: { handle } } as RootRoute<'Person'>} home={home} />);
  await flush();
  return navigation;
};

beforeEach(() => {
  out.tabs = { navigate: vi.fn() };
  out.goTo.mockClear();
  state.me = 'me-id';
  state.people = { lan: LAN };
  state.asked = [];
  state.lookup = { loading: false, error: null, reload: vi.fn() };
  state.shelf = [];
  state.places = [];
  state.likes = {};
  state.myLikes = [];
  state.mine = [];
  state.lent = [];
  state.lentAsked = [];
  state.myShares = [];
  state.sharesAsked = [];
  spies.toggleLike.mockClear();
  spies.askToSignIn.mockClear();
  state.common = { places: [], lists: [] };
  state.commonAsked = [];
  state.inCommonOn = true;
  state.topFriendOn = true;
  state.role = null;
  state.fresh = 0;
  state.roleAsked = [];
  state.lang = 'en';
  state.scheme = 'dark';
  state.myBio = '';
  for (const k of Object.keys(heard)) delete heard[k];
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
    // The name stands in a row of its own, which a role's mark shares
    // when there is one (`the mark of a role`, below).
    const named = screen.getByTestId('role-row');
    expect(named.contains(name)).toBe(true);
    const column = named.parentElement!;
    expect([...column.children]).toEqual([named, handle, screen.getByTestId('person-bio-row')]);
    expect(column.parentElement).toBe(row);
    expect(viewStyleOf(column).flexDirection).not.toBe('row');
    // The column takes the row's width beside the picture.
    expect(viewStyleOf(column).flex).toBe(1);
  });

  // "11 collections" stood under the head until 16 Nov 2026. From 17 Nov
  // the one count was on the section's heading, the way to its grid; on
  // 19 Nov the grid went and the count with it.
  it('counts nothing: not under the head, and not on the heading', async () => {
    state.shelf = [list('one'), list('two')];
    await show();
    expect(screen.queryByTestId('person-counts')).toBeNull();
    expect(screen.queryByText(/^\d+ collections?$/)).toBeNull();
    expect(cards()).toHaveLength(2);
  });

  it('wears their face, not the reader’s, ringed in the page’s own ground', async () => {
    await show();
    const face = screen.getByTestId('person-cover').nextElementSibling!.firstElementChild as HTMLElement;
    expect(face.querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
    expect(viewStyleOf(face)).toMatchObject({ borderWidth: 4, borderColor: bgHex.dark });
    // 80 since 19 Nov 2026, from 88, under a cover of 170, from 148
    // (owner, after an outside review).
    expect(viewStyleOf(face.querySelector('img')!)).toMatchObject({ width: 80, height: 80 });
    expect(viewStyleOf(screen.getByTestId('person-cover').firstElementChild!)).toMatchObject({ height: 170 });
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
    // Alone in its column, begun just under the cover's edge.
    const named = screen.getByTestId('role-row');
    expect(named.contains(handle)).toBe(true);
    expect([...named.parentElement!.children]).toEqual([named]);
    expect(viewStyleOf(named.parentElement!)).toMatchObject({ flex: 1, marginTop: 32 });
    expect(screen.getAllByText('@lan')).toHaveLength(1);
    expect(screen.queryByTestId('person-name')).toBeNull();
    expect(screen.queryByTestId('person-bio')).toBeNull();
    // And no invitation to write one: it is not the reader's to write.
    expect(screen.queryByTestId('person-bio-add')).toBeNull();
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
// Your own page with no bio offers the way to write one (owner, 16 Nov
// 2026): 4 of the 16 people with a public list had a bio, and this is
// the page a visitor meets. Nobody else is ever offered it.
describe('the bio, and the way to write one', () => {
  const mine = (over: Partial<Who> = {}) => {
    state.me = LAN.id;
    state.people = { lan: { ...LAN, ...over } };
  };

  it('offers "Write a few words about you" on your own page when you have written none, where the bio would stand', async () => {
    mine({ bio: null });
    const navigation = await show();
    const add = screen.getByTestId('person-bio-add');
    expect(add.getAttribute('role')).toBe('button');
    expect(add.textContent).toBe('Write a few words about you');
    expect(screen.queryByTestId('person-bio')).toBeNull();
    // Under the head, as the bio is: the row after the picture and names.
    expect(add.compareDocumentPosition(screen.getByTestId('person-handle')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    // A plus and the words, both in the accent: the colour of what a tap
    // changes, as "Add a description" wears it on a list's card.
    const plus = add.querySelector('[data-icon="add"]')!;
    expect([plus.getAttribute('data-size'), plus.getAttribute('data-color')]).toEqual(['18', String(colors.accent)]);
    expect(textStyleOf(screen.getByText('Write a few words about you'))).toMatchObject({ color: colors.accent, fontSize: 14 });
    // It opens the profile's form with the cursor in the bio.
    fireEvent.click(add);
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile', { focus: 'bio' });
  });

  it('says it in Vietnamese, in the Profile tab’s own words', async () => {
    mine({ bio: '' });
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('person-bio-add').textContent).toBe('Viết đôi dòng về bạn');
    // And the page is "Trang cá nhân" — the name for the page a person
    // shows the world; "Hồ sơ" until 17 Nov 2026.
    expect(screen.getByText('Trang cá nhân')).toBeTruthy();
    expect(screen.queryByText('Hồ sơ')).toBeNull();
    // The way out on the heading wears the tab's own word. It read "Hồ
    // sơ" for an hour on 19 Nov 2026, which this line is here to notice.
    expect(screen.getByTestId('person-account').textContent).toBe('Tài khoản');
  });

  it('draws your bio and no invitation once you have one', async () => {
    mine();
    await show();
    expect(screen.getByTestId('person-bio').textContent).toBe('Coffee first, then the rest.');
    expect(screen.queryByTestId('person-bio-add')).toBeNull();
  });

  // How it stands (owner, 17 Nov 2026), after the owner's reference: a
  // speech bubble under the handle, beside the picture, with a tail
  // toward the face.
  it('draws the bio as a speech bubble under the handle, beside the picture, its tail toward the face', async () => {
    await show();
    const bubble = screen.getByTestId('person-bio-row');
    const bio = screen.getByTestId('person-bio');
    const handle = screen.getByTestId('person-handle');
    expect(bubble.textContent).toBe('Coffee first, then the rest.');
    expect(bubble.querySelector('[data-icon]')).toBeNull();
    // In the names' column, the line after the handle: beside the
    // picture, not under it.
    expect(bubble.parentElement).toBe(handle.parentElement);
    expect(handle.nextElementSibling).toBe(bubble);
    const row = screen.getByTestId('person-cover').nextElementSibling as HTMLElement;
    expect(row.contains(bubble)).toBe(true);
    // The picture hangs lower so the bubble stands level with its foot:
    // the row starts at the top of the column, 28 of the picture on the
    // cover where it was 44.
    expect(viewStyleOf(row)).toMatchObject({ alignItems: 'flex-start', marginTop: -26 });
    const dress = viewStyleOf(bubble);
    // As wide as the words; a tinted well with no hairline.
    expect(dress.alignSelf).toBe('flex-start');
    expect(dress.backgroundColor).toBe(colors.surfaceGlassStrong);
    expect(dress.borderWidth).toBeUndefined();
    // Four corners the same: for an hour the upper left was tighter, and
    // read as one corner gone square.
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const) {
      expect(dress[corner]).toBeUndefined();
    }
    expect(dress.borderRadius).toBe(18);
    // The tail: a window left of the bubble's edge, about the first
    // line's middle, showing the corner of a turned square in the
    // bubble's own fill.
    const tail = screen.getByTestId('person-bio-tail');
    expect(tail.parentElement).toBe(bubble);
    const win = viewStyleOf(tail);
    expect(win).toMatchObject({ position: 'absolute', overflow: 'hidden' });
    // Outside the bubble but for the half point that closes the round
    // edge, so the two washes do not darken each other.
    const lap = Number(win.left) + Number(win.width);
    expect(lap).toBeGreaterThanOrEqual(0);
    expect(lap).toBeLessThan(0.5);
    // Centred on the first line's middle: 9 of padding and half of 21.
    expect(Number(win.top) + Number(win.height) / 2).toBe(9 + 21 / 2);
    const fill = viewStyleOf(tail.firstElementChild as HTMLElement);
    expect(fill.backgroundColor).toBe(dress.backgroundColor);
    expect(JSON.stringify(fill.transform)).toContain('-43deg');
    // The page's ink, slanted as the reference.
    expect(textStyleOf(bio)).toMatchObject({ color: colors.text, fontSize: 15, fontStyle: 'italic' });
  });

  // The form saves into your own profile; the page says the new words
  // at once, before it has read itself again.
  it('says the bio you have just saved, before the page has read itself again', async () => {
    mine({ bio: null });
    state.myBio = 'Weekends on a scooter.';
    await show();
    expect(screen.getByTestId('person-bio').textContent).toBe('Weekends on a scooter.');
    expect(screen.queryByTestId('person-bio-add')).toBeNull();
  });

  // The reader's own bio is the reader's: never under somebody else's
  // name, with or without one of their own there.
  it('never draws the reader’s bio, or the invitation, on somebody else’s page', async () => {
    state.myBio = 'Mine, not Lan’s.';
    state.people = { lan: { ...LAN, bio: null } };
    await show();
    expect(screen.queryByTestId('person-bio')).toBeNull();
    expect(screen.queryByTestId('person-bio-add')).toBeNull();
    cleanup();
    state.people = { lan: LAN };
    await show();
    expect(screen.getByTestId('person-bio').textContent).toBe('Coffee first, then the rest.');
  });

  it('offers nothing to somebody signed out', async () => {
    state.me = null;
    state.people = { lan: { ...LAN, bio: null } };
    await show();
    expect(screen.queryByTestId('person-bio-add')).toBeNull();
  });

  // The form changes the name and the picture as readily as the bio, so
  // your own page reads itself again when you come back to it — a blur,
  // then a focus — and not on arrival.
  it('reads your own page again when you come back to it, and not before', async () => {
    mine({ bio: null });
    await show();
    await said('focus');
    expect(state.lookup.reload).not.toHaveBeenCalled();
    await said('blur');
    expect(state.lookup.reload).not.toHaveBeenCalled();
    await said('focus');
    expect(state.lookup.reload).toHaveBeenCalledTimes(1);
    // Once a return, not once a focus after it.
    await said('focus');
    expect(state.lookup.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves somebody else’s page as it was fetched, and stops listening when it goes', async () => {
    await show();
    await said('blur');
    await said('focus');
    expect(state.lookup.reload).not.toHaveBeenCalled();
    cleanup();
    expect([heard.blur, heard.focus]).toEqual([[], []]);
  });
});

describe('the mark of a role', () => {
  const face = () => screen.getByTestId('person-cover').nextElementSibling!.firstElementChild as HTMLElement;

  it('wears no mark for a person with no role, and asks about this person as the reader', async () => {
    await show();
    expect(screen.queryByTestId('role-mark')).toBeNull();
    expect(screen.queryByTestId('role-badge')).toBeNull();
    // The row is there before the answer is, with the name in it.
    expect(screen.getByTestId('role-row').contains(screen.getByTestId('person-name'))).toBe(true);
    expect(new Set(state.roleAsked.map((a) => a.join('/')))).toEqual(new Set([`me-id/${LAN.id}`]));
  });

  it('draws a guide’s star after the name, named for VoiceOver, and not on the picture', async () => {
    state.role = 'guide';
    await show();
    const disc = screen.getByRole('img', { name: 'Local Guide' });
    expect(face().contains(disc)).toBe(false);
    expect(disc.querySelector('[data-icon="star"]')).toBeTruthy();
    // The name is not written on the page: the disc is a mark.
    expect(screen.queryByText('Local Guide')).toBeNull();
    // One row: the name, then the mark, in the middle of the name's line
    // — 28 here. The handle is under the row, not in it.
    const row = screen.getByTestId('role-row');
    const name = screen.getByTestId('person-name');
    expect(row.contains(name)).toBe(true);
    expect(row.contains(disc)).toBe(true);
    expect(name.compareDocumentPosition(disc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.contains(screen.getByTestId('person-handle'))).toBe(false);
    const mark = viewStyleOf(screen.getByTestId('role-mark'));
    expect([mark.height, mark.justifyContent, mark.position]).toEqual([28, 'center', undefined]);
    expect(textStyleOf(name)?.lineHeight).toBe(28);
    // The name still shrinks before it is cut, in the box that gives way.
    expect(viewStyleOf(row.firstElementChild!).flexShrink).toBe(1);
  });

  // Somebody who gave no name is called by their handle, in the name's
  // place and the name's type — and that is what the mark follows.
  it('follows the handle of a person with no name', async () => {
    state.role = 'guide';
    state.people = { lan: { ...LAN, full_name: '' } };
    await show();
    expect(screen.queryByTestId('person-name')).toBeNull();
    const row = screen.getByTestId('role-row');
    const handle = screen.getByTestId('person-handle');
    expect(handle.textContent).toBe('@lan');
    expect(row.contains(handle)).toBe(true);
    expect(textStyleOf(handle)?.fontSize).toBe(22);
    expect(row.contains(screen.getByRole('img', { name: 'Local Guide' }))).toBe(true);
    expect(screen.getAllByText('@lan')).toHaveLength(1);
  });

  // Pressed only by its holder (owner, 19 Nov 2026): on somebody
  // else's page the disc is a still mark — not a button to the eye or
  // to VoiceOver, and a tap opens nothing.
  it.each([
    ['guide', 'Local Guide', 'star'],
    ['editor', 'Super User', 'medal'],
  ] as const)('wears a %s’s mark on another’s page as a still mark that opens nothing', async (role, name, icon) => {
    state.role = role;
    await show();
    const disc = screen.getByRole('img', { name });
    expect(disc.querySelector(`[data-icon="${icon}"]`)).toBeTruthy();
    expect(disc.querySelectorAll('[data-icon]')).toHaveLength(1);
    expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByTestId('role-badge')).toBeNull();
    fireEvent.click(disc);
    expect(screen.queryByTestId('badge-sheet-head')).toBeNull();
    expect(screen.queryByTestId('badge-sheet-body')).toBeNull();
  });

  // The app's sheet, as the level's opens, on your own page.
  it('opens a sheet from your own mark: the disc and its name over what you may do', async () => {
    state.me = LAN.id;
    state.role = 'guide';
    await show();
    expect(screen.queryByTestId('role-disc')).toBeNull();
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
    // Closed by the backdrop, then the fade react-native-web runs.
    fireEvent.click(screen.getByLabelText('Close'));
    document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
    await waitFor(() => expect(screen.queryByTestId('badge-sheet-head')).toBeNull());
  });

  // Your own mark speaks to you (19 Nov 2026): it left the Account page,
  // where it always had, for your own page.
  it.each([
    ['guide', 'Local Guide', 'You can edit, and add photos to, places in your collections and places you imported.'],
    ['editor', 'Super User', 'You can edit, and add photos to, every place in the app — new or already listed.'],
  ] as const)('says what a %s may do to them on their own page', async (role, name, says) => {
    state.people = { ...state.people, me: { id: 'me-id', handle: 'me', full_name: 'Me', avatar_url: '' } };
    state.role = role;
    await show('me');
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByTestId('badge-sheet-body').textContent).toBe(says);
  });

  it('says it in Vietnamese', async () => {
    state.me = LAN.id;
    state.lang = 'vi';
    state.role = 'guide';
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('Bạn có thể chỉnh sửa và thêm ảnh cho các địa điểm trong bộ sưu tập của mình hoặc các địa điểm đã nhập.');
  });

  // Your own page wears your own mark. It said it as other people read
  // it until 19 Nov 2026, when your page was how others see you and the
  // Account page's name spoke to you; the name and its mark left Account
  // for this page that day (P3), so here it speaks to you — see the
  // `it.each` above for both roles' words.
  it('wears your own mark on your own page, asked of yourself', async () => {
    state.me = LAN.id;
    state.role = 'guide';
    await show();
    expect(state.roleAsked.at(-1)).toEqual([LAN.id, LAN.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    expect(screen.getByTestId('badge-sheet-body').textContent).toMatch(/^You can edit/);
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

// What they did, where the grid was (owner, 17 Nov 2026): one card a
// collection, headed by who did what and when. The first step of the
// plan that makes a collection the thing every interaction hangs on.
describe('what they did', () => {
  const NOW = Date.parse('2026-11-17T09:00:00Z');
  const daysBack = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
  const acts = () => screen.queryAllByTestId('person-act');
  const inCard = (i: number) => within(acts()[i]);

  beforeEach(() => { vi.useFakeTimers({ now: NOW, toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('opens on the feed: a card for each list they published, newest first, and no grid', async () => {
    state.shelf = [
      list('new', { collection_places: members(17) as Collection['collection_places'], created_at: daysBack(2), desc_en: 'Where the broth is.' }),
      list('minh-list', { owner_id: 'minh-id' }),
      list('hidden', { is_public: false }),
      list('old', { created_at: daysBack(3) }),
    ];
    await show();
    expect(screen.getByText('Activity')).toBeTruthy();
    expect(screen.queryByTestId('person-grid')).toBeNull();
    expect(acts()).toHaveLength(2);
    // Who did what, the name first.
    const line = inCard(0).getByTestId('activity-line');
    expect(line.textContent).toBe('Lan Phạm created a collection');
    // The name is its own run at the head of the sentence.
    expect(line.firstElementChild!.textContent).toBe('Lan Phạm');
    expect(inCard(0).getByTestId('activity-when').textContent).toBe('2 days ago');
    expect(inCard(1).getByTestId('activity-when').textContent).toBe('3 days ago');
    // The collection: its title, how much is on it, and what it is.
    expect(inCard(0).getByText('List new')).toBeTruthy();
    expect(inCard(0).getByText('17 places')).toBeTruthy();
    expect(inCard(0).getByTestId('activity-desc').textContent).toBe('Where the broth is.');
    expect(inCard(1).queryByTestId('activity-desc')).toBeNull();
    // Their face on each, the one the head wears.
    expect(acts()[0].querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
  });

  it('heads a card with the handle for somebody with no name, and says no time for a list with none', async () => {
    state.people = { lan: { ...LAN, full_name: '' } };
    state.shelf = [list('one')];
    await show();
    expect(inCard(0).getByTestId('activity-line').textContent).toBe('@lan created a collection');
    expect(inCard(0).queryByTestId('activity-when')).toBeNull();
  });

  it('says it in Vietnamese', async () => {
    state.lang = 'vi';
    state.shelf = [list('one', { created_at: daysBack(1), collection_places: members(1) as Collection['collection_places'] })];
    await show();
    expect(screen.getByText('Hoạt động')).toBeTruthy();
    expect(inCard(0).getByTestId('activity-line').textContent).toBe('Lan Phạm đã tạo bộ sưu tập');
    expect(inCard(0).getByTestId('activity-when').textContent).toBe('hôm qua');
    expect(inCard(0).getByText('1 địa điểm')).toBeTruthy();
  });

  it('wears the collection’s photograph, or the accent’s tint where it has none', async () => {
    state.shelf = [
      list('bare'),
      list('lit', { cover: { id: 'c1', photo_uri: 'https://covers/lit.jpg' } }),
    ];
    await show();
    expect(inCard(0).getByTestId('activity-tint')).toBeTruthy();
    expect(inCard(1).queryByTestId('activity-tint')).toBeNull();
    expect(inCard(1).getByTestId('activity-open').querySelector('img')!.getAttribute('src')).toBe('https://covers/lit.jpg');
  });

  it('opens the collection on a press of its photograph or its words', async () => {
    state.shelf = [list('one'), list('two')];
    const navigation = await show();
    fireEvent.click(inCard(1).getByTestId('activity-open'));
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionDetail', { slug: 'two' });
  });

  // The count on the heading's right turned the section into a grid of
  // every list, and back, until 19 Nov 2026. It went so that somebody
  // else's page and your own are one page: yours had lost it to
  // "Profile ›" that morning.
  it('is the feed and nothing else: no count on the heading, no grid to turn to', async () => {
    state.shelf = [list('one'), list('two'), list('three')];
    await show();
    expect(screen.getByText('Activity')).toBeTruthy();
    expect(screen.queryByTestId('person-turn')).toBeNull();
    expect(screen.queryByTestId('person-grid')).toBeNull();
    expect(screen.queryByText('Collections')).toBeNull();
    expect(screen.queryByText(/^\d+ collections?$/)).toBeNull();
    // Nor the way to an account that is not the reader's.
    expect(screen.queryByTestId('person-account')).toBeNull();
    expect(acts()).toHaveLength(3);
  });

  it('draws no card for somebody with nothing to show', async () => {
    await show();
    expect(screen.getByTestId('person-no-lists')).toBeTruthy();
    expect(screen.queryByTestId('person-turn')).toBeNull();
    expect(acts()).toEqual([]);
  });

  // Every card is a photograph the page's width, in a scroll view.
  it('draws five, and five more at each "Show more", until there are none to add', async () => {
    state.shelf = Array.from({ length: 12 }, (_, i) => list(`l${i}`));
    await show();
    expect(acts()).toHaveLength(5);
    fireEvent.click(screen.getByTestId('person-show-more'));
    expect(acts()).toHaveLength(10);
    fireEvent.click(screen.getByTestId('person-show-more'));
    expect(acts()).toHaveLength(12);
    expect(screen.queryByTestId('person-show-more')).toBeNull();
  });

  // A feed loads as you go (owner, 17 Nov 2026): five more before the
  // reader reaches the end of the five there are. A screen is 844 here,
  // so "near" is less than 1266 left under it.
  describe('as the reader scrolls', () => {
    const twelve = () => { state.shelf = Array.from({ length: 12 }, (_, i) => list(`l${i}`)); };

    it('adds nothing while the end is more than a screen and a half away', async () => {
      twelve();
      await show();
      // 5000 of page, 2890 left under the screen.
      scrollAt(1266, 5000);
      expect(acts()).toHaveLength(5);
    });

    it('adds five within a screen and a half of the end, with no press', async () => {
      twelve();
      await show();
      // 1265 left.
      scrollAt(2891, 5000);
      expect(acts()).toHaveLength(10);
    });

    // Sixty scroll events a second, every one of them still "near".
    it('adds once for each height the page has had, however many events arrive there', async () => {
      twelve();
      await show();
      scrollAt(2891, 5000);
      scrollAt(2950, 5000);
      scrollAt(3100, 5000);
      expect(acts()).toHaveLength(10);
      // The page grew with the five; near the end of that, the rest.
      scrollAt(5000, 6900);
      expect(acts()).toHaveLength(12);
      expect(screen.queryByTestId('person-show-more')).toBeNull();
      // And nothing past the last of them.
      scrollAt(6000, 7700);
      expect(acts()).toHaveLength(12);
    });

    it('keeps "Show more" under the last card for a reader who gets there first', async () => {
      twelve();
      await show();
      fireEvent.click(screen.getByTestId('person-show-more'));
      expect(acts()).toHaveLength(10);
      scrollAt(5000, 6900);
      expect(acts()).toHaveLength(12);
    });

    it('sends the next five covers into memory ahead of the cards, and none when there are no more', async () => {
      const prefetch = vi.mocked(Image.prefetch);
      prefetch.mockClear();
      state.shelf = Array.from({ length: 8 }, (_, i) => list(`l${i}`, i === 6 ? {} : { cover: { id: `c${i}`, photo_uri: `https://covers/${i}.jpg` } }));
      await show();
      // The sixth to the eighth; the seventh has no photograph to fetch.
      expect(prefetch).toHaveBeenCalledExactlyOnceWith(['https://covers/5.jpg', 'https://covers/7.jpg'], 'memory-disk');
      // The cards read from where they were put.
      expect(inCard(0).getByTestId('activity-open').querySelector('img')!.getAttribute('cachePolicy')).toBe('memory-disk');
      prefetch.mockClear();
      scrollAt(2891, 5000);
      expect(acts()).toHaveLength(8);
      expect(prefetch).not.toHaveBeenCalled();
    });
  });

  it('draws no "Show more" for five or fewer', async () => {
    state.shelf = Array.from({ length: 5 }, (_, i) => list(`l${i}`));
    await show();
    expect(acts()).toHaveLength(5);
    expect(screen.queryByTestId('person-show-more')).toBeNull();
  });

  describe('the heart', () => {
    const heart = (i: number) => inCard(i).getByTestId('activity-heart');

    it('likes the collection itself, through the provider the shelf uses', async () => {
      state.shelf = [list('one'), list('two')];
      await show();
      fireEvent.click(heart(1));
      expect(spies.toggleLike).toHaveBeenCalledExactlyOnceWith({ id: 'two', slug: 'two' });
      expect(spies.askToSignIn).not.toHaveBeenCalled();
    });

    it('is the invitation to sign in for a reader who has not', async () => {
      state.me = null;
      state.shelf = [list('one')];
      await show();
      fireEvent.click(heart(0));
      expect(spies.askToSignIn).toHaveBeenCalledExactlyOnceWith('like');
      expect(spies.toggleLike).not.toHaveBeenCalled();
    });

    it('is full, and offers to unlike, on a collection the reader liked; hollow on the rest', async () => {
      state.shelf = [list('mine'), list('not')];
      state.myLikes = ['mine'];
      await show();
      expect(heart(0).querySelector('[data-icon="heart"]')).toBeTruthy();
      expect(heart(0).getAttribute('aria-label')).toBe('Unlike this collection');
      expect(heart(1).querySelector('[data-icon="heart-outline"]')).toBeTruthy();
      expect(heart(1).getAttribute('aria-label')).toBe('Like this collection');
      // Two colours: the liked one is not the quiet one.
      expect(heart(0).querySelector('[data-icon]')!.getAttribute('data-color'))
        .not.toBe(heart(1).querySelector('[data-icon]')!.getAttribute('data-color'));
    });

    it('shows the tally from one like up, and none for a collection nobody has liked', async () => {
      state.shelf = [list('loved'), list('new')];
      state.likes = { loved: 4 };
      await show();
      expect(inCard(0).getByTestId('activity-likes').textContent).toBe('4');
      expect(inCard(1).queryByTestId('activity-likes')).toBeNull();
    });

    // A row from a launch cache written before ids were kept.
    it('draws none on a collection with no id to like', async () => {
      state.shelf = [list('cached', { id: undefined })];
      await show();
      expect(acts()).toHaveLength(1);
      expect(inCard(0).queryByTestId('activity-heart')).toBeNull();
    });
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
    await show();
    expect(opens()).toEqual(['List new, 17 places', 'List old, 0 places']);
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
  });

  // The page is one anybody can open: a private list is never on it,
  // even when the shelf it is handed holds one.
  it('never shows a private list', async () => {
    state.shelf = [list('secret', { is_public: false }), list('open')];
    await show();
    expect(opens()).toEqual(['List open, 0 places']);
  });

  it('says one of each in the singular, and titles a list in the reader’s language', async () => {
    state.shelf = [list('one', { collection_places: members(1) as Collection['collection_places'] })];
    await show();
    expect(opens()).toEqual(['List one, 1 place']);
    cleanup();
    state.lang = 'vi';
    await show();
    expect(opens()).toEqual(['Bộ one, 1 địa điểm']);
  });

  it('opens a list’s own page on a press', async () => {
    state.shelf = [list('new'), list('old')];
    const navigation = await show();
    fireEvent.click(within(cards()[1]).getByTestId('activity-open'));
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionDetail', { slug: 'old' });
  });

  it('says there are none yet, in a card, for somebody who has published nothing', async () => {
    state.shelf = [list('minh-list', { owner_id: 'minh-id' })];
    await show();
    expect(cards()).toEqual([]);
    expect(within(screen.getByTestId('person-no-lists')).getByText('No public collections yet')).toBeTruthy();
  });
});

// Since 17 Nov 2026 the page holds what this reader may open, not only
// what everybody may: all of your own on your own page, and on a
// friend's the lists they shared with you — each marked.
describe('lists that are not for everybody', () => {
  const ME: Who = { id: 'me-id', handle: 'me', full_name: 'Tuan Anh', avatar_url: 'https://faces/me.jpg' };
  const mineList = (slug: string, over: Partial<Collection> = {}) => list(slug, { owner_id: 'me-id', curator_handle: '@me', ...over });
  const share = (collection_id: string, user_id: string) => ({ collection_id, user_id, created_at: '2026-11-17T00:00:00Z' });
  const acts = () => screen.queryAllByTestId('person-act');
  const markIn = (card: HTMLElement) => within(card).queryByTestId('activity-mark');

  describe('on your own page', () => {
    beforeEach(() => {
      state.people = { me: ME, lan: LAN };
      const open = mineList('open', { created_at: '2026-11-01T00:00:00Z' });
      state.shelf = [open, list('lan-open')];
      state.mine = [
        mineList('noodles', { is_public: false, created_at: '2026-11-16T00:00:00Z' }),
        mineList('secret', { is_public: false, created_at: '2026-11-10T00:00:00Z' }),
        open,
      ];
      state.myShares = [share('noodles', 'lan-id'), share('noodles', 'minh-id'), share('open', 'lan-id')];
    });

    it('holds every list you made, the shared and the private with the public', async () => {
      await show('me');
      expect(acts().map((c) => within(c).getByTestId('activity-open').getAttribute('aria-label')))
        .toEqual(['List noodles, 0 places', 'List secret, 0 places', 'List open, 0 places']);
      // Nobody else's, though the shelf holds one.
      expect(screen.queryByText('List lan-open')).toBeNull();
    });

    it('marks the shared one with two heads and how many, the private with a padlock, and the public with the globe', async () => {
      await show('me');
      const [shared, secret, open] = acts();
      expect(markIn(shared)!.getAttribute('aria-label')).toBe('Friends, 2');
      // After the time, a dot between; the number is the mark's only word.
      expect(markIn(shared)!.textContent).toBe('·2');
      expect(markIn(secret)!.getAttribute('aria-label')).toBe('Private');
      expect(markIn(secret)!.textContent).toBe('·');
      expect(markIn(shared)!.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('people-outline');
      expect(markIn(secret)!.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('lock-closed-outline');
      // Shared with somebody and public is public: the globe, alone, as
      // under its handle on its own page (owner, 18 Nov 2026 — a public
      // card wore nothing for a day).
      expect(markIn(open)!.getAttribute('aria-label')).toBe('Public');
      expect(markIn(open)!.textContent).toBe('·');
      const globe = markIn(open)!.querySelector('[data-icon]')!;
      expect([globe.getAttribute('data-icon'), globe.getAttribute('data-size'), globe.getAttribute('data-color')])
        .toEqual(['globe-outline', '13', String(colors.textTertiary)]);
      expect(within(open).getByTestId('activity-when')).toBeTruthy();
    });

    // A list shared with friends is liked by them and by you; a private
    // one by nobody (`shares.likeable`).
    it('offers a heart on the public one and the shared one, and none on the private', async () => {
      await show('me');
      const [shared, secret, open] = acts();
      expect(within(secret).queryByTestId('activity-heart')).toBeNull();
      expect(within(secret).getByTestId('activity-no-heart')).toBeTruthy();
      expect(within(secret).queryByTestId('activity-likes-kept')).toBeNull();
      expect(within(open).getByTestId('activity-heart')).toBeTruthy();
      expect(within(open).queryByTestId('activity-no-heart')).toBeNull();
      fireEvent.click(within(shared).getByTestId('activity-heart'));
      expect(spies.toggleLike).toHaveBeenCalledExactlyOnceWith({ id: 'noodles', slug: 'noodles' });
    });

    // One heart, one size and one red on a card (owner, 18 Nov 2026):
    // it was 20 here and 15 on the list's page, and `bad` when liked.
    it('draws the heart at 18, in the secondary grey, and in the like’s own red once liked', async () => {
      state.myLikes = ['open'];
      await show('me');
      const [shared, , open] = acts();
      const worn = (card: HTMLElement) => {
        const g = within(card).getByTestId('activity-heart').querySelector('[data-icon]')!;
        return [g.getAttribute('data-icon'), g.getAttribute('data-size'), g.getAttribute('data-color')];
      };
      expect(worn(shared)).toEqual(['heart-outline', '18', String(colors.textSecondary)]);
      expect(worn(open)).toEqual(['heart', '18', String(colors.like)]);
      expect(colors.like).toBe(colors.accent);
    });

    it('shows the likes a private list kept as a figure, with nothing to press', async () => {
      state.likes = { secret: 4, noodles: 2 };
      await show('me');
      const [shared, secret] = acts();
      const kept = within(secret).getByTestId('activity-likes-kept');
      expect(kept.textContent).toBe('4');
      expect(kept.getAttribute('aria-label')).toBe('4 likes');
      expect(kept.getAttribute('role')).toBeNull();
      const glyph = kept.querySelector('[data-icon]')!;
      expect([glyph.getAttribute('data-icon'), glyph.getAttribute('data-size'), glyph.getAttribute('data-color')]).toEqual(['heart-outline', '18', String(colors.textTertiary)]);
      expect(within(secret).queryByTestId('activity-no-heart')).toBeNull();
      fireEvent.click(kept);
      expect(spies.toggleLike).not.toHaveBeenCalled();
      // The shared one's are on its heart.
      expect(within(shared).getByTestId('activity-likes').textContent).toBe('2');
      expect(within(shared).queryByTestId('activity-likes-kept')).toBeNull();
    });

    it('says one kept like in the singular, and says it in Vietnamese', async () => {
      state.likes = { secret: 1 };
      await show('me');
      expect(within(acts()[1]).getByTestId('activity-likes-kept').getAttribute('aria-label')).toBe('1 like');
      cleanup();
      state.lang = 'vi';
      state.likes = { secret: 4 };
      await show('me');
      expect(within(acts()[1]).getByTestId('activity-likes-kept').getAttribute('aria-label')).toBe('4 lượt thích');
    });

    it('draws the mark with no dot before it on a list that says no time', async () => {
      state.mine = [mineList('undated', { is_public: false })];
      state.shelf = [];
      await show('me');
      expect(within(acts()[0]).queryByTestId('activity-when')).toBeNull();
      expect(markIn(acts()[0])!.textContent).toBe('');
      expect(markIn(acts()[0])!.getAttribute('aria-label')).toBe('Private');
    });

    it('says the marks in Vietnamese', async () => {
      state.lang = 'vi';
      await show('me');
      expect(acts().map((c) => markIn(c)?.getAttribute('aria-label') ?? null)).toEqual(['Bạn bè, 2', 'Riêng tư', 'Công khai']);
    });

    // On the heading's right, where a count turned the section into a
    // grid until the same morning (owner, 19 Nov 2026): the page had no
    // way to what only you can do about it. To the Account tab's page —
    // not the form the profile is edited in, which it opened for an hour.
    // Account is a page over your own since 19 Nov 2026: from a page that
    // is not the tab's first, the tab, with Account over its first page.
    it('has the way to your account on the heading: the last tab, with Account over its first page', async () => {
      const navigation = await show('me');
      const link = screen.getByTestId('person-account');
      expect(link.textContent).toBe('Account');
      fireEvent.click(link);
      expect(out.tabs!.navigate).toHaveBeenCalledExactlyOnceWith('Profile', { screen: 'Account', initial: false });
      // Not a page pushed on this stack, and not the container's way
      // while there is a navigator to ask.
      expect(navigation.navigate).not.toHaveBeenCalled();
      expect(out.goTo).not.toHaveBeenCalled();
      // A way out of the page, not a turn of it: the feed is still here.
      expect(acts()).toHaveLength(3);
    });

    // With no navigator above the page, the container's way — now
    // `toProfileRoom`'s, tested with it in `nav.test.ts`.

    // It is not a way to your lists, so it does not wait for one.
    it('has it with no list to your name', async () => {
      state.mine = [];
      state.shelf = [];
      await show('me');
      expect(screen.getByTestId('person-no-lists')).toBeTruthy();
      expect(screen.getByTestId('person-account')).toBeTruthy();
    });

    // A cover off a private list would be a head only its owner sees.
    it('still takes the cover from a public list, though a private one is newer', async () => {
      state.mine = (state.mine as Collection[]).map((c) => ({
        ...c, cover: { photo_uri: `https://covers/${c.slug}.jpg` },
      })) as Collection[];
      state.shelf = [(state.mine as Collection[])[2]];
      await show('me');
      expect(screen.getByTestId('person-cover').querySelector('img')!.getAttribute('src')).toBe('https://covers/open.jpg');
    });

    it('wears the tint for a cover when every list you have is private', async () => {
      state.shelf = [];
      state.mine = [mineList('secret', { is_public: false, cover: { photo_uri: 'https://covers/secret.jpg' } } as Partial<Collection>)];
      await show('me');
      expect(screen.getByTestId('person-cover-tint')).toBeTruthy();
    });

    it('asks who your lists are shared with as you, and for nothing lent', async () => {
      await show('me');
      expect(state.sharesAsked.at(-1)).toBe('me-id');
      expect(state.lentAsked.at(-1)).toBeNull();
    });
  });

  describe('on somebody else’s page', () => {
    beforeEach(() => {
      state.shelf = [list('open', { created_at: '2026-11-01T00:00:00Z' })];
      state.lent = [
        list('for-me', { is_public: false, created_at: '2026-11-16T00:00:00Z' }),
        list('minh-for-me', { owner_id: 'minh-id', is_public: false, created_at: '2026-11-17T00:00:00Z' }),
      ];
      // The reader's own library and its shares are not this page's.
      state.mine = [list('my-secret', { owner_id: 'me-id', is_public: false })];
      state.myShares = [share('for-me', 'x'), share('my-secret', 'lan-id')];
    });

    it('holds the list they shared with you beside their public ones, and nobody else’s', async () => {
      await show();
      expect(acts().map((c) => within(c).getByTestId('activity-open').getAttribute('aria-label')))
        .toEqual(['List for-me, 0 places', 'List open, 0 places']);
    });

    it('says "Shared with you" on it, in words, and offers its heart to the friend it was shared with', async () => {
      await show();
      const [lent, open] = acts();
      expect(markIn(lent)!.textContent).toBe('·Shared with you');
      expect(markIn(lent)!.getAttribute('aria-label')).toBe('Shared with you');
      expect(markIn(lent)!.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('people-outline');
      fireEvent.click(within(lent).getByTestId('activity-heart'));
      expect(spies.toggleLike).toHaveBeenCalledExactlyOnceWith({ id: 'for-me', slug: 'for-me' });
      // Their public list wears the globe for a visitor too.
      expect(markIn(open)!.getAttribute('aria-label')).toBe('Public');
      expect(markIn(open)!.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('globe-outline');
      expect(within(open).getByTestId('activity-heart')).toBeTruthy();
      // Somebody else's page: no way to an account that is not yours,
      // and since the grid went nothing else on the heading.
      expect(screen.queryByTestId('person-account')).toBeNull();
    });

    it('says it in Vietnamese', async () => {
      state.lang = 'vi';
      await show();
      expect(markIn(acts()[0])!.textContent).toBe('·Chia sẻ với bạn');
    });

    it('opens the lent list’s own page on a press', async () => {
      const navigation = await show();
      fireEvent.click(within(acts()[0]).getByTestId('activity-open'));
      expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'for-me' });
    });

    it('asks for what was lent to you as you, and for nobody’s shares', async () => {
      await show();
      expect(state.lentAsked.at(-1)).toBe('me-id');
      expect(state.sharesAsked.at(-1)).toBeNull();
    });

    it('shows a guest the public lists alone, and asks for nothing as nobody', async () => {
      state.me = null;
      await show();
      expect(acts().map((c) => within(c).getByTestId('activity-open').getAttribute('aria-label'))).toEqual(['List open, 0 places']);
      expect(state.lentAsked.at(-1)).toBeNull();
      expect(state.sharesAsked.at(-1)).toBeNull();
    });
  });
});

describe('the cover', () => {
  const coverSrc = () => screen.getByTestId('person-cover').querySelector('img')?.getAttribute('src') ?? null;

  it('is the cover of their newest list that has one, and each card wears its own', async () => {
    state.shelf = [
      list('bare'),
      list('chosen', { cover: { photo_uri: 'https://covers/chosen.jpg' } }),
      list('older', { cover: { photo_uri: 'https://covers/older.jpg' } }),
    ];
    await show();
    expect(coverSrc()).toBe('https://covers/chosen.jpg');
    expect(screen.queryByTestId('person-cover-tint')).toBeNull();
    // The bare one wears the tint; the other two their own photographs.
    expect(cards().map((x) => within(x).getByTestId('activity-open').querySelector('img')?.getAttribute('src') ?? null))
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
const scrollAt = (y: number, content: number) => act(() => {
  (propsWhere((q) => typeof q.onScroll === 'function' && 'contentContainerStyle' in q).onScroll as (e: unknown) => void)({
    nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: content }, layoutMeasurement: { width: 390, height: 844 } },
  });
});
const scrollTo = (y: number) => scrollAt(y, 2000);

// What there is to do about a person, in a row of its own under the head
// (owner, 16 Nov 2026). The friend button stood at the end of the name's
// row and, at 44, cut a long name and its handle.
describe('the row of acts', () => {
  const edge = (requester: string, addressee: string, status: 'pending' | 'accepted'): FriendshipRow =>
    ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z', responded_at: null }) as FriendshipRow;
  const headRow = () => screen.getByTestId('person-cover').nextElementSibling as HTMLElement;

  it('holds the friend button and Message, under the head and the bio in it', async () => {
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
    // The bio first, in the head: who they are, then what to do about them.
    expect(headRow().contains(screen.getByTestId('person-bio'))).toBe(true);
    expect(acts.contains(screen.getByTestId('person-bio'))).toBe(false);
  });

  // One group in the page's middle, a rule between (owner, 17 Nov 2026):
  // the reference. Two equal halves, for a morning, set the pair 190
  // apart.
  it('lays the two out as one centred group, the same space either side of a short rule', async () => {
    await show();
    const acts = screen.getByTestId('person-acts');
    const [left, rule, right] = Array.from(acts.children) as HTMLElement[];
    expect(acts.children).toHaveLength(3);
    expect(left.contains(screen.getByTestId('person-add')) || left === screen.getByTestId('person-add')).toBe(true);
    expect(rule).toBe(screen.getByTestId('person-acts-rule'));
    expect(right).toBe(screen.getByTestId('person-message'));
    const row = viewStyleOf(acts);
    expect(row).toMatchObject({ justifyContent: 'center', alignItems: 'center', gap: 22 });
    // Neither stretches: a group, not halves.
    for (const one of [left, right]) expect(viewStyleOf(one).flex).toBeUndefined();
    const line = viewStyleOf(rule);
    expect(line.width).toBe(1);
    expect(Number(line.height)).toBeLessThan(44 / 2);
  });

  // What stands — Friends, Requested — is words at Message's own size
  // beside it, and Message is words too.
  it('sets "Friends" and Message in the same type, one plain and one dimmed', async () => {
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    await show();
    const friends = screen.getByTestId('person-friends');
    expect(screen.getByTestId('person-acts').firstElementChild).toBe(friends);
    const said = textStyleOf(screen.getByText('Friends'));
    const message = textStyleOf(screen.getByText('Message'));
    expect(said).toMatchObject({ fontSize: 16, color: colors.textSecondary });
    expect(message?.fontSize).toBe(said?.fontSize);
    expect(message?.fontWeight).toBe(said?.fontWeight);
    const tick = friends.querySelector('[data-icon="checkmark"]')!;
    expect([tick.getAttribute('data-size'), tick.getAttribute('data-color')]).toEqual(['18', String(colors.textSecondary)]);
    // "Soon" slanted beside it, as the reference.
    expect(textStyleOf(screen.getByText('Soon'))).toMatchObject({ fontStyle: 'italic' });
  });

  // Not built yet, and said so: dimmed, "Soon" beside the word, and no
  // press at all — nothing pretends to answer one.
  it('draws Message as not yet a button: dimmed, said to be coming, and no press', async () => {
    const navigation = await show();
    const message = screen.getByTestId('person-message');
    expect(message.textContent).toBe('Message' + 'Soon');
    const face = message.firstElementChild as HTMLElement;
    expect(viewStyleOf(face)).toMatchObject({ opacity: 0.45, minHeight: 44 });
    // Words, not a pill: beside "Friends" a dimmed pill was the louder of the two.
    expect(viewStyleOf(face).backgroundColor).toBeUndefined();
    expect(viewStyleOf(face).borderWidth).toBeUndefined();
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
    expect(cards()).toHaveLength(1);
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
    const own = cards()[0];
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
    expect(cards()).toEqual([]);
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

// What a card on the page shows of its collection's thread (C3b of
// `docs/comments-plan.md`). The card's own drawing is pinned in its test
// and the rule for which card gets what in `useCardComments`'s; here it
// is the page's wiring: nothing as the app ships, and with the switch on
// a public collection's card wears its count and opens that thread.
const talk = vi.hoisted(() => ({
  fetchPreviews: vi.fn(async (_s: { id: string }[]): Promise<Record<string, unknown>> => ({})),
}));
vi.mock('../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPreviews: talk.fetchPreviews,
}));

describe('comments on the cards', () => {
  afterEach(async () => {
    (await import('../lib/flags')).appFlags.reset();
    talk.fetchPreviews.mockImplementation(async () => ({}));
  });

  it('draws nothing about them as the app ships', async () => {
    state.shelf = [list('one')];
    await show();
    expect(screen.queryByTestId('activity-comments')).toBeNull();
  });

  it('shows the count with the switch on, and opens that collection\'s thread', async () => {
    (await import('../lib/flags')).appFlags.set('comments', true);
    talk.fetchPreviews.mockImplementation(async () => ({
      two: { n: 3, latest: [{ id: 'k1', body: 'lovely', created_at: 'x', author: 'u', handle: 'trang', full_name: null, avatar_url: null }] },
    }));
    state.shelf = [list('one'), list('two')];
    const nav = await show();
    const cards = screen.getAllByTestId('person-act');
    // The card with no comments has the way in and no figure.
    expect(within(cards[0]).queryByTestId('activity-comments-count')).toBeNull();
    expect(within(cards[1]).getByTestId('activity-comments-count').textContent).toBe('3');
    // The figure, and none of what was said: that is the thread's.
    expect(within(cards[1]).queryByText(/lovely/)).toBeNull();
    fireEvent.click(within(cards[1]).getByTestId('activity-comments'));
    expect(nav.navigate).toHaveBeenCalledWith('Comments', { subject: { kind: 'collection', id: 'two' } });
    // The one nobody has commented on raises the app's field where there
    // is one (`useCardComments`'s test); this page is rendered alone, so
    // it opens that thread too.
    fireEvent.click(within(cards[0]).getByTestId('activity-comments'));
    expect(nav.navigate).toHaveBeenLastCalledWith('Comments', { subject: { kind: 'collection', id: 'one' } });
  });
});

// The last tab's first page, your own (owner, 19 Nov 2026 —
// docs/profile-home-plan.md): no way back, no title. What only you see is
// on your own page wherever it opens (owner, 19 Nov 2026).
describe('your own page', () => {
  const PROFILE_STACK = ['ProfileHome', 'Account', 'Activity', 'Crew', 'Visited', 'Person'];

  beforeEach(() => {
    state.people = { ...state.people, me: { id: 'me-id', handle: 'me', full_name: 'Me', avatar_url: '' } };
  });

  it('as the tab’s first page has no way back and no title, and pushes Account in its own stack', async () => {
    const navigation = await show('me', true, PROFILE_STACK);
    expect(screen.queryByTestId('person-back')).toBeNull();
    // The tab says whose page it is (owner, 19 Nov 2026).
    expect(screen.queryByText('Profile')).toBeNull();
    fireEvent.click(screen.getByTestId('person-account'));
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('Account');
    expect(out.tabs!.navigate).not.toHaveBeenCalled();
    expect(out.goTo).not.toHaveBeenCalled();
  });

  // Under the head and over the activity: who you are, then what only
  // you see, then what you did.
  it('draws your counts, then the requests waiting, between your head and your activity', async () => {
    await show('me', true, PROFILE_STACK);
    const [name, counts, requests, account] = ['person-name', 'owner-counts', 'owner-requests', 'person-account'].map((id) => screen.getByTestId(id));
    for (const [a, b] of [[name, counts], [counts, requests], [requests, account]]) {
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // One page of you, not two: opened from a list in another tab it has
  // its way back and its title, and the same counts and requests — whose
  // rooms are in the last tab, so a press changes tab.
  it('is the same page from another tab, its rooms reached through the last tab', async () => {
    const navigation = await show('me', false, ['CollectionsHome', 'CollectionDetail', 'Person']);
    expect(screen.getByTestId('person-back')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByTestId('owner-counts')).toBeTruthy();
    fireEvent.click(screen.getByTestId('owner-requests'));
    expect(out.tabs!.navigate).toHaveBeenLastCalledWith('Profile', { screen: 'Crew', initial: false });
    fireEvent.click(screen.getByTestId('person-account'));
    expect(out.tabs!.navigate).toHaveBeenLastCalledWith('Profile', { screen: 'Account', initial: false });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('shows none of it on somebody else’s page', async () => {
    await show('lan', false, PROFILE_STACK);
    for (const id of ['owner-counts', 'owner-requests', 'person-bell', 'person-own-face']) {
      expect(screen.queryByTestId(id), id).toBeNull();
    }
  });

  // P3 (owner, 19 Nov 2026): Activity's way in is a bell over the cover's
  // corner, A of the two drawn; Account's row for it is gone.
  it('has the bell over the cover, opening Activity in the last tab', async () => {
    const navigation = await show('me', true, PROFILE_STACK);
    const bell = screen.getByTestId('person-bell');
    expect(screen.getByTestId('person-cover').contains(bell)).toBe(true);
    expect(bell.getAttribute('aria-label')).toBe('Activity');
    fireEvent.click(bell);
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('Activity');
    // No dot with nothing new in comments; one, and its count said, with
    // something (C7c) — the number the tab's dot reads (`lib/freshNews`).
    expect(screen.queryByTestId('person-bell-dot')).toBeNull();
    cleanup();
    state.fresh = 2;
    await show('me', true, PROFILE_STACK);
    expect(screen.getByTestId('person-bell').contains(screen.getByTestId('person-bell-dot'))).toBe(true);
    expect(screen.getByTestId('person-bell').getAttribute('aria-label')).toBe('Activity, 2 new');
    cleanup();
    state.fresh = 0;
    await show('me', false, ['CollectionsHome', 'Person']);
    fireEvent.click(screen.getByTestId('person-bell'));
    expect(out.tabs!.navigate).toHaveBeenLastCalledWith('Profile', { screen: 'Activity', initial: false });
  });

  it('draws your face in the level’s ring, and everyone else’s without', async () => {
    await show('me', true, PROFILE_STACK);
    expect(screen.getByTestId('person-own-face')).toBeTruthy();
    expect(screen.getByTestId('level-badge')).toBeTruthy();
    // Your picture at 88, bare, in the level's ring: 103 across, the
    // Account page's own (`profile/Hero`). No band of page inside the
    // ring (owner, 19 Nov 2026): the ring's gap is the page's.
    const ring = screen.getByTestId('avatar-box').firstElementChild!;
    expect(viewStyleOf(ring)).toMatchObject({ width: 103, height: 103 });
    const sizes = [...screen.getByTestId('person-own-face').querySelectorAll('*')].map((el) => getComputedStyle(el).width);
    expect(sizes).toContain('88px');
    expect(sizes).not.toContain('80px');
    // Nothing between the ring and the picture: no band of page of its own.
    expect([...screen.getByTestId('person-own-face').querySelectorAll('*')].some((el) => getComputedStyle(el).borderWidth === '4px')).toBe(false);
  });

  // The plan's rule (docs/profile-home-plan.md §3): every reason the last
  // tab wears a dot for is in sight on your own page. A reason added to
  // the tab's dot with no place here turns this red.
  it('has a place on the page for every reason the tab wears a dot', async () => {
    const places: Record<string, string> = { requests: 'owner-requests', badges: 'level-badge', comments: 'person-bell-dot' };
    const none = { requests: 0, invites: 0, today: null, badges: 0, comments: 0 };
    for (const key of Object.keys(none) as (keyof typeof none)[]) {
      const said = spokenTab('Profile', 'Profile', { ...none, [key]: key === 'today' ? 'x' : 1 }, (en) => en);
      if (said === 'Profile') continue;
      expect(places[key], `the tab's dot says "${said}", and the page has no place for it`).toBeDefined();
    }
    state.fresh = 1;
    await show('me', true, PROFILE_STACK);
    for (const id of Object.values(places)) expect(screen.getByTestId(id), id).toBeTruthy();
  });
});
