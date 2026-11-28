// @vitest-environment jsdom
//
// The bar over a person page's cover — `person/Bar`. The ink it lends
// the controls inside it, read off the context itself: in the dark
// theme the tests run in, the page's ink and the photograph's are the
// same hex, so a glyph's colour cannot tell them apart.
import React, { useContext } from 'react';
import { Animated, Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../uitest/render';
import { BarInk, RoundIconButton } from '../../components/ui';
import { onPhoto } from '../../theme';
import { CoverBar, scrimOver, type usePastCover } from './Bar';

const Probe = () => <Text testID="probe">{String(useContext(BarInk))}</Text>;
const bar = (past: boolean, near = past): ReturnType<typeof usePastCover> => ({
  past, near, bleed: true, onScroll: () => {},
  ground: new Animated.Value(past ? 1 : 0), glass: new Animated.Value(past ? 0 : 1),
  scroll: new Animated.Value(0),
  person: { id: 'p', handle: 'lan', full_name: 'Lan Phạm' } as ReturnType<typeof usePastCover>['person'],
});

describe('CoverBar', () => {
  it('lends its controls the photograph’s light ink over the cover, and the page’s past it', () => {
    const { rerender } = render(<CoverBar bar={bar(false)} tools={<Probe />} />);
    expect(screen.getByTestId('probe').textContent).toBe(onPhoto.text);
    rerender(<CoverBar bar={bar(true)} tools={<Probe />} />);
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });

  it('names the person only once the page’s ground is coming in', () => {
    const { rerender } = render(<CoverBar bar={bar(false)} tools={null} />);
    expect(screen.queryByTestId('person-bar-title')).toBeNull();
    rerender(<CoverBar bar={bar(false, true)} tools={null} />);
    expect(screen.getByTestId('person-bar-title').textContent).toBe('Lan Phạm');
  });

  // While the profile is on its way the cover's place is held and the
  // bar is over it: the way back, and nothing of a person not here yet.
  it('is the way back alone while there is nobody yet', () => {
    render(<CoverBar bar={{ ...bar(false, true), person: null }} onBack={() => {}} backTestID="back" tools={<Probe />} />);
    expect(screen.getByTestId('back')).toBeTruthy();
    expect(screen.queryByTestId('probe')).toBeNull();
    expect(screen.queryByTestId('person-tools-glass')).toBeNull();
    expect(screen.getByTestId('person-bar-title').textContent).toBe('');
  });

  it('draws nothing where there is no cover', () => {
    render(<CoverBar bar={{ ...bar(false), bleed: false }} tools={<Probe />} />);
    expect(screen.queryByTestId('person-bar')).toBeNull();
  });
});

describe('BarInk', () => {
  it('inks a bare control inside it, and gives way to a control’s own colour', () => {
    render(
      <BarInk.Provider value="#123456">
        <RoundIconButton icon="search-outline" bare onPress={() => {}} testID="lent" />
        <RoundIconButton icon="heart" bare color="#ABCDEF" onPress={() => {}} testID="own" />
      </BarInk.Provider>,
    );
    expect(screen.getByTestId('lent').querySelector('[data-icon]')!.getAttribute('data-color')).toBe('#123456');
    expect(screen.getByTestId('own').querySelector('[data-icon]')!.getAttribute('data-color')).toBe('#ABCDEF');
  });
});

// The scrim under the head's words begins 48 over the head and is at
// strength where the head begins (owner's recording, 28 Nov 2026): run
// from the bar's foot, it had a friend's whole cover under 54% of dark.
describe('scrimOver', () => {
  // A 59pt clock: the cover 331 tall, the bar's foot at 109.
  it('is as it was until the head is measured: from the bar’s foot, at strength a fifth down', () => {
    expect(scrimOver(331, 109, null)).toEqual({ top: 109, at: 0.2 });
  });

  it('begins 48 over a head that stands low, and is at strength where the head begins', () => {
    // A friend's head: the face and two lines, 219 down.
    const { top, at } = scrimOver(331, 109, 219);
    expect(top).toBe(171);
    expect(top + at * (331 - top)).toBeCloseTo(219, 6);
  });

  it('never begins over the bar’s foot', () => {
    // Your own head, with a bio and counts: 130 down, 48 over it is 82.
    const { top, at } = scrimOver(331, 109, 130);
    expect(top).toBe(109);
    expect(top + at * (331 - top)).toBeCloseTo(130, 6);
  });

  it('is at strength from its top for a head at the bar, and holds its range for one off the cover', () => {
    expect(scrimOver(331, 109, 60)).toEqual({ top: 109, at: 0 });
    expect(scrimOver(331, 109, 331)).toEqual({ top: 283, at: 1 });
    expect(scrimOver(331, 109, 500)).toEqual({ top: 452, at: 0 });
  });
});

