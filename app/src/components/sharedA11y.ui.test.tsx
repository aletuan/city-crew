// @vitest-environment jsdom
//
// What VoiceOver hears from the three controls every screen borrows.
//
// Chip, GradientCta and PrimaryButton are used in twenty-odd places, and
// each screen test that found one of them mute could only work around it
// in its own file. These pin the fix at the source: a chip says it is a
// button and whether it is chosen, a CTA that is not ready says so and
// refuses the press, and the primary button keeps its name while its
// spinner stands in for the words.
//
// Asserted through `aria-*` and the accessible name, which is what
// react-native-web renders — its `accessibilityState` never reaches the
// DOM, which is why the props are the aria forms in the first place.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { Chip, GradientCta } from './ui';
import { PrimaryButton } from './authUi';

describe('Chip', () => {
  it('is a button that says whether it is chosen', () => {
    const onPress = vi.fn();
    const { rerender } = render(<Chip label="Cafés" onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Cafés' });
    expect(chip.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(chip);
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Chip label="Cafés" onPress={onPress} active />);
    expect(screen.getByRole('button', { name: 'Cafés' }).getAttribute('aria-selected')).toBe('true');
  });

  it('is only its words when it does nothing', () => {
    render(<Chip label="Tây Hồ" />);
    expect(screen.queryByRole('button')).toBeNull();
    const words = screen.getByText('Tây Hồ');
    expect(words.closest('[aria-selected]')).toBeNull();
  });
});

describe('GradientCta', () => {
  it('is a button, neither busy nor dimmed, at rest', () => {
    const onPress = vi.fn();
    render(<GradientCta icon="sparkles" label="Sketch the plan" onPress={onPress} />);
    const cta = screen.getByRole('button', { name: 'Sketch the plan' });
    // react-native-web leaves out a false `aria-disabled` rather than
    // printing it — to a screen reader the two are the same.
    expect(cta.getAttribute('aria-disabled')).not.toBe('true');
    expect(cta.getAttribute('aria-busy')).not.toBe('true');
    fireEvent.click(cta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The dimmed CTA used to be dimmed for fingers only: `pointerEvents`
  // stops a touch, not VoiceOver's activate, and nothing told it the
  // button was not ready.
  it('says it is dimmed when not ready, and refuses the press', () => {
    const onPress = vi.fn();
    render(<GradientCta icon="sparkles" label="Sketch the plan" onPress={onPress} disabled />);
    const cta = screen.getByRole('button', { name: 'Sketch the plan' });
    expect(cta.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('says it is busy while it works, and refuses the press', () => {
    const onPress = vi.fn();
    render(<GradientCta icon="refresh" label="Regenerate" onPress={onPress} busy />);
    const cta = screen.getByRole('button', { name: 'Regenerate' });
    expect(cta.getAttribute('aria-busy')).toBe('true');
    expect(cta.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PrimaryButton', () => {
  it('is named by its label and not busy at rest', () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Sign in" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button.getAttribute('aria-busy')).toBe('false');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The spinner replaces the words, and the button's name used to go with
  // them: "button", and nothing else, halfway through signing in.
  it('keeps its name while the spinner stands in for the words, and says it is busy', () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Sign in" onPress={onPress} busy />);
    expect(screen.queryByText('Sign in')).toBeNull();
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
