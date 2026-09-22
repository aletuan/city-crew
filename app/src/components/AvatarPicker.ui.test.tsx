// @vitest-environment jsdom
//
// The account's face, and the sheet that changes it.
//
// Both screens that mount this stub it out in their tests, so the picker
// had never run under one: not the letter it falls back to, not the
// three rows of the sheet, not the hold between the sheet closing and
// the camera opening, and not the sentence a refused photograph gets.
// The camera roll is stubbed in `setup.tsx` to a cancelled picker; the
// tests that want a photograph chosen say so themselves.

import React from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

const setAvatar = vi.hoisted(() => vi.fn(async (_uri: string) => {}));
const clearAvatar = vi.hoisted(() => vi.fn(async () => {}));
const account = vi.hoisted(() => ({
  email: 'trang@example.com' as string | null,
  profile: { full_name: 'Trang', avatar_url: '' as string | null },
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ profile: account.profile, email: account.email, setAvatar, clearAvatar }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import AvatarPicker from './AvatarPicker';

const picker = vi.mocked(ImagePicker);
const chosen = { canceled: false as const, assets: [{ uri: 'file://new.jpg' }] } as unknown as ImagePicker.ImagePickerResult;
const cancelled = { canceled: true as const, assets: null } as unknown as ImagePicker.ImagePickerResult;

const openSheet = () => fireEvent.click(screen.getByRole('button', { name: 'Change profile photo' }));
/**
 * Lets a closing Modal finish closing.
 *
 * react-native-web keeps a Modal's children mounted through its fade and
 * lets them go on `animationend` — an event jsdom never fires on its own.
 * The wrapper that listens is the one carrying the animation classes;
 * ending its animation is what a real browser would do 300ms later.
 */
const settleModal = () => {
  document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
};
const row = (name: string) => screen.getByRole('button', { name });
const alerted = () => vi.mocked(Alert.alert).mock.calls.map(([title, body]) => [title, body]);

beforeEach(() => {
  setAvatar.mockClear();
  setAvatar.mockImplementation(async () => {});
  clearAvatar.mockClear();
  account.email = 'trang@example.com';
  account.profile = { full_name: 'Trang', avatar_url: '' };
  picker.launchImageLibraryAsync.mockResolvedValue(cancelled);
  picker.launchCameraAsync.mockResolvedValue(cancelled);
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the face', () => {
  it('shows the photograph when there is one, and the camera badge that makes it a control', () => {
    account.profile.avatar_url = 'https://x/trang.jpg';
    const { container } = render(<AvatarPicker />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/trang.jpg');
    expect(container.querySelector('[data-icon="camera"]')).toBeTruthy();
    expect(screen.queryByText('T')).toBeNull();
  });

  it('falls back to the first letter of the name', () => {
    render(<AvatarPicker />);
    expect(screen.getByText('T')).toBeTruthy();
  });

  // Same fallback the name row uses, so the letter and the name agree for
  // somebody who signed up without giving a name.
  it('then to the address, then to a question mark', () => {
    account.profile.full_name = '';
    account.email = 'linh@example.com';
    const { unmount } = render(<AvatarPicker />);
    expect(screen.getByText('L')).toBeTruthy();
    unmount();

    account.email = null;
    render(<AvatarPicker />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('drops the badge where the caller says another mark takes the corner', () => {
    const { container } = render(<AvatarPicker showCamera={false} />);
    expect(container.querySelector('[data-icon="camera"]')).toBeNull();
  });
});

describe('the sheet', () => {
  it('opens from the face and offers the library and the camera', () => {
    render(<AvatarPicker />);
    expect(screen.queryByText('Profile photo')).toBeNull();
    openSheet();

    expect(screen.getByText('Profile photo')).toBeTruthy();
    expect(row('Choose from library')).toBeTruthy();
    expect(row('Take a photo')).toBeTruthy();
    // Nothing to remove until there is something there.
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('offers removal only once there is a photograph', () => {
    account.profile.avatar_url = 'https://x/trang.jpg';
    render(<AvatarPicker />);
    openSheet();
    expect(row('Remove photo')).toBeTruthy();
  });

  it('saves the picture chosen from the library, straight away', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(chosen);
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));

    // Square, so the crop the person frames is the crop the circle shows.
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] }),
    ));
    await waitFor(() => expect(setAvatar).toHaveBeenCalledWith('file://new.jpg'));
    expect(alerted()).toEqual([]);
  });

  it('saves nothing when the picker is dismissed', async () => {
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));

    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(setAvatar).not.toHaveBeenCalled();
  });

  // The camera is the one door that genuinely needs asking — the library
  // opens through a picker that runs outside the app.
  it('asks for the camera, and says where the switch is when it is off', async () => {
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Take a photo'));

    await waitFor(() => expect(alerted()).toEqual([
      ['Could not update your photo', 'Camera access is off in Settings.'],
    ]));
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('takes the photograph once the camera is allowed', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue(chosen);
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Take a photo'));

    await waitFor(() => expect(setAvatar).toHaveBeenCalledWith('file://new.jpg'));
  });

  it('removes the photograph on request', async () => {
    account.profile.avatar_url = 'https://x/trang.jpg';
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Remove photo'));

    await waitFor(() => expect(clearAvatar).toHaveBeenCalled());
  });

  // The names `setAvatar` throws become sentences here; anything else
  // arrives as it was.
  it('turns a named refusal into its sentence', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(chosen);
    setAvatar.mockRejectedValueOnce(new Error('too_soon'));
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));

    await waitFor(() => expect(alerted()).toEqual([
      ['Could not update your photo', 'Give it a minute before changing your photo again.'],
    ]));
  });

  it('passes an unnamed failure through in its own words', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(chosen);
    setAvatar.mockRejectedValueOnce('storage is full');
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));

    await waitFor(() => expect(alerted()).toEqual([
      ['Could not update your photo', 'Storage is full'],
    ]));
  });

  it('shows the work while it runs, then stops', async () => {
    let release: () => void = () => {};
    picker.launchImageLibraryAsync.mockResolvedValue(chosen);
    setAvatar.mockImplementation(() => new Promise<void>((r) => { release = r; }));
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));

    expect(await screen.findByRole('progressbar')).toBeTruthy();
    release();
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  });

  it('can be put away without choosing', () => {
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Cancel'));
    settleModal();

    expect(screen.queryByText('Profile photo')).toBeNull();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('closes when the page behind it is tapped', () => {
    render(<AvatarPicker />);
    openSheet();
    // The scrim: the one pressable with no name, standing just before the
    // sheet in the Modal — a tap anywhere on the page is "never mind".
    const scrim = screen.getByText('Profile photo').parentElement!.previousElementSibling as HTMLElement;
    fireEvent.click(scrim);
    settleModal();
    expect(screen.queryByText('Profile photo')).toBeNull();
  });

  it('closes on its way to the picker, so the camera is never asked to present over it', () => {
    // iOS will not present a view controller while another is dismissing;
    // the job waits for the sheet to go, and the sheet goes first.
    render(<AvatarPicker />);
    openSheet();
    fireEvent.click(row('Choose from library'));
    settleModal();
    expect(screen.queryByText('Profile photo')).toBeNull();
  });
});
