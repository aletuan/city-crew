// @vitest-environment jsdom
//
// The header painting: which of the two files, how big, and the two
// readers who get the header without it. Layout is not measured here —
// jsdom lays nothing out — so the arithmetic is read back off the
// styles, which is what `artHeight` is exported for.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '../uitest/render';

const win = vi.hoisted(() => ({ width: 393, fontScale: 1 }));
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));
const inset = vi.hoisted(() => ({ top: 59 }));

// `useWindowDimensions` reads jsdom's 1024 otherwise; the phone is stood
// up here, and knocked down to Display Zoom's 320 in one test.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: win.width, height: 852, scale: 3, fontScale: win.fontScale }),
}));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: inset.top, bottom: 0, left: 0, right: 0 }),
}));

import IdeasHeaderArt, { ART_ASPECT, artHeight, BAND, OVERLAP } from './IdeasHeaderArt';
import { labelScaleCap, space } from '../theme';

beforeEach(() => { win.width = 393; win.fontScale = 1; theme.scheme = 'dark'; inset.top = 59; });
afterEach(cleanup);

// The image stub spreads its props onto a plain <img>, where `testID`
// means nothing; the painting is the one image inside the spacer.
const img = () => screen.getByTestId('ideas-art').querySelector('img')!;

describe('which painting', () => {
  it('is the night street on the dark ground', () => {
    render(<IdeasHeaderArt />);
    expect(img().getAttribute('src')).toMatch(/ideas-art-dark/);
  });

  it('is the afternoon on paper', () => {
    theme.scheme = 'light';
    render(<IdeasHeaderArt />);
    expect(img().getAttribute('src')).toMatch(/ideas-art-light/);
  });
});

describe('how it sits', () => {
  it('reaches from the screen top to the bottom of the title band', () => {
    // 59 of inset, 22 of row padding, the column at one line each.
    expect(artHeight(59)).toBe(59 + 22 + BAND);
    render(<IdeasHeaderArt />);
    const st = getComputedStyle(screen.getByTestId('ideas-art-frame'));
    expect(st.height).toBe(`${artHeight(59)}px`);
    expect(st.width).toBe(`${Math.round(artHeight(59) * ART_ASPECT)}px`);
    // Bleeds past the page padding to the screen edge.
    expect(st.right).toBe(`${-space.page}px`);
  });

  it('reserves the row width the title must stop at: the painting less its plain sky and the page padding', () => {
    render(<IdeasHeaderArt />);
    const width = Math.round(artHeight(59) * ART_ASPECT);
    expect(getComputedStyle(screen.getByTestId('ideas-art')).width).toBe(`${width - OVERLAP - space.page}px`);
  });

  it('follows the inset, so a phone with a shorter status bar gets a shorter painting', () => {
    inset.top = 20;
    render(<IdeasHeaderArt />);
    expect(getComputedStyle(screen.getByTestId('ideas-art-frame')).height).toBe(`${artHeight(20)}px`);
  });

  it('is decoration: hidden from the screen reader and inert to touch', () => {
    render(<IdeasHeaderArt />);
    const spacer = screen.getByTestId('ideas-art');
    expect(spacer.getAttribute('aria-hidden')).toBe('true');
    expect(spacer.className).toMatch(/pointerEvents/);
  });
});

describe('when it steps aside', () => {
  it('is absent under Display Zoom, where the column beside it would be 80pt', () => {
    win.width = 320;
    render(<IdeasHeaderArt />);
    expect(screen.queryByTestId('ideas-art')).toBeNull();
  });

  it('is absent under large Dynamic Type, at the same cap the tab captions stop at', () => {
    win.fontScale = labelScaleCap;
    render(<IdeasHeaderArt />);
    expect(screen.queryByTestId('ideas-art')).toBeNull();
  });

  it('is there one notch below the cap', () => {
    win.fontScale = labelScaleCap - 0.01;
    render(<IdeasHeaderArt />);
    expect(screen.getByTestId('ideas-art')).toBeTruthy();
  });
});
