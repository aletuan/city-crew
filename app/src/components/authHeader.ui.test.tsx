// @vitest-environment jsdom
//
// The header's own submit (`HeaderAction`), on its own: the two forms that
// wear it test what it saves, and this is what it is — a round ✓ that
// presses when there is something to press, and is inert, and says so,
// when there is not.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { PALETTES } from '../theme';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { AuthHeader } from './authUi';

const draw = (action?: Parameters<typeof AuthHeader>[0]['action']) =>
  render(<AuthHeader onBack={() => {}} title="Edit profile" action={action} />);

/** `#RRGGBB` as jsdom reports a background. */
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

describe('the header action', () => {
  it('draws nothing beside the title when there is no action', () => {
    draw();
    expect(screen.getAllByRole('button')).toHaveLength(1); // the back control
  });

  // A mark, named for VoiceOver by what it does; the mark says nothing.
  it('is a ✓ named by its label, and presses when it can', () => {
    const onPress = vi.fn();
    draw({ label: 'Save changes', onPress });
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.querySelector('[data-icon="checkmark"]')).toBeTruthy();
    expect(button.textContent).not.toContain('Save');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Lit, the accent as a surface — `accentFill`, whatever the look; the
  // runner wears charcoal, whose fill is the coral.
  it('fills with the look’s accent when lit, and with the back control’s glass when not', () => {
    const { unmount } = draw({ label: 'Save', onPress: () => {} });
    // The fill is on the pressable's inner, scaling view (`PressableScale`).
    const lit = screen.getByRole('button', { name: 'Save' }).firstElementChild!;
    expect(getComputedStyle(lit).backgroundColor).toBe(rgb(PALETTES.charcoal.accentFill));
    const litClass = lit.className;
    unmount();
    draw({ label: 'Save', onPress: () => {}, disabled: true });
    const dim = screen.getByRole('button', { name: 'Save' }).firstElementChild!;
    expect(getComputedStyle(dim).backgroundColor).not.toBe(rgb(PALETTES.charcoal.accentFill));
    expect(dim.className).not.toBe(litClass);
  });

  // Dimmed, not hidden — and inert, so a tap on it writes nothing.
  it('is inert and says so while there is nothing to submit', () => {
    const onPress = vi.fn();
    draw({ label: 'Save', onPress, disabled: true });
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  // The mark gives way to a spinner and the control keeps its name, so a
  // second tap mid-save is explained rather than sent.
  it('spins, keeps its name and refuses a second tap while busy', () => {
    const onPress = vi.fn();
    draw({ label: 'Save changes', onPress, busy: true });
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('[data-icon="checkmark"]')).toBeNull();
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
