// @vitest-environment jsdom
//
// The sign-in sheet, one reason at a time. What is pinned: the title names
// what was reached for, no two reasons read alike, nothing is said under
// the title, and the painting above it (which of the two files, how big,
// and the two readers who get the sheet without it). `lib/save`'s suite
// covers who raises it and where its buttons go.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { SignInWhy } from '../lib/save';

const state = vi.hoisted(() => ({ lang: 'vi' as 'en' | 'vi' | 'ja' }));
const win = vi.hoisted(() => ({ width: 393, fontScale: 1 }));
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja: string) => ({ en, vi, ja })[state.lang],
  }),
}));
// `useWindowDimensions` reads jsdom's 1024 otherwise; the phone is stood
// up here, and knocked down to Display Zoom's 320 in one test.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: win.width, height: 852, scale: 3, fontScale: win.fontScale }),
}));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));

import AuthSheet, { ART_ASPECT, ART_HEIGHT } from './AuthSheet';
import { labelScaleCap } from '../theme';

const REASONS = ['save', 'like', 'copy', 'saved', 'search', 'trip'] as const;
const open = (why?: SignInWhy) =>
  render(<AuthSheet visible why={why} onClose={() => {}} onSignIn={() => {}} />);
/** Every line of text the sheet shows, in order. */
const lines = () => [...document.querySelectorAll('[dir="auto"]')].map((el) => el.textContent);
/** The painting, or null. The image stub is a plain <img>. */
const art = () => document.querySelector('img');

beforeEach(() => {
  state.lang = 'vi';
  win.width = 393;
  win.fontScale = 1;
  theme.scheme = 'dark';
});

describe('what it says', () => {
  it.each([
    ['save', 'Lưu địa điểm này'],
    ['like', 'Thích bộ sưu tập này'],
    ['copy', 'Lưu bản sao về tài khoản'],
    ['saved', 'Xem địa điểm đã lưu'],
    ['search', 'Tìm địa điểm mới trên Google Maps'],
    ['trip', 'Lưu chuyến đi này'],
  ] as const)('names %s in its title', (why, title) => {
    open(why);
    expect(lines()[0]).toBe(title);
  });

  // Five ways in used to read as one sheet; a sixth joined with the trip.
  it('reads differently for every reason', () => {
    const seen = new Set<string>();
    for (const why of REASONS) {
      const view = open(why);
      seen.add(lines().join('|'));
      view.unmount();
    }
    expect(seen.size).toBe(REASONS.length);
  });

  it('is about a place when nobody says otherwise', () => {
    open();
    expect(lines()[0]).toBe('Lưu địa điểm này');
  });

  // The title, then the two buttons: no line explaining what an account
  // is for.
  it('says nothing under the title', () => {
    open('like');
    expect(lines()).toEqual(['Thích bộ sưu tập này', 'Đăng nhập / Đăng ký', 'Để sau']);
  });

  it('speaks English and Japanese too', () => {
    state.lang = 'en';
    const view = open('copy');
    expect(lines()).toEqual(['Save a copy to your account', 'Sign in / Sign up', 'Not now']);
    view.unmount();
    state.lang = 'ja';
    open('search');
    expect(lines()).toEqual(['Google マップで新しいスポットを探す', 'サインイン / 登録', '今はしない']);
  });
});

describe('the painting', () => {
  it('is the night street on the dark sheet', () => {
    open();
    expect(art()!.getAttribute('src')).toMatch(/signin-art-dark/);
  });

  it('is the daytime one on the light sheet', () => {
    theme.scheme = 'light';
    open();
    expect(art()!.getAttribute('src')).toMatch(/signin-art-light/);
  });

  // The same painting whatever opened the sheet: the title is what
  // changes.
  it('is the same for every reason', () => {
    const srcs = new Set<string | null>();
    for (const why of REASONS) {
      const view = open(why);
      srcs.add(art()!.getAttribute('src'));
      view.unmount();
    }
    expect(srcs.size).toBe(1);
  });

  it('sits above the title, at the files’ own shape', () => {
    open();
    const img = art()!;
    const title = screen.getByText('Lưu địa điểm này');
    expect(img.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const st = getComputedStyle(img);
    expect(st.height).toBe(`${ART_HEIGHT}px`);
    expect(st.width).toBe(`${Math.round(ART_HEIGHT * ART_ASPECT)}px`);
  });

  it('is decoration, and the screen reader is not told about it', () => {
    open();
    expect(art()!.getAttribute('aria-hidden')).toBe('true');
  });

  it('goes under Display Zoom', () => {
    win.width = 320;
    open();
    expect(art()).toBeNull();
    expect(lines()[0]).toBe('Lưu địa điểm này');
  });

  it('goes under large Dynamic Type, and not before', () => {
    win.fontScale = labelScaleCap - 0.01;
    const view = open();
    expect(art()).not.toBeNull();
    view.unmount();
    win.fontScale = labelScaleCap;
    open();
    expect(art()).toBeNull();
  });
});
