// @vitest-environment jsdom
//
// Profile has two personas and one loading gate, so what is pinned here is
// which persona a reader gets and what every door on it leads to. Guests:
// the sign-in promise, every locked row leading to SignIn, the quiet exit
// to Explore, the settings and legal cards they share with members.
// Members: the identity block (name falling back to the email's local
// part, handle, bio, hometown, member-since in each language, interests
// cleaned and chipped), the friends card's count and request dot, the
// level ring fed by *distinct* saved places, the settings sheets opening
// and closing, the temporary welcome switch writing storage, sign out with
// its spinner, and Delete account going to its own screen.
//
// Every door is found by role and name rather than by its words, so what
// a screen reader is told — that it is a button, and which — is pinned
// along with where it leads.
//
// The pure halves (`splitFriendships`, `cleanTaste`, `levelFromSaves`,
// `schemeLabel`) run for real; hooks and sheets are stood in for.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import { useScrollToTop } from '@react-navigation/native';
import type { Nav } from '../nav';

type Lang = 'en' | 'vi' | 'ja';

// `Alert` from react-native-web is a silent no-op, so a failed sign-out is
// caught at the import the screen actually uses.
const alert = vi.hoisted(() => vi.fn<(title: string, body?: string) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));
// The root ref only; the route types stay real.
const goTo = vi.hoisted(() => vi.fn());
vi.mock('../nav', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  goTo,
}));

const state = vi.hoisted(() => ({
  guide: false,
  editor: false,
  lang: 'en' as 'en' | 'vi' | 'ja',
  scheme: 'dark' as 'dark' | 'light',
  pref: 'dark' as 'dark' | 'light' | 'system',
  ready: true,
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  email: 'minh.le@example.com' as string | null,
  profile: {} as { full_name?: string; handle?: string; bio?: string; location?: string },
  memberSince: null as Date | null,
  ships: [] as { requester: string; addressee: string; status: string; created_at: string }[],
  categories: [] as string[],
  mine: [] as { members: { slug: string }[] }[],
  trips: [] as { id: string }[],
  city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as
    { short_en: string; short_vi: string; short_ja: string } | null,
  mode: 'manual' as 'auto' | 'manual',
}));

const spies = vi.hoisted(() => ({
  signOut: vi.fn(async () => {}),
  reload: vi.fn(),
  prefsFor: vi.fn(),
}));

// `t` answers in the language on state, so the member-since label and the
// language row can be read in each; everything else is asserted in English.
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja?: string) =>
      (state.lang === 'vi' ? vi : state.lang === 'ja' ? (ja ?? en) : en),
  }),
}));
// The reader's standing, as the grant store would answer it.
vi.mock('../lib/useGuideGrant', () => ({
  useIsEditor: () => state.editor,
  useIsGuideAnywhere: () => state.guide,
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    ready: state.ready,
    session: state.session,
    email: state.email,
    profile: state.profile,
    memberSince: state.memberSince,
    signOut: spies.signOut,
  }),
}));
vi.mock('../lib/data', () => ({
  // Own collections carry their members, which is the only path the
  // screen relies on (it passes an empty catalog on purpose).
  membersOf: (c: { members: { slug: string }[] }) => c.members,
  useMyPreferences: (uid: string | null) => {
    spies.prefsFor(uid);
    return { data: { categories: state.categories }, reload: spies.reload };
  },
}));
vi.mock('../lib/crew', () => ({ useCrew: () => ({ ships: { data: state.ships } }) }));
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: state.mine } }) }));
vi.mock('../lib/mytrips', () => ({ useMyTrips: () => ({ data: state.trips }) }));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city, mode: state.mode }) }));
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, pref: state.pref, setPref: () => {}, ready: true }),
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));

// Sheets have their own suites. What Profile owes each is opening it and
// closing it, so every stand-in says which it is and offers a close.
type SheetProps = { visible: boolean; onClose: () => void };
vi.mock('../components/CitySwitcher', () => ({
  CitySwitcherModal: ({ visible, onClose }: SheetProps) =>
    (visible ? <button type="button" onClick={onClose}>close-city</button> : null),
}));
vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcherModal: ({ visible, onClose }: SheetProps) =>
    (visible ? <button type="button" onClick={onClose}>close-language</button> : null),
}));
// `schemeLabel` stays real: the words on the Appearance row are its.
vi.mock('../components/ThemeSwitcher', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  ThemeSwitcherModal: ({ visible, onClose }: SheetProps) =>
    (visible ? <button type="button" onClick={onClose}>close-theme</button> : null),
}));
vi.mock('../components/LegalSheet', () => ({
  default: ({ id, onClose }: { id: string | null; onClose: () => void }) =>
    (id ? <button type="button" onClick={onClose}>{`close-legal-${id}`}</button> : null),
}));
vi.mock('../components/AboutSheet', () => ({
  default: ({ visible, onClose }: SheetProps) =>
    (visible ? <button type="button" onClick={onClose}>close-about</button> : null),
}));
vi.mock('../components/AvatarPicker', () => ({
  default: ({ showCamera }: { showCamera?: boolean }) => <div data-testid="avatar" data-camera={String(showCamera)} />,
}));
// The ring's drawing is its own business; the numbers it is handed are
// this screen's.
vi.mock('../components/EngagementRing', () => ({
  default: ({ level, progress, children }: { level: number; progress: number; children: React.ReactNode }) =>
    <div data-testid="ring" data-level={level} data-progress={progress}>{children}</div>,
}));

import ProfileScreen from './ProfileScreen';

const nav = () => {
  const parent = { navigate: vi.fn() };
  const n = { navigate: vi.fn(), goBack: vi.fn(), getParent: vi.fn(() => parent) };
  return { n: n as unknown as Nav, raw: n, parent };
};

const draw = () => {
  const r = nav();
  render(<ProfileScreen navigation={r.n} />);
  return r;
};

const tap = (text: string) => fireEvent.click(screen.getByText(text));

// A button whose accessible name *starts* with these words: rows carry a
// sentence or a value after their title, and that is part of the name.
const button = (start: string) =>
  screen.getByRole('button', { name: new RegExp(`^${start}`) });
const press = (start: string) => fireEvent.click(button(start));

beforeEach(async () => {
  vi.clearAllMocks();
  state.guide = false;
  state.editor = false;
  state.trips = [];
  spies.signOut.mockImplementation(async () => {});
  Object.assign(state, {
    lang: 'en' as Lang,
    scheme: 'dark',
    pref: 'dark',
    ready: true,
    session: { user: { id: 'me' } },
    email: 'minh.le@example.com',
    profile: {},
    memberSince: null,
    ships: [],
    categories: [],
    mine: [],
    city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' },
    mode: 'manual',
  });
});

describe('the gate', () => {
  it('shows only a spinner while auth is still being read, and neither persona', () => {
    state.ready = false;
    draw();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.queryByText('Keep the places you love')).toBeNull();
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('gives a reader with no session the guest hub, not the account', () => {
    state.session = null;
    draw();
    expect(screen.getByText('Keep the places you love')).toBeTruthy();
    expect(screen.getByText('Sign in to save places, build collections, and plan your trips')).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();
    expect(screen.queryByText('Delete account')).toBeNull();
    expect(screen.queryByText('About me')).toBeNull();
  });

  it('gives a signed-in reader the account, not the guest hub', () => {
    draw();
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.queryByText('Keep the places you love')).toBeNull();
    expect(screen.queryByText('Sign in / Sign up')).toBeNull();
  });
});

describe('guest hub', () => {
  beforeEach(() => { state.session = null; });

  it('sends the primary button to SignIn', () => {
    const { raw } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in / Sign up' }));
    expect(raw.navigate).toHaveBeenCalledWith('SignIn');
  });

  it.each(['Saved places', 'Collections', 'Trips', 'Connect with friends'])(
    'the locked "%s" row leads to signing in',
    (title) => {
      const { raw } = draw();
      press(title);
      expect(raw.navigate).toHaveBeenCalledWith('SignIn');
    },
  );

  it('explains each locked feature in a sentence', () => {
    draw();
    expect(screen.getByText('Sign in to save your favorite places.')).toBeTruthy();
    expect(screen.getByText('Create and organize your collections.')).toBeTruthy();
    expect(screen.getByText('Plan trips and invite your friends.')).toBeTruthy();
    expect(screen.getByText('Find friends and share unforgettable trips.')).toBeTruthy();
  });

  it('"Keep exploring" goes to the Explore tab through the parent navigator', () => {
    const { raw, parent } = draw();
    press('Keep exploring');
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
    expect(raw.navigate).not.toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });

  it('"Keep exploring" still reaches Explore through the root when there is no parent', () => {
    const r = nav();
    r.raw.getParent.mockReturnValue(undefined as never);
    render(<ProfileScreen navigation={r.n} />);
    press('Keep exploring');
    expect(goTo).toHaveBeenCalledWith('Explore', { screen: 'ExploreHome' });
  });

  // The same headings as the member view over the same cards, and one
  // for what an account opens, in the order the screen reads.
  it('heads its cards the way the member view does', () => {
    draw();
    const heads = ['With an account', 'Preferences', 'App'].map((h) => screen.getByText(h));
    for (let i = 1; i < heads.length; i++) {
      expect(heads[i - 1].compareDocumentPosition(heads[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByText('Current city')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.queryByText('Legal')).toBeNull();
  });

  it('heads them in Vietnamese too', () => {
    state.lang = 'vi';
    draw();
    for (const h of ['Khi có tài khoản', 'Tuỳ chọn', 'Ứng dụng']) expect(screen.getByText(h)).toBeTruthy();
  });

  // Friends is one more thing an account opens: a fourth locked row with
  // the other three, not a card stranded after the documents.
  it('keeps friends with the other things an account opens', () => {
    draw();
    const rows = ['Saved places', 'Collections', 'Trips', 'Connect with friends'].map((name) => button(name));
    expect(new Set(rows.map((r) => r.parentElement)).size).toBe(1);
    expect(rows[3].compareDocumentPosition(screen.getByText('Preferences')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // News needs an account to have happened to; a guest has no lists to
  // be liked and no trips to come up.
  it('offers no activity feed to a guest', () => {
    draw();
    expect(screen.queryByText('Activity')).toBeNull();
  });

  it('never says "guest"', () => {
    draw();
    expect(document.body.textContent?.toLowerCase()).not.toContain('guest');
  });

  it("closes on the tagline and its author, under the app's own mark", () => {
    draw();
    expect(screen.getByText(/We do not remember days/)).toBeTruthy();
    expect(screen.getByText('— Cesare Pavese')).toBeTruthy();
    // A glyph, not an emoji: the platform used to choose the shape and
    // nothing gave it the theme's colour.
    expect(document.querySelector('[data-icon="paw"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain('\u2728');
  });
});

describe('account identity', () => {
  it('shows the full name, and the handle and the bio on one line with a dot between', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh', bio: 'Coffee first.' };
    draw();
    expect(screen.getByText('Le Minh')).toBeTruthy();
    const handle = screen.getByText('@leminh');
    const bio = screen.getByText('Coffee first.');
    // Runs of one Text: the same parent, reading "@leminh · Coffee first."
    expect(handle.parentElement).toBe(bio.parentElement);
    expect(handle.parentElement!.textContent).toBe('@leminh · Coffee first.');
  });

  it('draws no dot when only one of the two is there', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh' };
    draw();
    expect(screen.getByText('@leminh').parentElement!.textContent).toBe('@leminh');
    cleanup();
    state.profile = { full_name: 'Le Minh', bio: 'Coffee first.' };
    draw();
    expect(screen.getByText('Coffee first.').parentElement!.textContent).toBe('Coffee first.');
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('falls back to the local part of the email when there is no name, and draws no empty handle', () => {
    draw();
    expect(screen.getByText('minh.le')).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it('lists the email in About me', () => {
    draw();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('minh.le@example.com')).toBeTruthy();
  });

  it('shows Hometown and Member since only when they are known', () => {
    draw();
    expect(screen.queryByText('Hometown')).toBeNull();
    expect(screen.queryByText('Member since')).toBeNull();
  });

  it('shows Hometown and an English month for Member since', () => {
    state.profile = { location: 'Da Nang' };
    state.memberSince = new Date(2025, 2, 14);
    draw();
    expect(screen.getByText('Hometown')).toBeTruthy();
    expect(screen.getByText('Da Nang')).toBeTruthy();
    expect(screen.getByText('March 2025')).toBeTruthy();
  });

  // Every row leads with the same bare glyph, as the place's address and
  // phone do on PlaceDetail — no coral well anywhere on the screen. The
  // chevron already says which rows go somewhere.
  it('leads every row with a bare glyph and wears no well anywhere', () => {
    state.profile = { location: 'Da Nang' };
    state.memberSince = new Date(2025, 2, 14);
    draw();
    expect(document.querySelector('[data-testid="round-icon"]')).toBeNull();
    // Three facts, the crew card, and the settings rows — each with one glyph.
    const about = screen.getByText('Hometown').closest('[data-testid="about-row"]');
    expect(about?.querySelectorAll('[data-testid="row-glyph"]')).toHaveLength(1);
    const friends = screen.getByText('Connect with friends').closest('[data-testid="feature-row"]');
    expect(friends?.querySelectorAll('[data-testid="row-glyph"]')).toHaveLength(1);
    expect(screen.getAllByTestId('row-glyph').length).toBeGreaterThanOrEqual(4);
  });

  // Level with the first line, as the detail screen sets its glyphs
  // against a label — the owner caught the glyph floating to the middle
  // of label-plus-value the day the wells came off. Asserted the way the
  // detail screen's test does: the slot's middle is the first line's.
  it('sets the glyph level with the row’s first line, on facts and on the crew card', () => {
    state.profile = { location: 'Da Nang' };
    state.memberSince = new Date(2025, 2, 14);
    draw();
    const slotOf = (text: string, row: string) =>
      getComputedStyle(screen.getByText(text).closest(`[data-testid="${row}"]`)!.querySelector('[data-testid="row-glyph"]')!);
    const about = slotOf('Hometown', 'about-row');
    expect(parseFloat(about.height)).toBeGreaterThan(19);
    expect(parseFloat(about.marginTop) + parseFloat(about.height) / 2).toBeCloseTo(15 / 2, 5);
    const friends = slotOf('Connect with friends', 'feature-row');
    expect(parseFloat(friends.marginTop) + parseFloat(friends.height) / 2).toBeCloseTo(19 / 2, 5);
  });

  it.each([
    ['vi' as const, 'Thành viên từ', 'Tháng 3, 2025'],
    ['ja' as const, '登録日', '2025年3月'],
  ])('writes Member since the %s way', (lang, label, value) => {
    state.lang = lang;
    state.memberSince = new Date(2025, 2, 14);
    draw();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(value)).toBeTruthy();
  });

  it('opens Edit profile, with the avatar drawn without its camera badge', () => {
    const { raw } = draw();
    expect(screen.getByTestId('avatar').getAttribute('data-camera')).toBe('false');
    press('Edit profile');
    expect(raw.navigate).toHaveBeenCalledWith('EditProfile');
  });
});

describe('interests', () => {
  it('asks for the reader own preferences and reloads them on focus', () => {
    draw();
    expect(spies.prefsFor).toHaveBeenCalledWith('me');
    expect(spies.reload).toHaveBeenCalledTimes(1);
  });

  it('draws known categories as chips, dropping unknown words and duplicates', () => {
    state.categories = ['cafes', 'Nitendo', 'eats', 'cafes'];
    draw();
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.getByText('Eats')).toBeTruthy();
    expect(screen.getAllByText('Cafés')).toHaveLength(1);
    expect(screen.queryByText('Nitendo')).toBeNull();
    expect(screen.queryByText('Edit profile to add your interests.')).toBeNull();
  });

  it('points at Edit profile when nothing usable is stored', () => {
    state.categories = ['Sleep'];
    draw();
    expect(screen.getByText('Edit profile to add your interests.')).toBeTruthy();
  });

  // A section of their own, headed — not a row of the facts card behind a
  // heart glyph, and with no Edit of its own: Edit profile, four lines up,
  // is the one way to the picker.
  it('stands under its own heading, with no second way to the editor', () => {
    state.categories = ['cafes'];
    draw();
    expect(screen.getByText('Interests')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit interests/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Edit profile' })).toHaveLength(1);
    expect(document.querySelector('[data-icon="heart-outline"]')).toBeNull();
  });
});

// The reader's standing, as a small disc on the avatar's top-right corner.
// Editor outranks guide and is shown alone; a reader with neither wears
// none; a tap explains the grant in the desk's words.
describe('the role badge', () => {
  const badge = (name: RegExp | string) => screen.getByRole('button', { name });

  it('is absent for a reader with no grant', () => {
    draw();
    expect(screen.queryByRole('button', { name: /Local Guide|Super User/ })).toBeNull();
    expect(screen.queryByTestId('role-badge')).toBeNull();
  });

  it('sits on the avatar, not under the name, and says nothing in words', () => {
    state.guide = true;
    draw();
    const disc = badge('Local Guide');
    expect(screen.getByTestId('avatar-box').contains(disc)).toBe(true);
    expect(screen.queryByText('Local Guide')).toBeNull();
    expect(disc.querySelector('[data-icon="star"]')).toBeTruthy();
  });

  it('names a local guide, and says what the grant lets them do', () => {
    state.guide = true;
    draw();
    fireEvent.click(badge('Local Guide'));
    expect(alert).toHaveBeenCalledWith(
      'Local Guide',
      'You can edit, and add photos to, places in your collections and places you imported.',
    );
  });

  it('names an editor as Super User, and only that, even when also a guide', () => {
    state.guide = true;
    state.editor = true;
    draw();
    expect(screen.queryByRole('button', { name: 'Local Guide' })).toBeNull();
    const disc = badge('Super User');
    expect(disc.querySelector('[data-icon="medal"]')).toBeTruthy();
    fireEvent.click(disc);
    expect(alert).toHaveBeenCalledWith('Super User', expect.stringMatching(/every place in the app/));
  });

  // Two roles, two colours: the disc's edge and glyph follow the role,
  // and an editor who is also a guide wears the editor's, not the guide's.
  // react-native-web writes colours as classes, which jsdom's computed
  // style does not resolve, so the class list is what is compared.
  it('wears a different colour for each role, the editor’s when both apply', () => {
    const dress = (name: string) => badge(name).firstElementChild!.className;
    state.guide = true;
    draw();
    const guideDress = dress('Local Guide');
    cleanup();
    state.editor = true;
    draw();
    expect(dress('Super User')).not.toBe(guideDress);
    expect(guideDress).toMatch(/borderColor/);
  });

  // Words only on Edit profile: the pencil it wore was not wanted.
  it('keeps Edit profile to its words, with no glyph', () => {
    draw();
    const edit = screen.getByRole('button', { name: 'Edit profile' });
    expect(edit.querySelector('[data-icon]')).toBeNull();
  });
});

// Three numbers under the hero, each a door into the tab that holds it.
describe('the three doors', () => {
  const p = (slug: string) => ({ slug });

  it('counts collections, distinct saved places and trips', () => {
    state.mine = [{ members: [p('a'), p('b')] }, { members: [p('a'), p('c')] }];
    state.trips = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    draw();
    expect(screen.getByRole('button', { name: '2 Collections' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3 Saved places' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3 Trips' })).toBeTruthy();
    // No review count: there is no review feature.
    expect(screen.queryByText(/Reviews/)).toBeNull();
  });

  it('opens the tab each number lives in', () => {
    const { parent } = draw();
    fireEvent.click(screen.getByRole('button', { name: '0 Collections' }));
    expect(parent.navigate).toHaveBeenLastCalledWith('Collections');
    fireEvent.click(screen.getByRole('button', { name: '0 Saved places' }));
    expect(parent.navigate).toHaveBeenLastCalledWith('Collections');
    fireEvent.click(screen.getByRole('button', { name: '0 Trips' }));
    expect(parent.navigate).toHaveBeenLastCalledWith('Trips');
    expect(parent.navigate).toHaveBeenCalledTimes(3);
  });

  it('reads zero trips while the list has not loaded', () => {
    state.trips = null as unknown as { id: string }[];
    draw();
    expect(screen.getByRole('button', { name: '0 Trips' })).toBeTruthy();
  });

});

describe('the level ring', () => {
  it('counts a place saved into two lists once', () => {
    const p = (slug: string) => ({ slug });
    state.mine = [
      { members: [p('a'), p('b'), p('c')] },
      { members: [p('a'), p('d'), p('e'), p('f')] },
    ];
    draw();
    // Six distinct places: level 2, one fifth of the way to 3.
    const ring = screen.getByTestId('ring');
    expect(ring.getAttribute('data-level')).toBe('2');
    expect(Number(ring.getAttribute('data-progress'))).toBeCloseTo(0.2);
  });

  it('starts a new account at level 1', () => {
    draw();
    expect(screen.getByTestId('ring').getAttribute('data-level')).toBe('1');
  });
});

describe('friends card', () => {
  const edge = (requester: string, addressee: string, status: string) =>
    ({ requester, addressee, status, created_at: '2026-01-01' });

  it('opens the crew', () => {
    const { raw } = draw();
    tap('Friends');
    expect(raw.navigate).not.toHaveBeenCalled();
    press('Connect with friends');
    expect(raw.navigate).toHaveBeenCalledWith('Crew');
    expect(screen.getByText('Find friends and share your plans.')).toBeTruthy();
  });

  // The feed had no door from 23 Aug 2026 (#309) until 6 Oct: its one
  // entry was the "requests waiting" banner on Crew, and the two-tab
  // Crew took the banner down with the requests it had pointed at. The
  // applause and the trips it also carried were left behind a route
  // nothing navigated to. It hangs here now, under the friends row.
  it('opens the activity feed from the Friends card', () => {
    const { raw } = draw();
    press('Activity');
    expect(raw.navigate).toHaveBeenCalledWith('Activity');
    expect(screen.getByText('Likes on your lists, and friend requests.')).toBeTruthy();
  });

  it('files Activity in the same card as the friends row, under it', () => {
    draw();
    const friends = screen.getByText('Connect with friends').closest('[data-testid="feature-row"]')!;
    const activity = screen.getByText('Activity').closest('[data-testid="feature-row"]')!;
    expect(activity).not.toBe(friends);
    expect(activity.parentElement).toBe(friends.parentElement);
    expect(friends.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(activity.compareDocumentPosition(screen.getByText('Preferences')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One glyph each, the same bare kind.
    expect(activity.querySelectorAll('[data-testid="row-glyph"]')).toHaveLength(1);
  });

  it('counts accepted friends only, and shows no number with none', () => {
    state.ships = [
      edge('me', 'a', 'accepted'),
      edge('b', 'me', 'accepted'),
      edge('me', 'c', 'pending'),
      edge('x', 'y', 'accepted'),
    ];
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    expect(screen.getByText('2')).toBeTruthy();
    unmount();
    // One friend is still a number worth showing.
    state.ships = [edge('me', 'a', 'accepted')];
    const again = render(<ProfileScreen navigation={nav().n} />);
    expect(screen.getByText('1')).toBeTruthy();
    again.unmount();
    state.ships = [edge('me', 'c', 'pending')];
    draw();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('marks a waiting request with a dot beside the icon, and only then', () => {
    const dotCount = () => {
      const card = screen.getByText('Connect with friends').parentElement!.parentElement!;
      return card.firstElementChild!.children.length;
    };
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    expect(dotCount()).toBe(1);
    unmount();
    state.ships = [edge('z', 'me', 'pending')];
    draw();
    expect(dotCount()).toBe(2);
  });
});

describe('settings card', () => {
  it('names the current city, and only the city, whichever way it was chosen', () => {
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    // `getByText` matches whole strings, so a suffix or a second line
    // ("Hanoi · from your location", "By location") would fail this.
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.queryByText(/location|chosen/i)).toBeNull();
    unmount();
    state.mode = 'auto';
    draw();
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.queryByText(/location|chosen/i)).toBeNull();
    // Where the city came from is the sheet's to say, so the row is the
    // same height in both modes: the value is one Text, a sibling of the
    // label, with nothing stacked under it.
    const city = screen.getByText('Hanoi');
    expect(city.parentElement).toBe(screen.getByText('Current city').parentElement);
    expect(city.childElementCount).toBe(0);
  });

  it('holds a place for a city not loaded yet', () => {
    state.city = null;
    draw();
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('opens and closes the city sheet', () => {
    draw();
    expect(screen.queryByText('close-city')).toBeNull();
    press('Current city');
    fireEvent.click(screen.getByText('close-city'));
    expect(screen.queryByText('close-city')).toBeNull();
  });

  it('names the language in itself and opens the language sheet', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
    press('Ngôn ngữ');
    fireEvent.click(screen.getByText('close-language'));
    expect(screen.queryByText('close-language')).toBeNull();
  });

  // Three cases, and the third is the one that carries the rule: on Auto
  // the words follow the setting while the glyph follows the ground the
  // phone picked, so the row reads "Automatic" beside a moon.
  it.each([
    ['dark' as const, 'dark' as const, 'Dark', 'moon-outline'],
    ['light' as const, 'light' as const, 'Light', 'sunny-outline'],
    ['system' as const, 'dark' as const, 'Automatic', 'moon-outline'],
  ])('shows the %s setting with its glyph and opens the theme sheet', (pref, scheme, label, glyph) => {
    state.pref = pref;
    state.scheme = scheme;
    draw();
    const row = screen.getByText('Appearance').parentElement!;
    expect(row.textContent).toContain(label);
    expect(row.querySelector(`[data-icon="${glyph}"]`)).toBeTruthy();
    press('Appearance');
    fireEvent.click(screen.getByText('close-theme'));
    expect(screen.queryByText('close-theme')).toBeNull();
  });

  it('heads the members settings "Preferences" and the app card "App"', () => {
    draw();
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('App')).toBeTruthy();
    expect(screen.queryByText('Legal')).toBeNull();
  });

  it('says "Ứng dụng" over the app card in Vietnamese', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Ứng dụng')).toBeTruthy();
    expect(screen.queryByText('Pháp lý')).toBeNull();
  });
});

// The welcome's always-show switch was here while the sheet was being
// worked on. It went with the rule that the welcome is for guests alone:
// a reader cannot be shown it twice, so there is nothing to switch.
describe('settings, without the welcome switch', () => {
  it('has no always-show-welcome row', () => {
    draw();
    expect(screen.queryByText('Always show welcome')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

describe('app card', () => {
  it.each([
    ['Terms of Service', 'close-legal-terms'],
    ['Privacy Policy', 'close-legal-privacy'],
  ])('"%s" raises its own document and closes it', (row, closer) => {
    state.session = null;
    draw();
    expect(screen.queryByText(/close-legal/)).toBeNull();
    press(row);
    fireEvent.click(screen.getByText(closer));
    expect(screen.queryByText(/close-legal/)).toBeNull();
  });
});

// The third row of the app card, on both views: which copy of the app
// this is, for the reader asked "which version are you on?". One card
// with the documents, not a card of its own, which read as a stray.
describe('about row', () => {
  it.each([['signed in', true], ['a guest', false]])('sits under the two documents in the same card, %s', (_who, signedIn) => {
    if (!signedIn) state.session = null;
    draw();
    const rows = ['Terms of Service', 'Privacy Policy', 'About City Crew'].map((name) => button(name));
    expect(new Set(rows.map((r) => r.parentElement)).size).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].compareDocumentPosition(rows[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it.each([['signed in', true], ['a guest', false]])('opens the about sheet and closes it, %s', (_who, signedIn) => {
    if (!signedIn) state.session = null;
    draw();
    expect(screen.queryByText('close-about')).toBeNull();
    press('About City Crew');
    fireEvent.click(screen.getByText('close-about'));
    expect(screen.queryByText('close-about')).toBeNull();
  });
});

// The last row of Preferences: every collection tip back, for whoever is
// reading. See `lib/tips` for why they retire and `TipBox.resetTips` for
// what this does.
describe('show tips again', () => {
  const storage = async () => (await import('@react-native-async-storage/async-storage')).default;
  const retiredAll = JSON.stringify({ seq: 9, last: {}, shown: {}, retired: ['reorder', 'publish', 'edit', 'add'] });

  // With how the app speaks and looks, not under App, where it read as
  // something about the build.
  it.each([['signed in', true], ['a guest', false]])('sits last in Preferences, after Appearance, %s', (_who, signedIn) => {
    if (!signedIn) state.session = null;
    draw();
    const appearance = button('Appearance');
    const again = button('Show tips again');
    expect(again.parentElement).toBe(appearance.parentElement);
    expect(appearance.compareDocumentPosition(again) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(again.nextElementSibling).toBeNull();
    expect(again.parentElement).not.toBe(button('About City Crew').parentElement);
    // Appearance is no longer the last row, so it keeps its divider, and
    // the new last row draws none. Read off react-native-web's atomic
    // class for the property: jsdom does not resolve those rules.
    const divided = (row: HTMLElement) => row.outerHTML.includes('r-borderBottomWidth');
    expect(divided(appearance)).toBe(true);
    expect(divided(again)).toBe(false);
  });

  // "tip", the word the owner reads them by, not "mẹo".
  it('is called "Hiện lại các tip" in Vietnamese', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Hiện lại các tip')).toBeTruthy();
    expect(screen.queryByText('Hiện lại các mẹo')).toBeNull();
  });

  it('brings back the signed-in reader\'s tips, and says so on the row', async () => {
    const s = await storage();
    await s.setItem('tips.v1:me', retiredAll);
    await s.setItem('tips.v1', retiredAll);
    draw();
    expect(button('Show tips again').textContent).not.toContain('Done');
    await act(async () => { press('Show tips again'); });
    expect(await s.getItem('tips.v1:me')).toBeNull();
    // Not the guest's record: that is somebody else's.
    expect(await s.getItem('tips.v1')).toBe(retiredAll);
    await waitFor(() => expect(button('Show tips again').textContent).toContain('Done'));
  });

  it('brings back a guest\'s tips', async () => {
    state.session = null;
    const s = await storage();
    await s.setItem('tips.v1', retiredAll);
    draw();
    await act(async () => { press('Show tips again'); });
    expect(await s.getItem('tips.v1')).toBeNull();
  });
});

describe('ways out', () => {
  it('calls signOut, with a spinner in place of the word until it settles', async () => {
    let finish!: () => void;
    spies.signOut.mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    draw();
    press('Sign out');
    expect(spies.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sign out')).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    await act(async () => { finish(); });
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('ignores a second tap while the first sign-out is in flight', async () => {
    let finish!: () => void;
    spies.signOut.mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    draw();
    press('Sign out');
    // Still findable by name with the spinner in the word's place.
    expect(button('Sign out').getAttribute('aria-disabled')).toBe('true');
    press('Sign out');
    press('Sign out');
    expect(spies.signOut).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    press('Sign out');
    expect(spies.signOut).toHaveBeenCalledTimes(2);
  });

  it('gives the word back when signing out fails', async () => {
    let fail!: (e: Error) => void;
    spies.signOut.mockImplementation(() => new Promise<void>((_, rej) => { fail = rej; }));
    // Listened for rather than tolerated: a failure that escapes the
    // handler is one the reader never hears about.
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    draw();
    press('Sign out');
    expect(screen.queryByText('Sign out')).toBeNull();
    await act(async () => { fail(new Error('offline')); });
    await waitFor(() => expect(screen.getByText('Sign out')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', onUnhandled);
    expect(alert).toHaveBeenCalledWith('Could not sign out', 'offline');
    expect(onUnhandled).not.toHaveBeenCalled();
  });

  it('opens the Delete account screen rather than deleting anything here', () => {
    const { raw } = draw();
    press('Delete account');
    expect(raw.navigate).toHaveBeenCalledWith('DeleteAccount');
    expect(spies.signOut).not.toHaveBeenCalled();
  });

  // The trip's delete control, worn here too: a destructive act looks the
  // same wherever the app offers one — a small outlined pill, centred,
  // never the breadth of an offer.
  it('wears the trip’s delete control: a centred, outlined pill', () => {
    draw();
    // `PressableScale` puts `style` on the animated view inside the
    // pressable, which is where the pill is drawn.
    const style = getComputedStyle(screen.getByTestId('profile-delete-account').firstElementChild!);
    expect(style.alignSelf).toBe('center');
    expect(style.flexDirection).toBe('row');
    expect(style.borderTopWidth).toBe('1px');
  });
});

// Its tab pressed again at this root scrolls back to the top. The press
// is React Navigation's to hear; what is this screen's is the ref, and a
// ref left off the list would hand over null and scroll nothing.
describe('its tab, pressed again', () => {
  it('hands the scroll to the top the screen’s own list', async () => {
    draw();
    const ref = vi.mocked(useScrollToTop).mock.calls.at(-1)?.[0] as { current: unknown };
    expect(ref.current).toHaveProperty('scrollTo');
  });
});
