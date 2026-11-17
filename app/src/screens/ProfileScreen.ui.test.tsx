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

import type { Pref } from '../lib/look';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommonActions, StackRouter } from '@react-navigation/routers';
import { act, cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf, waitFor, within } from '../uitest/render';
import { CATEGORIES } from '../lib/categories';
import { colors } from '../theme';
import { useScrollToTop } from '@react-navigation/native';
import type { Nav } from '../nav';

const guide = vi.hoisted(() => ({ enabled: false, setEnabled: vi.fn(), replay: vi.fn(), notice: null as 'ready' | 'off' | null, noticeTop: null as number | null }));
vi.mock('../components/SignupTour', () => ({ useSignupTour: () => guide }));

type Lang = 'en' | 'vi' | 'ja';

// `Alert` from react-native-web is a silent no-op, so a failed sign-out is
// caught at the import the screen actually uses.
const alert = vi.hoisted(() => vi.fn<(title: string, body?: string) => void>());
// And a window with a height: jsdom's has none, and the sheet behind
// "Lv" takes a share of it (`HeroFace`'s `ROOM`).
vi.mock('react-native', async (orig) => {
  const real = await orig<typeof import('react-native')>();
  return {
    ...real,
    Alert: { alert },
    useWindowDimensions: () => ({ ...real.useWindowDimensions(), height: 852 }),
  };
});
// The root ref only; the route types stay real.
const goTo = vi.hoisted(() => vi.fn());
vi.mock('../nav', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  goTo,
}));

const state = vi.hoisted(() => ({
  guide: false,
  editor: false,
  lang: 'en' as 'en' | 'vi' | 'ja' | 'zh' | 'zh-Hant',
  scheme: 'dark' as 'dark' | 'light',
  pref: 'dark' as Pref,
  ready: true,
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  email: 'minh.le@example.com' as string | null,
  profile: {} as { full_name?: string; handle?: string; bio?: string; location?: string },
  memberSince: null as Date | null,
  ships: [] as { requester: string; addressee: string; status: string; created_at: string }[],
  categories: [] as string[],
  mine: [] as { members: { slug: string }[] }[],
  trips: [] as { id: string }[],
  // Loaded and fine unless a test says otherwise — the case every older
  // test assumes.
  // The check-ins and the friendships are the other two counts since 16
  // Nov 2026; a test that names neither has them loaded.
  counts: { mineLoaded: true, mineError: null, tripsLoaded: true, tripsError: null } as {
    mineLoaded: boolean; mineError: string | null; tripsLoaded: boolean; tripsError: string | null;
    visitsLoaded?: boolean; visitsError?: string | null; shipsLoaded?: boolean; shipsError?: string | null;
  },
  city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as
    { short_en: string; short_vi: string; short_ja: string } | null,
  mode: 'manual' as 'auto' | 'manual',
  checkins: [] as { id: string; place_slug: string; city_id: string | null; at: string }[],
  feed: 0,
  /** Where a theme's restart left the reader, on the launch that is one. */
  resume: null as { tab: string; sheet?: 'theme'; y?: number; at: number } | null,
}));

const spies = vi.hoisted(() => ({
  signOut: vi.fn(async () => {}),
  reload: vi.fn(),
  prefsFor: vi.fn(),
  /** What the theme sheet is told about where the page is, when it asks. */
  returnTo: vi.fn(),
  /** The tab bar's scroll listener, when the screen has one. */
  duck: undefined as undefined | ((e: unknown) => void),
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
vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({
      ready: state.ready,
      session: state.session,
      email: state.email,
      profile: state.profile,
      memberSince: state.memberSince,
      signOut: spies.signOut,
    }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/data', () => ({
  // Own collections carry their members, which is the only path the
  // screen relies on (it passes an empty catalog on purpose).
  membersOf: (c: { members: { slug: string }[] }) => c.members,
  useMyPreferences: (uid: string | null) => {
    spies.prefsFor(uid);
    return { data: { categories: state.categories }, reload: spies.reload };
  },
}));
vi.mock('../lib/checkins', () => ({
  useMyCheckins: () => ({ data: state.checkins, loaded: state.counts.visitsLoaded ?? true, error: state.counts.visitsError ?? null, reload: reloads.visits }),
}));
vi.mock('../lib/useActivityCount', () => ({ useActivityCount: () => state.feed }));
vi.mock('../lib/crew', () => ({
  useCrew: () => ({ ships: { data: state.ships, loaded: state.counts.shipsLoaded ?? true, error: state.counts.shipsError ?? null, reload: reloads.ships } }),
}));
const reloads = vi.hoisted(() => ({ mine: vi.fn(), trips: vi.fn(), visits: vi.fn(), ships: vi.fn() }));
vi.mock('../lib/save', () => {
  const useSave = () => ({ mine: { data: state.mine, loaded: state.counts.mineLoaded, error: state.counts.mineError, reload: reloads.mine } });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
vi.mock('../lib/mytrips', () => ({ useMyTrips: () => ({ data: state.trips, loaded: state.counts.tripsLoaded, error: state.counts.tripsError, reload: reloads.trips }) }));
vi.mock('../lib/city', () => {
  const m = { useCity: () => ({ city: state.city, mode: state.mode }) };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../lib/theme', () => ({
  useScheme: () => ({ scheme: state.scheme, pref: state.pref, setPref: () => {}, ready: true, claimResume: () => state.resume }),
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => spies.duck }));

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
  ThemeSwitcherModal: ({ visible, onClose, returnTo }: SheetProps & { returnTo?: () => unknown }) =>
    (visible ? (
      <>
        <button type="button" onClick={onClose}>close-theme</button>
        <button type="button" onClick={() => spies.returnTo(returnTo?.())}>return-to</button>
      </>
    ) : null),
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
  default: ({ level, progress, fresh, onExplain, children }: { level: number; progress: number; fresh?: boolean; onExplain: () => void; children: React.ReactNode }) => (
    <div data-testid="ring" data-level={level} data-progress={progress} data-fresh={String(!!fresh)}>
      {children}
      {/* The pill, which the real ring makes a press. */}
      <button type="button" data-testid="ring-explain" onClick={onExplain} />
    </div>
  ),
}));

// The one copy of the reader's badges (`lib/rewards`): what this screen
// does with it is open its sheet, and say when it opened and closed.
const rewards = vi.hoisted(() => ({
  facts: null as Record<string, number> | null,
  unseen: [] as string[],
  wanted: false,
  opened: vi.fn(),
  closed: vi.fn(),
}));
vi.mock('../lib/rewards', async () => {
  const { NO_FACTS, earnedBadges } = await import('../lib/badges');
  return {
    useRewards: () => {
      const facts = { ...NO_FACTS, ...rewards.facts };
      return { facts, earned: earnedBadges(facts), unseen: rewards.unseen, wanted: rewards.wanted, opened: rewards.opened, closed: rewards.closed };
    },
  };
});

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

/** A section's heading: the words where they are not a control's. */
const heading = (text: string) => screen.getAllByText(text).find((e) => !e.closest('[role="button"]'))!;

// A button whose accessible name *starts* with these words: rows carry a
// sentence or a value after their title, and that is part of the name.
const button = (start: string) =>
  screen.getByRole('button', { name: new RegExp(`^${start}`) });
const press = (start: string) => fireEvent.click(button(start));

beforeEach(async () => {
  rewards.facts = null; rewards.unseen = []; rewards.wanted = false;
  guide.enabled = false; guide.setEnabled.mockClear(); guide.replay.mockClear(); guide.notice = null; guide.noticeTop = null;
  vi.clearAllMocks();
  state.resume = null;
  state.guide = false;
  state.checkins = [];
  state.feed = 0;
  state.editor = false;
  state.trips = [];
  state.counts = { mineLoaded: true, mineError: null, tripsLoaded: true, tripsError: null };
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
  // The tab is Account (owner, 17 Nov 2026): email, theme, language and
  // delete live here. "Profile" / "Trang cá nhân" is the page other
  // people open.
  it('is headed "Tài khoản" in Vietnamese, not the name of the page others see', () => {
    state.ready = false;
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Tài khoản')).toBeTruthy();
    expect(screen.queryByText('Cá nhân')).toBeNull();
    expect(screen.queryByText('Trang cá nhân')).toBeNull();
  });

  it('shows only a spinner while auth is still being read, and neither persona', () => {
    state.ready = false;
    draw();
    expect(screen.getByText('Account')).toBeTruthy();
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
    expect(screen.queryByText('Create a new account')).toBeNull();
  });
});

describe('guest hub', () => {
  beforeEach(() => { state.session = null; });

  it('sends the primary button to SignIn', () => {
    const { raw } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(raw.navigate).toHaveBeenCalledWith('SignIn');
    expect(raw.navigate).not.toHaveBeenCalledWith('SignUp');
  });

  // The way in for somebody new, one tap and no detour through Sign in.
  // It took the place of "Keep exploring", which the tab bar already is.
  it('opens Sign up straight from the line under the button, and offers no way back to Explore', () => {
    const { raw, parent } = draw();
    press('Create a new account');
    expect(raw.navigate).toHaveBeenCalledWith('SignUp');
    expect(raw.navigate).not.toHaveBeenCalledWith('SignIn');
    expect(screen.queryByText('Keep exploring')).toBeNull();
    expect(parent.navigate).not.toHaveBeenCalled();
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
  // The bio left the hero on 16 Nov 2026: that line is cut at two, and a
  // bio is a paragraph. It is the first row of About me, whole.
  it('shows the name and the handle in the hero, and the bio whole in About me', () => {
    const long = 'Coffee first. '.repeat(11).trim();
    state.profile = { full_name: 'Le Minh', handle: 'leminh', bio: long };
    draw();
    expect(screen.getByText('Le Minh')).toBeTruthy();
    const handle = screen.getByText('@leminh');
    // The handle stands alone: no dot, and nothing of the bio beside it.
    expect(handle.textContent).toBe('@leminh');
    expect(handle.parentElement!.textContent).not.toContain('Coffee');
    expect(screen.queryByText(/·/)).toBeNull();
    // Said once on the page, in the card, before the facts — and not cut.
    expect(screen.getAllByText(long)).toHaveLength(1);
    const bio = screen.getByTestId('profile-bio');
    expect(bio.textContent).toBe(long);
    const card = bio.closest('[data-testid="bio-row"]')!;
    // On the card's glyph column like the facts under it: one mark, the
    // feather (owner, 17 Nov 2026; a pair of quotation marks the day
    // before, and a speech bubble for that morning): a few lines the
    // person wrote. The bubble is left to mean a message.
    expect(card.querySelectorAll('[data-testid="row-glyph"]')).toHaveLength(1);
    expect(card.querySelector('[data-testid="row-glyph"] [data-icon="quill"]')).toBeTruthy();
    expect(card.querySelector('[data-icon="quote"], [data-icon="speech"], [data-icon^="chatbubble"]')).toBeNull();
    const email = screen.getByTestId('profile-email');
    expect(card.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('bio-add')).toBeNull();
  });

  it('offers "Write a few words about you" where the bio would be, and opens the editor on that field', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh' };
    const { raw } = draw();
    expect(screen.queryByTestId('bio-row')).toBeNull();
    const add = screen.getByTestId('bio-add');
    // The mark the filled row wears, so filling it in does not change it.
    expect(add.querySelector('[data-testid="row-glyph"] [data-icon="quill"]')).toBeTruthy();
    const email = screen.getByTestId('profile-email');
    expect(add.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText('Write a few words about you'));
    expect(raw.navigate).toHaveBeenCalledWith('EditProfile', { focus: 'bio' });
  });

  // The page's second heading (owner, 14 Nov 2026): under "Profile" at
  // 30, the name at 20, in the system face's bold.
  it('sets the name at 20, a step under the tab\'s title', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh' };
    draw();
    expect(textStyleOf(screen.getByText('Le Minh'))).toMatchObject({ fontSize: 20, lineHeight: 25 });
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

  it('shows City and Member since only when they are known', () => {
    draw();
    expect(screen.queryByText('City')).toBeNull();
    expect(screen.queryByText('Member since')).toBeNull();
  });

  it('shows City and an English month for Member since', () => {
    state.profile = { location: 'Da Nang' };
    state.memberSince = new Date(2025, 2, 14);
    draw();
    expect(screen.getByText('City')).toBeTruthy();
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
    const about = screen.getByText('City').closest('[data-testid="about-row"]');
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
    const about = slotOf('City', 'about-row');
    expect(parseFloat(about.height)).toBeGreaterThan(19);
    expect(parseFloat(about.marginTop) + parseFloat(about.height) / 2).toBeCloseTo(15 / 2, 5);
    const friends = slotOf('Connect with friends', 'feature-row');
    expect(parseFloat(friends.marginTop) + parseFloat(friends.height) / 2).toBeCloseTo(19 / 2, 5);
  });

  it.each([
    ['vi' as const, 'Thành viên từ', 'Tháng 3, 2025'],
    ['ja' as const, '登録日', '2025年3月'],
    // The label has no Chinese yet and reads in English; the date is
    // written the Chinese way already.
    ['zh' as const, 'Member since', '2025年3月'],
    ['zh-Hant' as const, 'Member since', '2025年3月'],
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

  // On the facts card's column, its name by its glyph (owner, 3 Nov
  // 2026): the first glyph centred where the envelope's is — the middle of
  // a 44pt slot from the card's edge, so the row starts (44 − 19) / 2 in —
  // each name 8pt after its glyph, the next interest 24 on. The glyphs at
  // the About rows' size and in their ink. No pill, and not a control.
  it('puts the first glyph on the About rows\u2019 column and each name by its glyph, as a fact', () => {
    state.categories = ['cafes', 'views'];
    draw();
    const item = screen.getByTestId('interest-cafes');
    expect(item.getAttribute('role')).toBeNull();
    expect(getComputedStyle(item).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const row = item.parentElement!;
    const envelope = document.querySelector('[data-icon="mail-outline"]')!;
    const slot = parseFloat(getComputedStyle(envelope.parentElement!).width);
    const glyph = item.querySelector('[data-icon]')!;
    const size = Number(glyph.getAttribute('data-size'));
    expect(size).toBe(Number(envelope.getAttribute('data-size')));
    // The first glyph's middle is the envelope's: half the slot in.
    expect(parseFloat(getComputedStyle(row).paddingLeft) + size / 2).toBe(slot / 2);
    expect(getComputedStyle(row).paddingLeft).toBe('12.5px');
    expect(glyph.getAttribute('data-icon')).toBe(CATEGORIES.cafes.icon);
    // In the column's own ink, as the envelope is — neutral, as Search's
    // category glyphs are at rest.
    expect(glyph.getAttribute('data-color')).toBe(envelope.getAttribute('data-color'));
    expect(glyph.getAttribute('data-color')).not.toBe(CATEGORIES.cafes.color);
    // The name by its glyph; the next interest 12, a faint rule, 12 on.
    expect(getComputedStyle(item).columnGap || getComputedStyle(item).gap).toBe('8px');
    expect(getComputedStyle(row).columnGap).toBe('12px');
    expect(within(screen.getByTestId('interest-views')).getByText('Views')).toBeTruthy();
  });

  // The faint rule between two interests (owner, 3 Nov 2026): one between
  // each pair, none after the last, and none where the next has wrapped
  // to a new line — still taking its room, so nothing moves back.
  it('draws a faint rule between interests on one line, and none at a line\u2019s end', () => {
    state.categories = ['cafes', 'views', 'eats'];
    draw();
    const rules = screen.getAllByTestId('interest-rule');
    expect(rules).toHaveLength(2);
    expect(screen.getByTestId('interest-cafes').contains(rules[0])).toBe(true);
    expect(screen.getByTestId('interest-eats').querySelector('[data-testid="interest-rule"]')).toBeNull();
    const rule = getComputedStyle(rules[0]);
    expect(rule.height).toBe('18px');
    expect(rule.opacity).not.toBe('0');
    expect(rule.backgroundColor).toBe(String(colors.borderGlassSoft).replace(/,(?=\S)/g, ', '));
    // Laid out: cafes and views on the first line, eats wrapped below.
    type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
    const layOut = (testID: string, y: number) => {
      const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
      const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
      const stack: Fiber[] = [host[key].stateNode.current];
      while (stack.length) {
        const f = stack.pop()!;
        const p = f.memoizedProps;
        if (p && p.testID === testID && typeof p.onLayout === 'function') {
          act(() => { (p.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y, width: 100, height: 24 } } }); });
          return;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      throw new Error(`no ${testID}`);
    };
    layOut('interest-cafes', 0);
    layOut('interest-views', 0);
    layOut('interest-eats', 36);
    const [first, second] = screen.getAllByTestId('interest-rule');
    expect(getComputedStyle(first).opacity).not.toBe('0');
    expect(getComputedStyle(second).opacity).toBe('0');
    // The same top again changes nothing.
    layOut('interest-eats', 36);
    expect(getComputedStyle(screen.getAllByTestId('interest-rule')[1]).opacity).toBe('0');
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

// The reader's standing, as a small disc after the name (owner, 17 Nov
// 2026; on the avatar's top-right corner before that). Editor outranks
// guide and is shown alone; a reader with neither wears none; a tap
// explains the grant in the desk's words.
describe('the role badge', () => {
  const badge = (name: RegExp | string) => screen.getByRole('button', { name });
  // The disc: the box the glyph stands in.
  const discOf = (name: string) => badge(name).querySelector('[data-icon]')!.parentElement!;

  it('is absent for a reader with no grant, and the name stands as it does with one', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh' };
    draw();
    expect(screen.queryByRole('button', { name: /Local Guide|Super User/ })).toBeNull();
    expect(screen.queryByTestId('role-badge')).toBeNull();
    expect(screen.queryByTestId('role-mark')).toBeNull();
    // The row is there before the answer is, so a disc arriving a round
    // trip late is added after the name and moves nothing.
    expect(screen.getByTestId('role-row').contains(screen.getByText('Le Minh'))).toBe(true);
  });

  it('stands after the name, on its first line, and not on the picture', () => {
    state.guide = true;
    state.profile = { full_name: 'Le Minh', handle: 'leminh' };
    draw();
    const disc = badge('Local Guide');
    expect(screen.getByTestId('avatar-box').contains(disc)).toBe(false);
    // One row: the name, then the mark, 6 apart, from the top so a
    // second line of name falls under the first.
    const row = screen.getByTestId('role-row');
    const name = screen.getByText('Le Minh');
    expect(row.contains(name)).toBe(true);
    expect(row.contains(disc)).toBe(true);
    expect(name.compareDocumentPosition(disc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const lay = viewStyleOf(row);
    expect([lay.flexDirection, lay.alignItems, lay.gap]).toEqual(['row', 'flex-start', 6]);
    // The handle is under the row, not in it.
    expect(row.contains(screen.getByText('@leminh'))).toBe(false);
    // A long name gives way; the mark does not.
    expect(viewStyleOf(row.firstElementChild!).flexShrink).toBe(1);
    expect(viewStyleOf(screen.getByTestId('role-mark')).flexShrink).toBeUndefined();
    // In the middle of the name's first line: the line is 25 here.
    const mark = viewStyleOf(screen.getByTestId('role-mark'));
    expect([mark.height, mark.justifyContent, mark.position]).toEqual([25, 'center', undefined]);
    expect(textStyleOf(name)?.lineHeight).toBe(25);
    // 20, not the 24 it was on the picture, and its glyph in proportion.
    const box = viewStyleOf(discOf('Local Guide'));
    expect([box.width, box.height, box.borderRadius]).toEqual([20, 20, 10]);
    expect(disc.querySelector('[data-icon="star"]')!.getAttribute('data-size')).toBe('11');
    // And the thumb is still owed 44 of it: the press's own slop, read
    // off the component that set it.
    type Fiber = { memoizedProps?: { hitSlop?: unknown }; return?: Fiber };
    let f: Fiber | undefined = (disc as unknown as Record<string, Fiber>)[Object.keys(disc).find((k) => k.startsWith('__reactFiber'))!];
    while (f && typeof f.memoizedProps?.hitSlop !== 'number') f = f.return;
    expect(20 + 2 * (f!.memoizedProps!.hitSlop as number)).toBe(44);
    // A mark, not a message: its name is not written on the page.
    expect(screen.queryByText('Local Guide')).toBeNull();
  });

  it('names a local guide, and says what the grant lets them do', () => {
    state.guide = true;
    draw();
    fireEvent.click(badge('Local Guide'));
    // In the sheet the level opens too (16 Nov 2026), not a system alert:
    // the disc that was pressed, its name, then what it lets them do.
    expect(alert).not.toHaveBeenCalled();
    const head = screen.getByTestId('badge-sheet-head');
    expect(head.textContent).toBe('Local Guide');
    expect(head.querySelector('[data-icon="star"]')).toBeTruthy();
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('You can edit, and add photos to, places in your collections and places you imported.');
    // A role's sheet draws no level: no bar, no steps.
    expect(screen.queryByTestId('level-bar')).toBeNull();
    expect(screen.queryByTestId('level-steps')).toBeNull();
  });

  it('names an editor as Super User, and only that, even when also a guide', () => {
    state.guide = true;
    state.editor = true;
    draw();
    expect(screen.queryByRole('button', { name: 'Local Guide' })).toBeNull();
    const disc = badge('Super User');
    expect(disc.querySelector('[data-icon="medal"]')).toBeTruthy();
    fireEvent.click(disc);
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByTestId('badge-sheet-head').textContent).toBe('Super User');
    expect(screen.getByTestId('badge-sheet-head').querySelector('[data-icon="medal"]')).toBeTruthy();
    expect(screen.getByTestId('badge-sheet-body').textContent).toMatch(/every place in the app/);
    // Its sentence justified in the box, as a list's description is
    // (owner, 17 Nov 2026): ragged, it read as weighted to one side.
    expect(textStyleOf(screen.getByTestId('badge-sheet-body').firstElementChild as HTMLElement)?.textAlign).toBe('justify');
  });

  // Two roles, two colours: the disc's edge and glyph follow the role,
  // and an editor who is also a guide wears the editor's, not the guide's.
  // react-native-web writes colours as classes, which jsdom's computed
  // style does not resolve, so the class list is what is compared.
  it('wears a different colour for each role, the editor’s when both apply', () => {
    const dress = (name: string) => discOf(name).className;
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

// Four numbers under the hero, each a door into the place that holds it:
// Collections, Check-ins, Friends, Trips (owner, 16 Nov 2026). "Saved
// places" was the second until then — a detail of the collections beside
// it, opening the same list.
describe('the four doors', () => {
  const p = (slug: string) => ({ slug });
  const edge = (requester: string, addressee: string, status: string) =>
    ({ requester, addressee, status, created_at: '2026-01-01' });

  it('counts collections, places checked in at, friends and trips, in that order', () => {
    state.mine = [{ members: [p('a'), p('b')] }, { members: [p('a'), p('c')] }];
    state.trips = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    // Two evenings at one place and one at another: two places.
    state.checkins = [
      { id: 'a', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00Z' },
      { id: 'b', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-01T03:00:00Z' },
      { id: 'c', place_slug: 'pizza', city_id: 'saigon', at: '2026-09-20T03:00:00Z' },
    ];
    // Accepted, and this account's: not a request, not strangers' edges.
    state.ships = [
      edge('me', 'a', 'accepted'), edge('b', 'me', 'accepted'), edge('f', 'me', 'accepted'), edge('g', 'me', 'accepted'),
      edge('me', 'c', 'pending'), edge('x', 'y', 'accepted'),
    ];
    draw();
    const tiles = ['2 Collections', '2 Check-ins', '4 Friends', '3 Trips'].map((name) => screen.getByRole('button', { name }));
    expect(new Set(tiles.map((x) => x.parentElement!.parentElement)).size).toBe(1);
    for (let i = 1; i < tiles.length; i++) {
      expect(tiles[i - 1].compareDocumentPosition(tiles[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Not drawn, though the level is still made of it (`the level ring`).
    expect(screen.queryByText('Saved places')).toBeNull();
    // No review count: there is no review feature.
    expect(screen.queryByText(/Reviews/)).toBeNull();
  });

  // UX-09: a bare `navigate(tab)` restored the tab where it was left, so
  // "48 Saved places" opened whichever collection had been open. Each
  // door now lands on its tab's list — popped back to, aimed at Yours for
  // the two collection counts, with a fresh `at` that scrolls it to the top.
  // 22 was the section headings' size, and four of them in a row were
  // the loudest thing on the page (owner, 16 Nov 2026).
  it('sets the numbers under the headings’ size and over their labels’', () => {
    state.mine = [{ members: [p('a')] }];
    draw();
    const tile = screen.getByRole('button', { name: '1 Collections' });
    const [n, label] = [...tile.querySelectorAll('[dir]')].map((e) => Number(textStyleOf(e as HTMLElement)?.fontSize));
    expect(n).toBe(18);
    expect(n).toBeLessThan(Number(textStyleOf(screen.getByText('About me'))?.fontSize));
    expect(n).toBeGreaterThan(label);
  });

  it('opens the list each number lives in, at its top, whatever was open there', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const { raw, parent } = draw();
    const toList = { screen: 'CollectionsHome', params: { tab: 'yours', at: 1234 }, pop: true };
    fireEvent.click(screen.getByRole('button', { name: '0 Collections' }));
    expect(parent.navigate).toHaveBeenLastCalledWith('Collections', toList);
    fireEvent.click(screen.getByRole('button', { name: '0 Trips' }));
    expect(parent.navigate).toHaveBeenLastCalledWith('Trips', { screen: 'TripsHome', params: { at: 1234 }, pop: true });
    expect(parent.navigate).toHaveBeenCalledTimes(2);
    // The two tabs, and nothing pushed over this page for them.
    expect(raw.navigate).not.toHaveBeenCalled();
  });

  // Check-ins and Friends are pages pushed over this one, the pages the
  // rows further down open: each lists exactly what its number counts.
  it('opens the check-ins and the crew from their numbers, each its own page', () => {
    const { raw, parent } = draw();
    fireEvent.click(screen.getByRole('button', { name: '0 Check-ins' }));
    expect(raw.navigate).toHaveBeenCalledExactlyOnceWith('Visited');
    fireEvent.click(screen.getByRole('button', { name: '0 Friends' }));
    expect(raw.navigate).toHaveBeenLastCalledWith('Crew');
    expect(raw.navigate).toHaveBeenCalledTimes(2);
    expect(parent.navigate).not.toHaveBeenCalled();
  });

  it('says the four in Vietnamese', () => {
    state.lang = 'vi';
    draw();
    for (const name of ['0 Bộ sưu tập', '0 Check-in', '0 Bạn bè', '0 Chuyến đi']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.queryByText('Địa điểm đã lưu')).toBeNull();
  });

  it('takes the same door through the root when there is no parent', () => {
    const r = nav();
    r.raw.getParent.mockReturnValue(undefined as never);
    render(<ProfileScreen navigation={r.n} />);
    fireEvent.click(screen.getByRole('button', { name: '0 Trips' }));
    expect(goTo).toHaveBeenCalledWith('Trips', expect.objectContaining({ screen: 'TripsHome', pop: true }));
  });

  // What `pop` buys, read off the router itself rather than assumed: in
  // React Navigation 7 a `navigate` to a screen already beneath the top
  // of a stack pushes a second copy of it, and only `pop` goes back to it.
  it('relies on `pop` to close the collection that was open', () => {
    const router = StackRouter({});
    const options = { routeNames: ['CollectionsHome', 'CollectionDetail'], routeParamList: {}, routeGetIdList: {} };
    const inDetail = router.getStateForAction(router.getInitialState(options), CommonActions.navigate('CollectionDetail', { slug: 'thao-dien' }), options)!;
    const go = (pop: boolean) => router.getStateForAction(
      inDetail as never,
      CommonActions.navigate({ name: 'CollectionsHome', params: { tab: 'yours', at: 1 }, pop }),
      options,
    ) as { routes: { name: string }[] };
    expect(go(true).routes.map((r) => r.name)).toEqual(['CollectionsHome']);
    expect(go(false).routes.map((r) => r.name)).toEqual(['CollectionsHome', 'CollectionDetail', 'CollectionsHome']);
  });

  // UX-14: these read `data.length` off fetches still in flight, and a
  // reader with 11 lists and 55 trips signed in to three zeros. Not known
  // yet is a dash; a zero is only ever an answer.
  it('shows a dash, not a zero, for a count that has not loaded', () => {
    state.counts = { mineLoaded: false, mineError: null, tripsLoaded: false, tripsError: null, visitsLoaded: false, shipsLoaded: false };
    state.checkins = [{ id: 'k', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00Z' }];
    draw();
    for (const name of ['Collections', 'Check-ins', 'Friends', 'Trips']) {
      const tile = screen.getByRole('button', { name: `${name}, loading` });
      expect(tile.textContent).toBe(`—${name}`);
    }
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByTestId('stats-failed')).toBeNull();
  });

  it('shows each count as its own fetch lands', () => {
    state.trips = [{ id: 't1' }];
    state.counts = { mineLoaded: false, mineError: null, tripsLoaded: true, tripsError: null };
    draw();
    expect(screen.getByRole('button', { name: 'Collections, loading' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 Trips' })).toBeTruthy();
  });

  it('says a failed load failed, and retries only what is missing', () => {
    state.counts = { mineLoaded: true, mineError: null, tripsLoaded: false, tripsError: 'offline' };
    draw();
    expect(screen.getByText("Couldn't load your counts.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reloads.trips).toHaveBeenCalledOnce();
    expect(reloads.mine).not.toHaveBeenCalled();
    cleanup();
    reloads.trips.mockClear();
    state.counts = { mineLoaded: false, mineError: 'offline', tripsLoaded: true, tripsError: null };
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reloads.mine).toHaveBeenCalledOnce();
    expect(reloads.trips).not.toHaveBeenCalled();
    expect(reloads.visits).not.toHaveBeenCalled();
    expect(reloads.ships).not.toHaveBeenCalled();
  });

  // The two counts that joined the row fail the same way.
  it.each(['visits', 'ships'] as const)('says so when the %s could not be loaded, and asks for them alone', (which) => {
    state.counts = { mineLoaded: true, mineError: null, tripsLoaded: true, tripsError: null, [`${which}Loaded`]: false, [`${which}Error`]: 'offline' };
    draw();
    expect(screen.getByTestId('stats-failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reloads[which]).toHaveBeenCalledOnce();
    for (const other of ['mine', 'trips', 'visits', 'ships'] as const) {
      if (other !== which) expect(reloads[other]).not.toHaveBeenCalled();
    }
    cleanup();
    // A refresh failing over a count already shown says nothing.
    state.counts = { mineLoaded: true, mineError: null, tripsLoaded: true, tripsError: null, [`${which}Error`]: 'offline' };
    draw();
    expect(screen.queryByTestId('stats-failed')).toBeNull();
  });

  it('says nothing when a refresh fails over counts already shown', () => {
    state.counts = { mineLoaded: true, mineError: 'offline', tripsLoaded: true, tripsError: 'offline' };
    draw();
    expect(screen.queryByTestId('stats-failed')).toBeNull();
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

  // The pill says what the level is (owner, 16 Nov 2026), in the
  // reader's own numbers — the distinct places, not the lists' sizes
  // added up, and the count that left the row of numbers the same day.
  //
  // In a sheet, drawn: the level, a bar, what the next one takes, the
  // rule. It was a paragraph in a system alert for an hour.
  it('opens a sheet that draws the level when the pill is pressed, with the reader’s own count', () => {
    const p = (slug: string) => ({ slug });
    state.mine = [
      { members: [p('a'), p('b'), p('c')] },
      { members: [p('a'), p('d'), p('e'), p('f')] },
    ];
    draw();
    expect(screen.queryByTestId('badge-sheet-head')).toBeNull();
    fireEvent.click(screen.getByTestId('ring-explain'));
    expect(alert).not.toHaveBeenCalled();
    // Six distinct places: level 2, one of its five.
    expect(screen.getByTestId('badge-sheet-head').textContent).toBe('Level 2' + '1 / 5');
    // One frame, not two (owner, 16 Nov 2026): the title stands on the
    // sheet as other sheets' titles do, and the card is the words'.
    const head = viewStyleOf(screen.getByTestId('badge-sheet-head'));
    expect([head.borderWidth, head.backgroundColor]).toEqual([undefined, undefined]);
    expect(viewStyleOf(screen.getByTestId('badge-sheet-body')).borderWidth).toBe(1);
    const body = screen.getByTestId('badge-sheet-body');
    expect([...body.children].slice(1).map((c) => c.textContent)).toEqual([
      'Save 4 more places to reach Level 3.',
      'You have saved 6 places. Every 5 take you up a level.',
    ]);
  });

  // The bar is the ring's fraction — one fifth here, as the ring's
  // progress is — not the count over the next level's (6 of 10).
  it('fills the bar as far as the ring is turned', () => {
    const p = (slug: string) => ({ slug });
    state.mine = [{ members: ['a', 'b', 'c', 'd', 'e', 'f'].map(p) }];
    draw();
    fireEvent.click(screen.getByTestId('ring-explain'));
    const bar = screen.getByTestId('level-bar');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('1 of 5 places toward the next level');
    expect(viewStyleOf(screen.getByTestId('level-bar-fill')).width).toBe('20%');
    expect(Number(screen.getByTestId('ring').getAttribute('data-progress'))).toBeCloseTo(0.2);
    expect(bar.firstElementChild).toBe(screen.getByTestId('level-bar-fill'));
  });

  it('says it in Vietnamese', () => {
    state.lang = 'vi';
    draw();
    fireEvent.click(screen.getByTestId('ring-explain'));
    expect(screen.getByTestId('badge-sheet-head').textContent).toBe('Level 1' + '0 / 5');
    expect(screen.getByTestId('badge-sheet-body').textContent)
      .toBe('Lưu thêm 5 địa điểm để đạt Level 2.' + 'Bạn đã lưu 0 địa điểm. Cứ 5 địa điểm là lên một level.');
  });

  // One sheet for the two badges: it is about whichever was pressed, and
  // closes by its backdrop as every sheet in the app does.
  it('is about the badge that was pressed, and closes by the backdrop', async () => {
    // The backdrop, then the fade react-native-web runs before a closed
    // Modal leaves the page.
    const shut = async () => {
      fireEvent.click(screen.getByLabelText('Close'));
      document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
      await waitFor(() => expect(screen.queryByTestId('badge-sheet-head')).toBeNull());
    };
    state.guide = true;
    draw();
    fireEvent.click(screen.getByTestId('ring-explain'));
    expect(screen.getByTestId('badge-sheet-head').textContent).toContain('Level 1');
    await shut();
    fireEvent.click(screen.getByRole('button', { name: 'Local Guide' }));
    expect(screen.getByTestId('badge-sheet-head').textContent).toBe('Local Guide');
    await shut();
    // And the level again after a role: not left on the role.
    fireEvent.click(screen.getByTestId('ring-explain'));
    expect(screen.getByTestId('badge-sheet-head').textContent).toContain('Level 1');
  });

  it('starts a new account at level 1', () => {
    draw();
    expect(screen.getByTestId('ring').getAttribute('data-level')).toBe('1');
  });
});

// The nine badges, in the sheet behind "Lv" and nowhere else on the tab
// (owner, 17 Nov 2026) — `components/BadgeShelf` draws them, and
// `lib/rewards` holds them.
describe('the badges, under the level', () => {
  const shut = async () => {
    fireEvent.click(screen.getByLabelText('Close'));
    document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
    await waitFor(() => expect(screen.queryByTestId('badge-sheet-head')).toBeNull());
  };

  it('are not on the tab itself', () => {
    draw();
    expect(screen.queryByTestId('badge-shelf')).toBeNull();
  });

  it('are the sheet’s second card, after the level’s, with the reader’s own', () => {
    rewards.facts = { saved: 2, trips: 1 };
    draw();
    fireEvent.click(screen.getByTestId('ring-explain'));
    const level = screen.getByTestId('badge-sheet-body');
    const shelf = screen.getByTestId('badge-shelf');
    expect(level.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(level.parentElement).toBe(shelf.parentElement);
    expect(screen.getByTestId('badge-count').textContent).toBe('2 / 9');
    // The level's card is still the level's alone.
    expect(level.contains(shelf)).toBe(false);
    // Twelve between the two, as between the header and the first.
    expect(viewStyleOf(level.parentElement!).gap).toBe(12);
  });

  // A phone too short for both cards scrolls them, and leaves the page
  // showing above the sheet to close it by. The window here is 852 tall.
  it('scrolls the two cards within seven tenths of the screen', () => {
    draw();
    fireEvent.click(screen.getByTestId('ring-explain'));
    const scroll = screen.getByTestId('badge-shelf').parentElement!.parentElement!;
    expect(viewStyleOf(scroll).maxHeight).toBe(596);
    expect(Math.round(852 * 0.7)).toBe(596);
  });

  it('says when the sheet opened and when it closed, once each', async () => {
    draw();
    expect(rewards.opened).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ring-explain'));
    expect(rewards.opened).toHaveBeenCalledTimes(1);
    expect(rewards.closed).not.toHaveBeenCalled();
    await shut();
    expect(rewards.closed).toHaveBeenCalledTimes(1);
    expect(rewards.opened).toHaveBeenCalledTimes(1);
  });

  it('tells the pill when a badge is new, and not otherwise', () => {
    draw();
    expect(screen.getByTestId('ring').getAttribute('data-fresh')).toBe('false');
    cleanup();
    rewards.unseen = ['beenThere'];
    draw();
    expect(screen.getByTestId('ring').getAttribute('data-fresh')).toBe('true');
  });

  // The banner was pressed somewhere else in the app: it brought the
  // reader here and asks for the sheet.
  it('opens the sheet by itself when the banner asked for it', () => {
    rewards.wanted = true;
    draw();
    expect(screen.getByTestId('badge-sheet-head').textContent).toContain('Level 1');
    expect(screen.getByTestId('badge-shelf')).toBeTruthy();
    expect(rewards.opened).toHaveBeenCalledTimes(1);
  });

  it('stays shut when nothing asked', () => {
    draw();
    expect(screen.queryByTestId('badge-sheet-head')).toBeNull();
    expect(rewards.opened).not.toHaveBeenCalled();
  });
});

describe('friends card', () => {
  const edge = (requester: string, addressee: string, status: string) =>
    ({ requester, addressee, status, created_at: '2026-01-01' });

  it('opens the crew', () => {
    const { raw } = draw();
    // The heading, not the number under the hero that says the same word.
    fireEvent.click(heading('Friends'));
    expect(raw.navigate).not.toHaveBeenCalled();
    press('Connect with friends');
    expect(raw.navigate).toHaveBeenCalledWith('Crew');
    expect(screen.getByText('Make friends and plan together.')).toBeTruthy();
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
    // The owner's subtitle (28 Oct 2026): a log of your own acts too, not news alone.
    expect(screen.getByText('A log of your activity on City Crew.')).toBeTruthy();
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

  // The number of friends was a pill at this row's end until 16 Nov
  // 2026. It is a number under the hero now (`the four doors`), and a
  // figure said twice on one page is one of them wasted.
  it('carries no number: the friends are counted under the hero', () => {
    state.ships = [edge('me', 'a', 'accepted'), edge('b', 'me', 'accepted')];
    draw();
    const row = screen.getByText('Connect with friends').closest('[data-testid="feature-row"]')!;
    expect(row.querySelector('[data-testid="count-badge"]')).toBeNull();
    expect(row.textContent).toBe('Connect with friends' + 'Make friends and plan together.');
    expect(screen.getByRole('button', { name: '2 Friends' })).toBeTruthy();
  });

  // Ringed in the card's own colour, picked in JS by the app's scheme: a
  // `dyn` pair on a border follows the phone, so a light app on a dark
  // phone cut the dot out of a white card with a charcoal ring.
  it('rings the request dot in the card\u2019s colour for the app\u2019s theme', () => {
    const ring = () => {
      const card = screen.getByText('Connect with friends').parentElement!.parentElement!;
      return [...card.firstElementChild!.children].map((d) => (d as HTMLElement).style.borderTopColor).find(Boolean);
    };
    state.ships = [edge('x', 'me', 'pending')];
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    expect(ring()).toBe('rgb(21, 22, 20)'); // bgElevatedHex.dark, the charcoal sheet
    unmount();
    state.scheme = 'light';
    render(<ProfileScreen navigation={nav().n} />);
    expect(ring()).toBe('rgb(255, 255, 255)'); // bgElevatedHex.light
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

  // The third case carries the rule: on Auto the words follow the setting
  // while the glyph follows the ground the phone picked, so the row reads
  // "Automatic" beside a moon. The looks wear their own mark — a cup
  // is not a moon, though Coffee stands on the dark ground.
  it.each([
    ['dark' as const, 'dark' as const, 'Dark', 'moon-outline'],
    ['light' as const, 'light' as const, 'Light', 'sunny-outline'],
    ['system' as const, 'dark' as const, 'Automatic', 'moon-outline'],
    ['coffee' as const, 'dark' as const, 'Coffee', 'cafe-outline'],
    ['rose' as const, 'light' as const, 'Rose', 'flower-outline'],
    ['navy' as const, 'dark' as const, 'Navy', 'boat-outline'],
  ])('shows the %s setting with its glyph and opens the theme sheet', (pref, scheme, label, glyph) => {
    state.pref = pref;
    state.scheme = scheme;
    draw();
    const row = screen.getByText('Theme').parentElement!;
    expect(row.textContent).toContain(label);
    expect(row.querySelector(`[data-icon="${glyph}"]`)).toBeTruthy();
    press('Theme');
    fireEvent.click(screen.getByText('close-theme'));
    expect(screen.queryByText('close-theme')).toBeNull();
  });

  // The launch after a theme's restart: the sheet the reader chose from
  // is up again from the first frame, in the new colours, with nothing
  // to tap to get back to it.
  it('reopens the theme sheet from the first frame after a theme’s restart', () => {
    state.resume = { tab: 'Profile', sheet: 'theme', y: 300, at: Date.now() };
    draw();
    expect(screen.getByText('close-theme')).toBeTruthy();
  });

  // The card is rendered by both personas, so signing in or out replaces
  // it. The record is for the first frame of the run and must not reopen
  // the sheet on the next persona — which it did, every time.
  it('does not reopen the theme sheet when the card is replaced by a sign-out or sign-in', () => {
    state.resume = { tab: 'Profile', sheet: 'theme', y: 300, at: Date.now() };
    const r = nav();
    const { rerender } = render(<ProfileScreen navigation={r.n} />);
    fireEvent.click(screen.getByText('close-theme'));
    expect(screen.queryByText('close-theme')).toBeNull();

    state.session = null;
    rerender(<ProfileScreen navigation={r.n} />);
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.queryByText('close-theme')).toBeNull();

    state.session = { user: { id: 'other' } };
    rerender(<ProfileScreen navigation={r.n} />);
    expect(screen.queryByText('close-theme')).toBeNull();
  });

  it('opens no sheet on an ordinary launch, nor on one that came back to another tab', () => {
    draw();
    expect(screen.queryByText('close-theme')).toBeNull();
    cleanup();
    state.resume = { tab: 'Trips', at: Date.now() };
    draw();
    expect(screen.queryByText('close-theme')).toBeNull();
  });

  // Back to where the page was, once the content is tall enough to hold
  // it — and only once: a later growth is the reader's own page now.
  // jsdom lays nothing out, so the size change is reached where the screen
  // passes its handler.
  it('scrolls back to where the restart left the page, once the page is tall enough', () => {
    state.resume = { tab: 'Profile', sheet: 'theme', y: 300, at: Date.now() };
    draw();
    const el = screen.getByTestId('profile-scroll');
    const sized = (h: number) => {
      type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
      const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
      const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
      const stack: Fiber[] = [host[key].stateNode.current];
      while (stack.length) {
        const f = stack.pop()!;
        const p = f.memoizedProps;
        if (p && p.testID === 'profile-scroll' && typeof p.onContentSizeChange === 'function') {
          act(() => { (p.onContentSizeChange as (w: number, h: number) => void)(390, h); });
          return;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      throw new Error('no scroll view');
    };
    sized(200);
    expect(el.scrollTop).toBe(0);
    sized(500);
    expect(el.scrollTop).toBe(300);
    el.scrollTop = 40;
    sized(900);
    expect(el.scrollTop).toBe(40);
  });

  // What the sheet is told when it asks: this tab, this sheet, and how far
  // down the page is at that moment — read off the scroll as it happens,
  // and still handed on to the tab bar's own listener.
  it('tells the theme sheet where the page is, at the moment it asks', () => {
    spies.duck = vi.fn();
    draw();
    const el = screen.getByTestId('profile-scroll');
    el.scrollTop = 260;
    fireEvent.scroll(el);
    expect(spies.duck).toHaveBeenCalledTimes(1);
    press('Theme');
    fireEvent.click(screen.getByText('return-to'));
    expect(spies.returnTo).toHaveBeenCalledWith({ tab: 'Profile', sheet: 'theme', y: 260 });
    spies.duck = undefined;
  });

  // "Giao diện" in Vietnamese since 17 Oct 2026 (UX-07); the loanword
  // "Theme" was the one English word left heading a Vietnamese screen.
  it('names the row Giao diện in Vietnamese', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Giao diện')).toBeTruthy();
    expect(screen.queryByText('Theme')).toBeNull();
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
    // The one switch on the page is the tips' (17 Oct 2026).
    expect(screen.getAllByRole('switch').map((el) => el.getAttribute('aria-label'))).toEqual(['Show guide']);
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
    const rows = ['Terms of Service', 'Privacy Policy', 'Version info'].map((name) => button(name));
    expect(new Set(rows.map((r) => r.parentElement)).size).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].compareDocumentPosition(rows[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it.each([['signed in', true], ['a guest', false]])('opens the about sheet and closes it, %s', (_who, signedIn) => {
    if (!signedIn) state.session = null;
    draw();
    expect(screen.queryByText('close-about')).toBeNull();
    press('Version info');
    fireEvent.click(screen.getByText('close-about'));
    expect(screen.queryByText('close-about')).toBeNull();
  });
});

describe('highlight settings', () => {
  it('shows the guide switch without a subtitle', () => {
    draw();
    expect(screen.getByRole('switch', { name: 'Show guide' })).toBeTruthy();
    expect(screen.getByTestId('profile-tips').textContent).not.toContain('Short how-tos');
    fireEvent.click(screen.getByRole('switch', { name: 'Show guide' }));
    expect(guide.setEnabled).toHaveBeenCalledWith(true);
  });
  // The invitation floats above the tab bar; the page scrolls the switch
  // above it when it would be covered, and leaves the page alone when not.
  it('scrolls the guide switch above the invitation, and only when it is covered', async () => {
    guide.enabled = true; guide.notice = 'ready'; guide.noticeTop = 600;
    const rect = (top: number) => ({ top, left: 0, width: 300, height: 52, bottom: top + 52, right: 300, x: 0, y: top, toJSON: () => ({}) });
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(580) as DOMRect);
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scroll', { value: scroll, configurable: true, writable: true });
    try {
      draw();
      await waitFor(() => expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 580 + 52 + 12 - 600 })));
      cleanup(); scroll.mockClear();
      spy.mockReturnValue(rect(300) as DOMRect);
      draw();
      await new Promise((r) => setTimeout(r, 20));
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      delete (HTMLElement.prototype as unknown as { scroll?: unknown }).scroll;
    }
  });
  it('offers replay when enabled, and can turn guidance off', () => {
    guide.enabled = true;
    draw();
    press('Replay guide');
    expect(guide.replay).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('switch', { name: 'Show guide' }));
    expect(guide.setEnabled).toHaveBeenCalledWith(false);
  });
  it('uses the Vietnamese label', () => {
    state.lang = 'vi'; draw();
    expect(screen.getByText('Hiện hướng dẫn')).toBeTruthy();
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

// ── the visits ──
//
// A row of its own section, between Interests and Friends — the places a
// person has been are a fact about who they are, not about who they go
// with. Their number is under the hero since 16 Nov 2026 (`the four
// doors`) and no longer at the row's end.
describe('visited places', () => {
  it('opens the visits, with no number on the row', () => {
    state.checkins = [
      { id: 'a', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00Z' },
      { id: 'b', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-01T03:00:00Z' },
      { id: 'c', place_slug: 'pizza', city_id: 'saigon', at: '2026-09-20T03:00:00Z' },
    ];
    const { raw } = draw();
    const row = screen.getByText('Places you checked in at').closest('[data-testid="feature-row"]')!;
    expect(row.textContent).toBe('Places you checked in at' + "A record of the places you've been.");
    expect(row.querySelector('[data-testid="count-badge"]')).toBeNull();
    fireEvent.click(row);
    expect(raw.navigate).toHaveBeenCalledWith('Visited');
  });

  it('shows no number before the first visit', () => {
    draw();
    const row = screen.getByText('Places you checked in at').closest('[data-testid="feature-row"]')!;
    expect(row.textContent).toBe('Places you checked in at' + "A record of the places you've been.");
  });

  it('sits under Interests and above Friends', () => {
    draw();
    const title = screen.getByText('Places you checked in at');
    expect(screen.getByText('Interests').compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(heading('Friends')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── the numbers at the rows' ends ──
//
// A pill, not a bare figure: on the phone "30" and "6" floated between
// the text and the chevron with nothing to say they were counts rather
// than values. One tone and one width for every row, because the number
// means one thing on all of them — the size of what is behind the row.
describe('the badges', () => {
  const edge = (requester: string, addressee: string, status: string) =>
    ({ requester, addressee, status, created_at: '2026-09-01T00:00:00Z' });
  // Activity's alone since 16 Nov 2026: the friends and the check-ins
  // are counted under the hero.
  it('draws a total in a pill, on the one row that has one', () => {
    state.ships = [edge('me', 'a', 'accepted'), edge('b', 'me', 'accepted')];
    state.feed = 5;
    state.checkins = [{ id: 'k', place_slug: 'cong', city_id: 'hanoi', at: '2026-10-08T03:00:00Z' }];
    draw();
    const badges = screen.getAllByTestId('count-badge');
    expect(badges.map((b) => b.textContent)).toEqual(['5']);
    expect(screen.getByText('Activity').closest('[data-testid="feature-row"]')!.contains(badges[0])).toBe(true);
    const box = getComputedStyle(badges[0]);
    expect(box.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(box.minWidth).toBe('32px');
    expect(box.height).toBe('22px');
  });

  it('counts the feed on Activity, and nothing when it is empty', () => {
    draw();
    const row = () => screen.getByText('Activity').closest('[data-testid="feature-row"]')!;
    expect(row().querySelector('[data-testid="count-badge"]')).toBeNull();
    cleanup();
    state.feed = 3;
    draw();
    expect(row().querySelector('[data-testid="count-badge"]')!.textContent).toBe('3');
  });

  // Requests left Activity on 20 Oct 2026. A request waiting on this
  // account is the dot on the friends row and nothing on Activity's —
  // counted in both, one request read as two things to do.
  it('does not count a request waiting on this account on Activity', () => {
    state.ships = [edge('z', 'me', 'pending')];
    draw();
    const row = screen.getByText('Activity').closest('[data-testid="feature-row"]')!;
    expect(row.querySelector('[data-testid="count-badge"]')).toBeNull();
    cleanup();
    state.feed = 3;
    state.ships = [edge('z', 'me', 'pending'), edge('y', 'me', 'pending')];
    draw();
    expect(screen.getByText('Activity').closest('[data-testid="feature-row"]')!
      .querySelector('[data-testid="count-badge"]')!.textContent).toBe('3');
  });
});
