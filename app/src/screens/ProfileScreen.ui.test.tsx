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
// The pure halves (`splitFriendships`, `cleanTaste`, `levelFromSaves`,
// `schemeLabel`) run for real; hooks and sheets are stood in for.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

type Lang = 'en' | 'vi' | 'ja';

const state = vi.hoisted(() => ({
  lang: 'en' as 'en' | 'vi' | 'ja',
  scheme: 'dark' as 'dark' | 'light',
  ready: true,
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  email: 'minh.le@example.com' as string | null,
  profile: {} as { full_name?: string; handle?: string; bio?: string; location?: string },
  memberSince: null as Date | null,
  ships: [] as { requester: string; addressee: string; status: string; created_at: string }[],
  categories: [] as string[],
  mine: [] as { members: { slug: string }[] }[],
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
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city, mode: state.mode }) }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: state.scheme, setScheme: () => {}, ready: true }) }));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));
// The key only; the real sheet drags in the whole onboarding tree.
vi.mock('../components/WelcomeSheet', () => ({ WELCOME_ALWAYS_KEY: 'citycrew.welcomeAlways' }));

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

beforeEach(async () => {
  vi.clearAllMocks();
  spies.signOut.mockImplementation(async () => {});
  Object.assign(state, {
    lang: 'en' as Lang,
    scheme: 'dark',
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
  await AsyncStorage.removeItem('citycrew.welcomeAlways');
  vi.mocked(AsyncStorage.removeItem).mockClear();
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
      tap(title);
      expect(raw.navigate).toHaveBeenCalledWith('SignIn');
    },
  );

  it('explains each locked feature in a sentence', () => {
    draw();
    expect(screen.getByText('Sign in to save your favorite places.')).toBeTruthy();
    expect(screen.getByText('Create and organize your collections.')).toBeTruthy();
    expect(screen.getByText('Plan trips and invite your friends.')).toBeTruthy();
    expect(screen.getByText('Find friends and plan unforgettable adventures together.')).toBeTruthy();
  });

  it('"Keep exploring" goes to the Explore tab through the parent navigator', () => {
    const { raw, parent } = draw();
    tap('Keep exploring');
    expect(parent.navigate).toHaveBeenCalledWith('Explore');
    expect(raw.navigate).not.toHaveBeenCalled();
  });

  it('carries the settings and legal cards without section headings', () => {
    draw();
    expect(screen.getByText('Current city')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.queryByText('Preferences')).toBeNull();
    expect(screen.queryByText('Legal')).toBeNull();
  });

  it('never says "guest"', () => {
    draw();
    expect(document.body.textContent?.toLowerCase()).not.toContain('guest');
  });

  it('closes on the tagline and its author', () => {
    draw();
    expect(screen.getByText(/We do not remember days/)).toBeTruthy();
    expect(screen.getByText('— Cesare Pavese')).toBeTruthy();
  });
});

describe('account identity', () => {
  it('shows the full name, the handle and the bio', () => {
    state.profile = { full_name: 'Le Minh', handle: 'leminh', bio: 'Coffee first.' };
    draw();
    expect(screen.getByText('Le Minh')).toBeTruthy();
    expect(screen.getByText('@leminh')).toBeTruthy();
    expect(screen.getByText('Coffee first.')).toBeTruthy();
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
    tap('Edit profile');
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
    tap('Connect with friends');
    expect(raw.navigate).toHaveBeenCalledWith('Crew');
    expect(screen.getByText('Find friends and plan trips together.')).toBeTruthy();
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
  it('names the current city, and says when it came from location', () => {
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    expect(screen.getByText('Hanoi')).toBeTruthy();
    unmount();
    state.mode = 'auto';
    draw();
    expect(screen.getByText('Hanoi · from your location')).toBeTruthy();
  });

  it('holds a place for a city not loaded yet', () => {
    state.city = null;
    draw();
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('opens and closes the city sheet', () => {
    draw();
    expect(screen.queryByText('close-city')).toBeNull();
    tap('Current city');
    fireEvent.click(screen.getByText('close-city'));
    expect(screen.queryByText('close-city')).toBeNull();
  });

  it('names the language in itself and opens the language sheet', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
    tap('Ngôn ngữ');
    fireEvent.click(screen.getByText('close-language'));
    expect(screen.queryByText('close-language')).toBeNull();
  });

  it.each([
    ['dark' as const, 'Dark', 'moon-outline'],
    ['light' as const, 'Light', 'sunny-outline'],
  ])('shows the %s scheme with its glyph and opens the theme sheet', (scheme, label, glyph) => {
    state.scheme = scheme;
    draw();
    const row = screen.getByText('Appearance').parentElement!;
    expect(row.textContent).toContain(label);
    expect(row.querySelector(`[data-icon="${glyph}"]`)).toBeTruthy();
    tap('Appearance');
    fireEvent.click(screen.getByText('close-theme'));
    expect(screen.queryByText('close-theme')).toBeNull();
  });

  it('heads the members settings "Preferences" and the documents "Legal"', () => {
    draw();
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
  });
});

describe('always-show-welcome switch', () => {
  const sw = () => screen.getByRole('switch', { name: 'Always show welcome' }) as HTMLInputElement;

  it('starts off, and on when storage already says so', async () => {
    const { unmount } = render(<ProfileScreen navigation={nav().n} />);
    await act(async () => {});
    expect(sw().checked).toBe(false);
    unmount();
    await AsyncStorage.setItem('citycrew.welcomeAlways', '1');
    draw();
    await waitFor(() => expect(sw().checked).toBe(true));
  });

  it('writes the flag on and removes it off', async () => {
    draw();
    await act(async () => {});
    fireEvent.click(sw());
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('citycrew.welcomeAlways', '1');
    await waitFor(() => expect(sw().checked).toBe(true));
    fireEvent.click(sw());
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('citycrew.welcomeAlways');
    await waitFor(() => expect(sw().checked).toBe(false));
  });
});

describe('legal card', () => {
  it.each([
    ['Terms of Service', 'close-legal-terms'],
    ['Privacy Policy', 'close-legal-privacy'],
  ])('"%s" raises its own document and closes it', (row, closer) => {
    state.session = null;
    draw();
    expect(screen.queryByText(/close-legal/)).toBeNull();
    tap(row);
    fireEvent.click(screen.getByText(closer));
    expect(screen.queryByText(/close-legal/)).toBeNull();
  });
});

describe('ways out', () => {
  it('calls signOut, with a spinner in place of the word until it settles', async () => {
    let finish!: () => void;
    spies.signOut.mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    draw();
    tap('Sign out');
    expect(spies.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sign out')).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    await act(async () => { finish(); });
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('gives the word back when signing out fails', async () => {
    let fail!: (e: Error) => void;
    spies.signOut.mockImplementation(() => new Promise<void>((_, rej) => { fail = rej; }));
    // The handler has `finally` but no `catch`, so the failure escapes as
    // an unhandled rejection (reported as a bug). It is caught here so the
    // run stays about what the reader sees: the button coming back.
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    draw();
    tap('Sign out');
    expect(screen.queryByText('Sign out')).toBeNull();
    await act(async () => { fail(new Error('offline')); });
    await waitFor(() => expect(screen.getByText('Sign out')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', onUnhandled);
  });

  it('opens the Delete account screen rather than deleting anything here', () => {
    const { raw } = draw();
    tap('Delete account');
    expect(raw.navigate).toHaveBeenCalledWith('DeleteAccount');
    expect(spies.signOut).not.toHaveBeenCalled();
  });
});
