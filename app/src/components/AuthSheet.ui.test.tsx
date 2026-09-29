// @vitest-environment jsdom
//
// The sign-in sheet, one reason at a time. What is pinned: the title names
// what was reached for, the glyph is the control that was tapped, no two
// reasons read alike, and nothing is said under the title. `lib/save`'s
// suite covers who raises it and where its buttons go.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { SignInWhy } from '../lib/save';

const state = vi.hoisted(() => ({ lang: 'vi' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja: string) => ({ en, vi, ja })[state.lang],
  }),
}));

import AuthSheet from './AuthSheet';

const open = (why?: SignInWhy) =>
  render(<AuthSheet visible why={why} onClose={() => {}} onSignIn={() => {}} />);
/** The glyph in the badge: the sheet's only data-icon besides none. */
const glyph = () => document.querySelector('[data-icon]')?.getAttribute('data-icon');
/** Every line of text the sheet shows, in order. */
const lines = () => [...document.querySelectorAll('[dir="auto"]')].map((el) => el.textContent);

beforeEach(() => { state.lang = 'vi'; });

describe('what it says', () => {
  it.each([
    ['save', 'Lưu địa điểm này', 'bookmark'],
    ['like', 'Thích bộ sưu tập này', 'heart'],
    ['copy', 'Lưu bản sao về tài khoản', 'copy'],
    ['saved', 'Xem địa điểm đã lưu', 'bookmarks'],
    ['search', 'Tìm địa điểm mới trên Google Maps', 'search'],
  ] as const)('names %s in its title, with its glyph', (why, title, icon) => {
    open(why);
    expect(screen.getByText(title)).toBeTruthy();
    expect(glyph()).toBe(icon);
  });

  // Five ways in used to read as one sheet.
  it('reads differently for every reason', () => {
    const seen = new Set<string>();
    for (const why of ['save', 'like', 'copy', 'saved', 'search'] as const) {
      const view = open(why);
      seen.add(`${glyph()}|${lines().join('|')}`);
      view.unmount();
    }
    expect(seen.size).toBe(5);
  });

  it('is about a place when nobody says otherwise', () => {
    open();
    expect(screen.getByText('Lưu địa điểm này')).toBeTruthy();
    expect(glyph()).toBe('bookmark');
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
