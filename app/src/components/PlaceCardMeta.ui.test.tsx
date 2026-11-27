// @vitest-environment jsdom
//
// The meta line's two cases the card's own suite never builds: an hour
// with nothing for the pin to point at, and a line drawn without a
// testID (Search's card passes one, a future caller need not).

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '../uitest/render';
import { PlaceCardMeta } from './PlaceCardMeta';

afterEach(cleanup);

describe('PlaceCardMeta', () => {
  it('says the hour with no pin when there is no district and no distance', () => {
    const { container } = render(
      <PlaceCardMeta where={null} far={null} when="until 22:00" kind={null} more={0} testID="m" />,
    );
    expect(container.textContent).toBe('until 22:00');
    expect(container.querySelector('[data-icon="location-outline"]')).toBeNull();
  });

  it('keeps the pin while a district stands before the hour', () => {
    const { container } = render(
      <PlaceCardMeta where="Kim Liên" far={null} when="until 22:00" kind={null} more={0} testID="m" />,
    );
    expect(container.textContent).toBe('Kim Liên · until 22:00');
    expect(container.querySelector('[data-icon="location-outline"]')).toBeTruthy();
  });

  it('draws the figures with no testID when it is given none', () => {
    const { container } = render(
      <PlaceCardMeta where={null} far="850 m" when={null} kind={null} more={0} />,
    );
    expect(container.textContent).toBe('850 m');
    expect(container.querySelector('[data-testid]')).toBeNull();
  });
});
