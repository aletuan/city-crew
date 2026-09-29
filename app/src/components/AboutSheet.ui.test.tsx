// @vitest-environment jsdom
//
// "About City Crew": what it says about the copy of the app it is in, and
// what it says when it does not know. The unknown cases matter as much as
// the known ones. An OTA reaches builds that answer with less, and a
// development build answers with almost nothing.

import React from 'react';
import { Platform, Share } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { AppInfo } from '../lib/appinfo';
import { isShielded } from '../lib/share';

const state = vi.hoisted(() => ({ lang: 'vi' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja: string) => ({ en, vi, ja })[state.lang],
  }),
}));

import AboutSheet from './AboutSheet';

// Local fields, so the date on screen is the same on every clock.
const PUBLISHED = new Date(2026, 8, 29, 9, 50);
const RELEASE: AppInfo = {
  version: '1.0.4', build: '22', channel: 'production', runtime: '57.0.0',
  update: { id: '28f91171-a086-4959-78f6-6c4a944d5b67', at: PUBLISHED },
};
const NOTHING: AppInfo = { version: null, build: null, channel: null, runtime: null, update: null };

const open = (info: AppInfo = RELEASE) => {
  const onClose = vi.fn();
  const view = render(<AboutSheet visible onClose={onClose} info={info} />);
  return { onClose, view };
};

/** The value on the row with this label. */
const valueOf = (label: string) => screen.getByText(label).nextSibling?.textContent;

const share = vi.spyOn(Share, 'share');
beforeEach(() => {
  state.lang = 'vi';
  share.mockReset();
  share.mockResolvedValue({ action: 'sharedAction' });
});
afterEach(() => { vi.clearAllMocks(); });

describe('a release build that has taken an update', () => {
  it('names the binary, the channel, the update and the runtime', () => {
    open();
    expect(screen.getByText('Giới thiệu City Crew')).toBeTruthy();
    expect(valueOf('Phiên bản')).toBe('1.0.4 (22)');
    expect(valueOf('Kênh')).toBe('production');
    expect(valueOf('Bản cập nhật')).toBe('29/09/2026 09:50 · 28f91171');
    expect(valueOf('Runtime')).toBe('57.0.0');
  });

  it('writes the date the way the reader\'s language does', () => {
    state.lang = 'en';
    open();
    expect(valueOf('Update')).toBe('29 Sep 2026, 09:50 · 28f91171');
  });

  it('shows the id alone for an update with no date', () => {
    open({ ...RELEASE, update: { id: '28f91171-a086', at: null } });
    expect(valueOf('Bản cập nhật')).toBe('28f91171');
  });
});

describe('what it does not know', () => {
  it('says so, in words, for every row', () => {
    open(NOTHING);
    expect(valueOf('Phiên bản')).toBe('Không rõ');
    expect(valueOf('Kênh')).toBe('Bản phát triển');
    expect(valueOf('Bản cập nhật')).toBe('Đi kèm bản cài');
    expect(valueOf('Runtime')).toBe('—');
  });

  it('says the same in Japanese', () => {
    state.lang = 'ja';
    open(NOTHING);
    expect(screen.getByText('City Crewについて')).toBeTruthy();
    expect(valueOf('バージョン')).toBe('不明');
    expect(valueOf('チャンネル')).toBe('開発版');
    expect(valueOf('アップデート')).toBe('ビルドに同梱');
  });
});

// The system sheet is raised once this one has gone, never over it: over
// the Modal, a cancelled share froze the app on a phone. See the note at
// the top of `AboutSheet`.
describe('sharing', () => {
  const tapShare = () => fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ thông tin này' }));
  /** Lets the closing Modal finish: react-native-web lets it go, and calls
   *  `onDismiss`, on `animationend`, which jsdom never fires by itself. */
  const settleModal = () => {
    document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
  };
  const os = Platform.OS;
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });

  it('closes itself first, and raises the system sheet once it has gone', () => {
    vi.useFakeTimers();
    const { onClose } = open();
    tapShare();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('hands the system sheet the whole answer, full update id included', () => {
    vi.useFakeTimers();
    open();
    tapShare();
    vi.advanceTimersByTime(250);
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message).toContain('City Crew 1.0.4 (22)');
    expect(message).toContain('28f91171-a086-4959-78f6-6c4a944d5b67');
  });

  // iOS says when the Modal has gone; no timer guesses at it there.
  it('on iOS, waits for the Modal to say it has gone', () => {
    vi.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const onClose = vi.fn();
    const view = render(<AboutSheet visible onClose={onClose} info={RELEASE} />);
    tapShare();
    vi.advanceTimersByTime(1000);
    expect(share).not.toHaveBeenCalled();
    view.rerender(<AboutSheet visible={false} onClose={onClose} info={RELEASE} />);
    settleModal();
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('raises nothing when the sheet is closed any other way', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const onClose = vi.fn();
    const view = render(<AboutSheet visible onClose={onClose} info={RELEASE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    view.rerender(<AboutSheet visible={false} onClose={onClose} info={RELEASE} />);
    settleModal();
    expect(share).not.toHaveBeenCalled();
  });

  it('raises it once, however the sheet then goes', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const view = render(<AboutSheet visible onClose={onClose} info={RELEASE} />);
    tapShare();
    vi.advanceTimersByTime(250);
    view.rerender(<AboutSheet visible={false} onClose={onClose} info={RELEASE} />);
    settleModal();
    expect(share).toHaveBeenCalledTimes(1);
  });

  // Through `lib/share`, whose shield takes the tap that closes the
  // system sheet above its top edge, where Profile's rows are.
  it('shares behind the shield', () => {
    vi.useFakeTimers();
    let close!: () => void;
    share.mockImplementationOnce(() => new Promise((res) => { close = () => res({ action: 'dismissedAction' }); }));
    open();
    tapShare();
    vi.advanceTimersByTime(250);
    expect(isShielded()).toBe(true);
    close();
  });
});

describe('ways out', () => {
  it('closes from its Close button and from the backdrop', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // "Close", as the documents beside it say, and not "Done": nothing was
  // being done here.
  it('says Close, not Done', () => {
    open();
    expect(screen.queryByText('Xong')).toBeNull();
    state.lang = 'en';
    open();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  // The two buttons are a pair of rows: each a glyph and a word, in the
  // same type, the Close in the quieter colour.
  it('draws Close the way it draws Share', () => {
    open();
    const shareRow = screen.getByRole('button', { name: 'Chia sẻ thông tin này' });
    const closeRow = screen.getByRole('button', { name: 'Đóng' });
    expect(shareRow.querySelector('[data-icon="share-outline"]')).toBeTruthy();
    expect(closeRow.querySelector('[data-icon="close"]')).toBeTruthy();
    // Read off react-native-web's atomic classes, one per property and
    // value: jsdom does not resolve their rules into computed styles.
    const word = (row: HTMLElement, prop: string) =>
      [...row.querySelector('[dir="auto"]')!.classList].find((c) => c.startsWith(`r-${prop}-`));
    expect(word(closeRow, 'fontSize')).toBe(word(shareRow, 'fontSize'));
    expect(word(closeRow, 'fontWeight')).toBe(word(shareRow, 'fontWeight'));
    expect(word(closeRow, 'color')).not.toBe(word(shareRow, 'color'));
  });

  it('draws nothing while closed, and rises again when reopened', () => {
    const onClose = vi.fn();
    const view = render(<AboutSheet visible={false} onClose={onClose} info={RELEASE} />);
    expect(screen.queryByText('Giới thiệu City Crew')).toBeNull();
    view.rerender(<AboutSheet visible onClose={onClose} info={RELEASE} />);
    expect(screen.getByText('Giới thiệu City Crew')).toBeTruthy();
  });

  it('describes the running app when no test says otherwise', () => {
    render(<AboutSheet visible onClose={() => {}} />);
    // The suite's own answers: no channel, no native module.
    expect(valueOf('Phiên bản')).toBe('Không rõ');
    expect(valueOf('Kênh')).toBe('Bản phát triển');
  });
});
