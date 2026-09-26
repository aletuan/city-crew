// @vitest-environment jsdom
//
// The app's only crash guard, and until this file it had no test of any
// kind — in either of the two copies it used to exist in. What is pinned
// here is the whole of its contract: a working child is left alone, a
// child that throws takes the map away and nothing else.
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';
import MapBoundary from './MapBoundary';

// React writes the caught error to `console.error` on its way past, twice
// — once for the throw and once for the boundary. That is React working,
// not the test failing, so it is silenced here rather than left to look
// like a broken run.
let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => { quiet = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { quiet.mockRestore(); });

function Boom(): React.ReactElement {
  throw new Error('react-native-maps blew up on mount');
}

it('leaves a child that works alone', () => {
  const { container } = render(
    <MapBoundary><div data-testid="map">the map</div></MapBoundary>,
  );
  expect(container.querySelector('[data-testid="map"]')).not.toBeNull();
});

it('renders nothing at all when the map throws, rather than taking the screen with it', () => {
  const { container } = render(
    <MapBoundary><Boom /></MapBoundary>,
  );
  expect(container.innerHTML).toBe('');
});

// The no-retry decision, asserted rather than left to the comment: once
// it has failed there is no path back, so a re-render with a child that
// would work still shows nothing. Offering a retry that re-crashes the
// screen was considered and rejected; this is the test that would fail if
// somebody added one without reading why.
it('stays failed once it has failed', () => {
  const { container, rerender } = render(
    <MapBoundary><Boom /></MapBoundary>,
  );
  rerender(<MapBoundary><div data-testid="map">the map</div></MapBoundary>);
  expect(container.querySelector('[data-testid="map"]')).toBeNull();
});
