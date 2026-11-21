// @vitest-environment jsdom
//
// The copy button's glyph, in its two states; see `CopyGlyph`.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../uitest/render';
import { CopyGlyph } from './CopyGlyph';
import { ICON } from './ui/glyph';

describe('CopyGlyph', () => {
  it('is Ionicons’ two sheets while the copy is not yours', () => {
    const { container } = render(<CopyGlyph have={false} size={ICON.action} color="#888" />);
    const glyph = container.querySelector('[data-icon]')!;
    expect([glyph.getAttribute('data-icon'), glyph.getAttribute('data-size'), glyph.getAttribute('data-color')])
      .toEqual(['copy-outline', String(ICON.action), '#888']);
    expect(screen.queryByTestId('copy-glyph-tick')).toBeNull();
  });

  // The same sheets, drawn on Ionicons' grid at its stroke, and a tick in
  // the front one; the colour as given, never filled.
  it('is the same sheets with a tick when it is yours, at the same size and colour', () => {
    const { container } = render(<CopyGlyph have size={ICON.action} color="#888" />);
    expect(container.querySelector('[data-icon]')).toBeNull();
    const svg = screen.getByTestId('copy-glyph-yours');
    expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox')])
      .toEqual([String(ICON.action), String(ICON.action), '0 0 512 512']);
    expect([svg.getAttribute('stroke'), svg.getAttribute('fill'), svg.getAttribute('stroke-width')]).toEqual(['#888', 'none', '32']);
    const rect = svg.querySelector('[data-stub="Rect"]')!;
    expect([rect.getAttribute('x'), rect.getAttribute('width'), rect.getAttribute('rx')]).toEqual(['128', '336', '57']);
    // The tick, its three points all inside the front sheet's 128–464.
    expect(screen.getByTestId('copy-glyph-tick').getAttribute('d')).toBe('M230 300l44 44 92-100');
  });
});
