// @vitest-environment jsdom
//
// "About City Crew": what it says about the copy of the app it is in, and
// what it says when it does not know. The unknown cases matter as much as
// the known ones. An OTA reaches builds that answer with less, and a
// development build answers with almost nothing.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { AppInfo } from '../lib/appinfo';

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

beforeEach(() => { state.lang = 'vi'; });
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
    expect(valueOf('Bản cập nhật')).toBe('Có sẵn trong bản cài');
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

// Taken out on 21 Oct 2026 (owner): the card's values are copied by a long
// press now, not shared as a block.
describe('no share', () => {
  it('offers no way to share the details, in any language', () => {
    const { view } = open();
    expect(screen.queryByRole('button', { name: 'Chia sẻ thông tin này' })).toBeNull();
    expect(screen.queryByText(/Chia sẻ/)).toBeNull();
    view.unmount();
    state.lang = 'en';
    open();
    expect(screen.queryByText(/Share/)).toBeNull();
    // Close is the one button left.
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim()).filter(Boolean)).toEqual(['Close']);
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

  it('draws Close as a glyph and a word', () => {
    open();
    expect(screen.getByRole('button', { name: 'Đóng' }).querySelector('[data-icon="close"]')).toBeTruthy();
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
