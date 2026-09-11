// @vitest-environment jsdom
//
// Edit profile writes two rows behind one button, so what is pinned here is
// what each write carries and when it is allowed to happen: the form
// prefilled from the profile, `updateProfile` sent trimmed text and the
// handle only when it changed, the handle's own checks (shape before the
// round trip, `handle_taken` / `handle_reserved` from lib/auth after it)
// drawn under the field, the interests and the recording switch seeded
// from `preferences` and written back with the budget untouched, the
// history deletion and its alert, the spinner that swallows a second tap,
// and where Back and Save lead.
//
// Hooks from `lib/*` are stood in for at the screen's own imports; the
// taste picker, the field rows and the handle rules run for real, because
// what a reader taps and what gets refused are theirs to decide.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

// `Alert` from react-native-web is a silent no-op, so it is caught at the
// import the screen actually uses.
const alert = vi.hoisted(() => vi.fn());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

type Prefs = { categories: string[]; budget_vnd: number | null; history_on: boolean };
const state = vi.hoisted(() => ({
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  profile: { handle: 'minh', full_name: 'Minh Le', location: 'Hanoi', bio: 'Coffee first', interests: '', avatar_url: '' },
  prefs: { data: { categories: [], budget_vnd: null, history_on: true } as Prefs, loadedAt: 1 as number | null },
  city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as
    { short_en: string; short_vi: string; short_ja: string } | null,
}));
const spies = vi.hoisted(() => ({
  updateProfile: vi.fn(async (_p: object) => {}),
  savePreferences: vi.fn(async (_uid: string, _p: object) => {}),
  clearMyHistory: vi.fn(async (_uid: string) => {}),
  prefsFor: vi.fn(),
  avatarProps: vi.fn(),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.session, profile: state.profile, updateProfile: spies.updateProfile }),
}));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: state.city }) }));
vi.mock('../lib/data', () => ({
  useMyPreferences: (uid: string | null) => {
    spies.prefsFor(uid);
    return state.prefs;
  },
  savePreferences: spies.savePreferences,
  clearMyHistory: spies.clearMyHistory,
}));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: 'dark', setScheme: () => {}, ready: true }) }));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));
// The picker saves on pick through lib/auth itself (see AvatarPicker's own
// suite); what this screen owes it is a mount and a size.
vi.mock('../components/AvatarPicker', () => ({
  default: (props: object) => { spies.avatarProps(props); return <div data-testid="avatar" />; },
}));

import EditProfileScreen from './EditProfileScreen';

type BeforeRemove = (e: { preventDefault: () => void; data: { action: unknown } }) => void;
type TestNav = Nav & {
  goBack: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
  /** What a real navigator does before the screen goes: ask every
   *  `beforeRemove` listener. True when one of them held the screen. */
  leave: () => boolean;
};
const nav = (): TestNav => {
  const listeners = new Set<BeforeRemove>();
  const action = { type: 'GO_BACK' };
  return {
    navigate: vi.fn(), goBack: vi.fn(), dispatch: vi.fn(),
    addListener: vi.fn((name: string, fn: BeforeRemove) => {
      if (name !== 'beforeRemove') return () => {};
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    }),
    leave: () => {
      let held = false;
      for (const fn of [...listeners]) fn({ preventDefault: () => { held = true; }, data: { action } });
      return held;
    },
  } as unknown as TestNav;
};

const renderScreen = (navigation = nav()) => {
  const utils = render(<EditProfileScreen navigation={navigation} />);
  return { navigation, ...utils };
};

const field = (placeholder: string) => screen.getByPlaceholderText(placeholder) as HTMLInputElement;
const nameField = () => field('Enter your full name');
const handleField = () => field('yourname');
const townField = () => field('Hanoi, Vietnam');
const bioField = () => field('Coffee lover · Weekend explorer');
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Save changes' });
const save = () => fireEvent.click(saveButton());
const lastAlertButtons = () =>
  alert.mock.calls.at(-1)![2] as { text: string; style?: string; onPress?: () => void }[];

beforeEach(() => {
  vi.clearAllMocks();
  spies.updateProfile.mockImplementation(async () => {});
  spies.savePreferences.mockImplementation(async () => {});
  spies.clearMyHistory.mockImplementation(async () => {});
  state.session = { user: { id: 'me' } };
  state.profile = { handle: 'minh', full_name: 'Minh Le', location: 'Hanoi', bio: 'Coffee first', interests: '', avatar_url: '' };
  state.prefs = { data: { categories: [], budget_vnd: null, history_on: true }, loadedAt: 1 };
  state.city = { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
});

describe('the form as it opens', () => {
  it('is filled from the profile, with the avatar picker above it', () => {
    renderScreen();
    expect(nameField().value).toBe('Minh Le');
    expect(handleField().value).toBe('minh');
    expect(townField().value).toBe('Hanoi');
    expect(bioField().value).toBe('Coffee first');
    expect(screen.getByText('Edit profile')).toBeTruthy();
    expect(screen.getByTestId('avatar')).toBeTruthy();
    expect(spies.avatarProps).toHaveBeenCalledWith({ size: 96 });
    expect(screen.getByText('Tap to change — saved right away')).toBeTruthy();
  });

  it('asks for the signed-in person’s preferences, and falls back to Saigon with no city', () => {
    state.city = null;
    renderScreen();
    expect(spies.prefsFor).toHaveBeenCalledWith('me');
    expect(screen.getByPlaceholderText('Saigon, Vietnam')).toBeTruthy();
  });

  it('seeds the interests and switch from the stored row, dropping keys the taxonomy lacks', async () => {
    state.prefs = { data: { categories: ['cafes', 'bogus', 'cafes', 'views'], budget_vnd: 500000, history_on: false }, loadedAt: 1 };
    renderScreen();
    save();
    await waitFor(() => expect(spies.savePreferences).toHaveBeenCalled());
    expect(spies.savePreferences).toHaveBeenCalledWith('me', {
      categories: ['cafes', 'views'], budget_vnd: 500000, history_on: false,
    });
  });

  it('shows neither preferences block when signed out, and saves only the profile', async () => {
    state.session = null;
    const { navigation } = renderScreen();
    expect(spies.prefsFor).toHaveBeenCalledWith(null);
    expect(screen.queryByText('Interests')).toBeNull();
    expect(screen.queryByText('Remember what I open')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete my history/ })).toBeNull();
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(spies.updateProfile).toHaveBeenCalled();
    expect(spies.savePreferences).not.toHaveBeenCalled();
  });
});

describe('what Save sends', () => {
  it('sends trimmed text and leaves an unchanged handle out', async () => {
    const { navigation } = renderScreen();
    type(nameField(), '  Minh Anh  ');
    type(townField(), ' Da Nang ');
    type(bioField(), '\n Pho at dawn \n');
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(spies.updateProfile).toHaveBeenCalledTimes(1);
    expect(spies.updateProfile).toHaveBeenCalledWith({ full_name: 'Minh Anh', location: 'Da Nang', bio: 'Pho at dawn' });
  });

  it('normalises a changed handle as it is typed and sends it', async () => {
    const { navigation } = renderScreen();
    type(handleField(), ' @Minh_Le ');
    expect(handleField().value).toBe('minh_le');
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(spies.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ handle: 'minh_le' }));
  });

  it('writes the profile before the preferences, then leaves', async () => {
    const order: string[] = [];
    spies.updateProfile.mockImplementation(async () => { order.push('profile'); });
    spies.savePreferences.mockImplementation(async () => { order.push('prefs'); });
    const { navigation } = renderScreen();
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(order).toEqual(['profile', 'prefs']);
  });

  it('caps the handle box at the column’s limit', () => {
    renderScreen();
    expect(handleField().getAttribute('maxlength')).toBe('20');
  });
});

describe('the handle', () => {
  it.each([
    ['', 'Choose a username.'],
    ['ab', 'At least 3 characters.'],
    ['minh-le', 'Letters, numbers and _ only.'],
  ])('refuses %j before asking the server', async (value, message) => {
    const { navigation } = renderScreen();
    type(handleField(), value);
    save();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(spies.updateProfile).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    // The spinner comes back off, so the reader can fix it and try again.
    expect(saveButton().textContent).toBe('Save changes');
  });

  it('refuses one longer than twenty characters', async () => {
    // `maxLength` stops typing, not a value set from outside it.
    state.profile = { ...state.profile, handle: 'a'.repeat(21) };
    renderScreen();
    save();
    expect(await screen.findByText('20 characters at most.')).toBeTruthy();
    expect(spies.updateProfile).not.toHaveBeenCalled();
  });

  it('clears its message as soon as the reader types', async () => {
    renderScreen();
    type(handleField(), 'ab');
    save();
    await screen.findByText('At least 3 characters.');
    type(handleField(), 'abc');
    expect(screen.queryByText('At least 3 characters.')).toBeNull();
  });

  it('names a taken handle under the field and stays open', async () => {
    spies.updateProfile.mockRejectedValue(new Error('handle_taken'));
    const { navigation } = renderScreen();
    type(handleField(), 'linh');
    save();
    expect(await screen.findByText('@linh is taken. Try another.')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(spies.savePreferences).not.toHaveBeenCalled();
  });

  it('says a reserved handle is reserved', async () => {
    spies.updateProfile.mockRejectedValue(new Error('handle_reserved'));
    const { navigation } = renderScreen();
    type(handleField(), 'admin');
    save();
    expect(await screen.findByText('That username is reserved.')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('puts any other profile failure by the button, in words', async () => {
    spies.updateProfile.mockRejectedValue(new Error('network down'));
    const { navigation } = renderScreen();
    save();
    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(saveButton().textContent).toBe('Save changes');
  });

  it('keeps the form open when the preferences write fails after the profile landed', async () => {
    spies.savePreferences.mockRejectedValue(new Error('prefs down'));
    const { navigation } = renderScreen();
    save();
    expect(await screen.findByText('Prefs down')).toBeTruthy();
    expect(spies.updateProfile).toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('clears the old message when trying again', async () => {
    spies.updateProfile.mockRejectedValueOnce(new Error('network down'));
    const { navigation } = renderScreen();
    save();
    await screen.findByText('Network down');
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(screen.queryByText('Network down')).toBeNull();
  });
});

describe('saving', () => {
  it('shows a spinner and swallows a second tap while the first is in flight', async () => {
    let finish!: () => void;
    spies.updateProfile.mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    const { navigation } = renderScreen();
    // Held across the tap: busy, the button loses its words and so its name.
    const button = saveButton();
    fireEvent.click(button);
    await waitFor(() => expect(button.textContent).toBe(''));
    fireEvent.click(button);
    expect(spies.updateProfile).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(spies.savePreferences).toHaveBeenCalledTimes(1);
  });
});

describe('interests and recording', () => {
  it('writes the chips as tapped, in order, and the switch as left', async () => {
    state.prefs = { data: { categories: ['cafes'], budget_vnd: null, history_on: true }, loadedAt: 1 };
    const { navigation } = renderScreen();
    expect(screen.getByText('Interests')).toBeTruthy();
    fireEvent.click(screen.getByText('Cafés'));
    fireEvent.click(screen.getByText('Eats'));
    fireEvent.click(screen.getByText('Views'));
    fireEvent.click(screen.getByRole('switch', { name: 'Remember what I open' }));
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(spies.savePreferences).toHaveBeenCalledWith('me', {
      categories: ['eats', 'views'], budget_vnd: null, history_on: false,
    });
  });
});

describe('deleting history', () => {
  const openConfirm = () => {
    fireEvent.click(screen.getByRole('button', { name: /Delete my history/ }));
    expect(alert).toHaveBeenCalledWith('Delete your history?', expect.any(String), expect.any(Array));
    return lastAlertButtons();
  };

  it('asks first, and Cancel deletes nothing', () => {
    renderScreen();
    const buttons = openConfirm();
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Delete', 'destructive']]);
    buttons[0].onPress?.();
    expect(spies.clearMyHistory).not.toHaveBeenCalled();
  });

  it('deletes straight away and says so on the row', async () => {
    const { navigation } = renderScreen();
    const buttons = openConfirm();
    act(() => { buttons[1].onPress!(); });
    expect(spies.clearMyHistory).toHaveBeenCalledWith('me');
    expect(await screen.findByText('History deleted')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('tells the reader when the deletion failed, and the row stays as it was', async () => {
    spies.clearMyHistory.mockRejectedValue(new Error('denied'));
    renderScreen();
    const buttons = openConfirm();
    act(() => { buttons[1].onPress!(); });
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete', 'denied'));
    expect(screen.getByText('Delete my history')).toBeTruthy();
  });
});

describe('before the preferences row lands', () => {
  // Until then the switch reads off and the chips read empty — this
  // screen's placeholders, not the reader's answer. Saving used to write
  // them over the real row: interests wiped and recording turned off.
  it('saves the profile and leaves the preferences row alone', async () => {
    state.prefs = { data: { categories: [], budget_vnd: null, history_on: true }, loadedAt: null };
    const { navigation } = renderScreen();
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(spies.updateProfile).toHaveBeenCalled();
    expect(spies.savePreferences).not.toHaveBeenCalled();
  });
});

describe('a handle answer that lands after the box changed', () => {
  // The box stays editable while the request is out; the message has to
  // be about the handle the server was asked for. It is, because `save`
  // reads the handle from the render it was made in — pinned so a
  // refactor to a ref or a later read does not quietly change that.
  it('names the handle that was sent, not the one typed since', async () => {
    let refuse!: () => void;
    spies.updateProfile.mockImplementation(
      () => new Promise<void>((_, no) => { refuse = () => no(new Error('handle_taken')); }),
    );
    renderScreen();
    type(handleField(), 'linh');
    save();
    await waitFor(() => expect(spies.updateProfile).toHaveBeenCalled());
    type(handleField(), 'linh_2');
    await act(async () => { refuse(); });
    expect(await screen.findByText('@linh is taken. Try another.')).toBeTruthy();
    expect(screen.queryByText('@linh_2 is taken. Try another.')).toBeNull();
  });
});

describe('leaving', () => {
  it('Back goes back', () => {
    const { navigation } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('lets an untouched form go without asking', () => {
    state.prefs = { data: { categories: ['cafes', 'bogus'], budget_vnd: null, history_on: false }, loadedAt: 1 };
    const { navigation } = renderScreen();
    expect(navigation.leave()).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  it.each([
    ['the name', () => type(nameField(), 'Minh Anh')],
    ['the handle', () => type(handleField(), 'minh2')],
    ['the hometown', () => type(townField(), 'Hue')],
    ['the bio', () => type(bioField(), 'Tea now')],
    ['an interest', () => fireEvent.click(screen.getByText('Cafés'))],
    ['the switch', () => fireEvent.click(screen.getByRole('switch', { name: 'Remember what I open' }))],
  ])('holds the screen after a change to %s and asks first', (_what, change) => {
    const { navigation } = renderScreen();
    change();
    expect(navigation.leave()).toBe(true);
    expect(alert).toHaveBeenCalledWith('Discard your changes?', expect.any(String), expect.any(Array));
  });

  it('forgets the question once a change is undone', () => {
    const { navigation } = renderScreen();
    type(bioField(), 'Tea now');
    type(bioField(), 'Coffee first');
    expect(navigation.leave()).toBe(false);
  });

  it('Keep editing stays; Discard carries on with the navigation it held', () => {
    const { navigation } = renderScreen();
    type(nameField(), 'Minh Anh');
    navigation.leave();
    const buttons = lastAlertButtons();
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Keep editing', 'cancel'], ['Discard', 'destructive']]);
    buttons[0].onPress?.();
    expect(navigation.dispatch).not.toHaveBeenCalled();
    buttons[1].onPress!();
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('does not stand in the way of the exit a save takes', async () => {
    const { navigation } = renderScreen();
    type(nameField(), 'Minh Anh');
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(navigation.leave()).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });
});
