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
import { CoverBar, type usePastCover } from './Bar';

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
