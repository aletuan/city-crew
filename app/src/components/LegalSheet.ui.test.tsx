// @vitest-environment jsdom
//
// The sheet the two documents are read in, and the three promises that
// are not obvious from looking at it: it draws the words rather than a
// link to them, a cross-reference between the documents swaps the sheet
// instead of leaving the app, and every way out is a way out.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'vi', setLang: () => {}, t: (_en: string, vi: string) => vi }),
}));

import LegalSheet from './LegalSheet';
import { TERMS } from '../lib/legal';

const open = (id: 'terms' | 'privacy' = 'terms') => {
  const onClose = vi.fn();
  render(<LegalSheet id={id} onClose={onClose} />);
  return onClose;
};

describe('the document itself', () => {
  it('draws the words, not a link to them', async () => {
    open();
    expect(await screen.findByText('Điều khoản sử dụng')).toBeTruthy();
    expect(screen.getByText('Hiệu lực từ 29/08/2026')).toBeTruthy();
    // A heading and a bullet from deep inside the document: proof the
    // blocks are rendered rather than a summary of them.
    expect(screen.getByText('Báo cáo và chặn')).toBeTruthy();
    expect(screen.getByText(/Quấy rối hoặc lăng mạ/)).toBeTruthy();
  });

  it('opens on whichever document it was asked for', async () => {
    open('privacy');
    expect(await screen.findByText('Chính sách quyền riêng tư')).toBeTruthy();
  });
});

describe('a cross-reference', () => {
  // The documents point at each other by bare filename, which a browser
  // resolves against the page it is on. There is no page here — so the
  // link has to mean "show the other one", and must never hand a reader
  // mid-signup to Safari.
  it('swaps the document instead of leaving the app', async () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    open('terms');
    fireEvent.click((await screen.findAllByText('Chính sách quyền riêng tư'))[0]);

    await waitFor(() => expect(screen.getByText('Chúng tôi thu thập gì')).toBeTruthy());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still leaves for a link that is genuinely elsewhere', async () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true);
    open('privacy');
    fireEvent.click((await screen.findAllByText('Supabase'))[0]);

    await waitFor(() => expect(spy).toHaveBeenCalledWith('https://supabase.com'));
    spy.mockRestore();
  });
});

describe('the ways out', () => {
  it('closes from the header control', async () => {
    const onClose = open();
    await screen.findByText('Điều khoản sử dụng');
    fireEvent.click(screen.getAllByLabelText('Đóng')[0]);
    expect(onClose).toHaveBeenCalled();
  });

  // Two controls carry the same label — the scrim and the footer button —
  // and both have to work. Asserting on the last one specifically is what
  // makes this test about the footer rather than about whichever the
  // query happened to find first.
  it('closes from the button at the foot of the sheet', async () => {
    const onClose = open();
    await screen.findByText('Điều khoản sử dụng');
    const outs = screen.getAllByText('Đóng');
    fireEvent.click(outs[outs.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('what the sheet is not', () => {
  // The prompt this was built from asked for a "you have reached the end"
  // tick. It came from consent flows that gate a button on scrolling, and
  // nothing here is gated — so it would announce a rule that does not
  // exist. Pinned so it does not arrive later by accident.
  it('asks nothing of a reader who does not scroll', async () => {
    open();
    await screen.findByText('Điều khoản sử dụng');
    expect(screen.queryByText(/đã đọc đến cuối/)).toBeNull();
  });

  it('shows nothing at all when no document is named', () => {
    render(<LegalSheet id={null} onClose={() => {}} />);
    expect(screen.queryByText(TERMS.title.vi)).toBeNull();
  });
});
