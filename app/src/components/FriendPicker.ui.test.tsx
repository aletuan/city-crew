// @vitest-environment jsdom
//
// The strip's four kinds of face, rendered once.
//
// Mounted straight, not through a sheet: a face read through a sheet that
// re-renders after it opens carries the style of its first render, which
// is how a "full strength" assertion on a yes passed for the wrong reason.
// What is pinned is the brightness of each face: a yes that cannot be
// moved stays lit, because it is the one that says yes; a refusal and a
// seat that is not there are dimmed; a live face is untouched.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, viewStyleOf } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import FriendPicker from './FriendPicker';

const people = {
  a: { id: 'a', handle: 'yes', full_name: 'Yes', avatar_url: '' },
  b: { id: 'b', handle: 'no', full_name: 'No', avatar_url: '' },
  c: { id: 'c', handle: 'bench', full_name: 'Bench', avatar_url: '' },
  d: { id: 'd', handle: 'live', full_name: 'Live', avatar_url: '' },
};

const faces = () => render(
  <FriendPicker
    open
    title="Who"
    subtitle="Pick"
    rows={[
      { id: 'a', on: true, off: true, badge: 'Accepted' },
      { id: 'b', on: false, off: true, badge: 'Declined' },
      { id: 'c', on: false, off: true },
      { id: 'd', on: false },
    ]}
    people={people}
    none="nobody"
    cta={{ icon: 'paper-plane-outline', label: 'Go', testID: 'go', disabled: true, onPress: () => {} }}
    rowTestID={(i) => `face-${i}`}
    onToggle={() => {}}
    onClose={() => {}}
  />,
);

const opacity = (i: number) => viewStyleOf(screen.getByTestId(`face-${i}`).firstElementChild!).opacity;

describe('the strip’s faces', () => {
  it('keeps a locked yes lit, and dims a refusal and a benched face', () => {
    faces();
    expect(opacity(0)).toBeUndefined();
    expect(opacity(1)).toBe(0.4);
    expect(opacity(2)).toBe(0.4);
    expect(opacity(3)).toBeUndefined();
  });

  it('writes the answer under the name, and nothing under a face without one', () => {
    faces();
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByText('Declined')).toBeTruthy();
    expect(screen.getByTestId('face-2').textContent).toBe('Bench');
  });
});
