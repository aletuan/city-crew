// @vitest-environment jsdom
//
// A visit's note, or the line that asks its owner for one: which of the
// two is drawn, what a screen reader hears, and that a press on either
// asks to edit.

import React from 'react';
import { StyleSheet } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, propsWhere, render, screen, textStyleOf } from '../uitest/render';

vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));

import VisitNote from './VisitNote';

afterEach(cleanup);

describe('VisitNote', () => {
  it('reads a note back plainly, with the pencil after it, and opens it for editing on a press', () => {
    const onEdit = vi.fn();
    render(<VisitNote note="Crisp sourdough." onEdit={onEdit} />);
    const row = screen.getByTestId('visit-note');
    expect(row.textContent).toBe('Crisp sourdough.');
    expect(row.getAttribute('aria-label')).toBe('Your note: Crisp sourdough.. Edit');
    // The pencil says this line edits (owner, 26 Nov 2026): without it a
    // note was read as something to read, and the card opens the place.
    expect(screen.getByTestId('pencil-glyph')).toBeTruthy();
    expect(screen.queryByTestId('visit-note-add')).toBeNull();
    expect(textStyleOf(screen.getByText('Crisp sourdough.'))?.fontStyle).toBeUndefined();
    fireEvent.click(row);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it.each([null, undefined, ''])('asks for one in faint italic with the pencil when there is none (%s)', (note) => {
    const onEdit = vi.fn();
    render(<VisitNote note={note} onEdit={onEdit} />);
    const row = screen.getByTestId('visit-note-add');
    expect(row.getAttribute('aria-label')).toBe('Write a few lines about this visit');
    expect(textStyleOf(screen.getByText('Write a few lines about this visit'))?.fontStyle).toBe('italic');
    expect(screen.getByTestId('pencil-glyph')).toBeTruthy();
    expect(screen.queryByTestId('visit-note')).toBeNull();
    fireEvent.click(row);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// The pencil on the first line, not the middle of a four-line note
// (owner's recording, 28 Nov 2026): the row hangs from the top, and the
// glyph sits in a box one line tall.
describe('the pencil', () => {
  const flat = (id: string) => StyleSheet.flatten(propsWhere((q) => q.testID === id).style as never) as Record<string, unknown>;
  it('hangs from the top of the note, on its first line, at the note\'s line height', () => {
    render(<VisitNote note="Four lines of words." onEdit={() => {}} lead />);
    expect((StyleSheet.flatten(propsWhere((q) => q.testID === 'visit-note').contentStyle as never) as Record<string, unknown>).alignItems).toBe('flex-start');
    expect(flat('visit-note-pen')).toMatchObject({ height: 22, justifyContent: 'center' });
  });
  it('fits the smaller line where the note is not the card\'s lead', () => {
    render(<VisitNote note="Words." onEdit={() => {}} />);
    expect(flat('visit-note-pen')).toMatchObject({ height: 20 });
  });
});

