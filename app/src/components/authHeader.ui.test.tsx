// @vitest-environment jsdom
//
// The header's own submit (`HeaderAction`), on its own: the two forms that
// wear it test what it saves, and this is what it is — a word that presses
// when there is something to press, and is inert, and says so, when there
// is not.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { AuthHeader } from './authUi';

const draw = (action?: Parameters<typeof AuthHeader>[0]['action']) =>
  render(<AuthHeader onBack={() => {}} title="Edit profile" action={action} />);

describe('the header action', () => {
  it('draws nothing beside the title when there is no action', () => {
    draw();
    expect(screen.getAllByRole('button')).toHaveLength(1); // the back control
  });

  it('presses when it can, and is named by its long label when it has one', () => {
    const onPress = vi.fn();
    draw({ label: 'Save', a11yLabel: 'Save changes', onPress });
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.textContent).toBe('Save');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to the word it shows for its name', () => {
    draw({ label: 'Save', onPress: () => {} });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
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

  // The word gives way to a spinner and the control keeps its name, so a
  // second tap mid-save is explained rather than sent.
  it('spins, keeps its name and refuses a second tap while busy', () => {
    const onPress = vi.fn();
    draw({ label: 'Save', a11yLabel: 'Save changes', onPress, busy: true });
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
