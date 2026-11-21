// @vitest-environment jsdom
//
// The gold pencil beside an invitation to write; see `PencilGlyph`.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../uitest/render';
import { PencilGlyph } from './PencilGlyph';
import { ICON } from './ui/glyph';

describe('PencilGlyph', () => {
  // The words' 15 high, filled in the colour given, and the eraser its
  // own piece, cut off by a gap rather than painted over in a ground.
  it('is a thick pencil at the text size, in the colour given, eraser apart', () => {
    render(<PencilGlyph color="#C9962B" />);
    const svg = screen.getByTestId('pencil-glyph');
    expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('fill')])
      .toEqual([String(ICON.text), String(ICON.text), '#C9962B']);
    const eraser = screen.getByTestId('pencil-glyph-eraser');
    const shaft = eraser.nextElementSibling!;
    // The shaft is 6 across, three times Ionicons' pencil at this size.
    expect([eraser.getAttribute('width'), shaft.getAttribute('width')]).toEqual(['6', '6']);
    // A gap between the eraser's foot and the shaft's head.
    expect(Number(shaft.getAttribute('y'))).toBeGreaterThan(Number(eraser.getAttribute('y')) + Number(eraser.getAttribute('height')));
    expect(svg.querySelectorAll('[fill]')).toHaveLength(0);
  });
});
