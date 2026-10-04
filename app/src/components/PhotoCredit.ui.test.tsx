// @vitest-environment jsdom
//
// The photographer's name on a photograph, wherever one is shown. Pinned:
// nothing while the attribution switch is off, nothing for a photograph
// nobody signed, one line when both hold, in the style the caller gives
// — the corner differs by surface, and that is the caller's to say.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';

const state = vi.hoisted(() => ({ credit: false }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));

import PhotoCredit from './PhotoCredit';

beforeEach(() => { state.credit = false; });

describe('PhotoCredit', () => {
  it('prints nothing while the switch is off', () => {
    render(<PhotoCredit name="Photo by Lan" style={{ top: 8 }} />);
    expect(screen.queryByText('Photo by Lan')).toBeNull();
  });

  it('prints the name, once, on one line, where it is told', () => {
    state.credit = true;
    render(<PhotoCredit name="Photo by Lan" style={{ top: 8 }} testID="credit" />);
    const el = screen.getByText('Photo by Lan') as HTMLElement;
    expect(el.style.top).toBe('8px');
    expect(el.getAttribute('data-testid')).toBe('credit');
  });

  it('prints nothing for a photograph nobody signed, even with the switch on', () => {
    state.credit = true;
    // Nothing: not an empty line holding its corner, which an unsigned
    // photograph on a card would otherwise carry.
    const { container } = render(<><PhotoCredit name={null} style={{}} testID="a" /><PhotoCredit name={undefined} style={{}} testID="b" /></>);
    expect(container.querySelector('[data-testid]')).toBeNull();
    expect(container.childElementCount).toBe(0);
  });
});
