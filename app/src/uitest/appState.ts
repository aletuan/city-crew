// The app coming back to the foreground, on demand.
//
// Four providers ask their lists again when the app returns from the
// background and the list is more than `STALE_MS` old (`lib/stale`). A
// test needs two things to see that happen, and jsdom has neither: an
// AppState that changes, and a clock that has moved on. This stands in
// for both, so each provider's test says what it expects in three lines
// rather than rebuilding the harness.
//
// Every listener registered while the stub is up hears the event, so a
// tree holding more than one provider behaves as the app does.

import { AppState } from 'react-native';
import { vi } from 'vitest';
import { act } from './render';

export function appStateStub() {
  const listeners = new Set<(state: string) => void>();
  const spy = vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    const listener = fn as (state: string) => void;
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } } as ReturnType<typeof AppState.addEventListener>;
  });
  let clock: ReturnType<typeof vi.spyOn> | null = null;
  return {
    /** Moves `Date.now` this far past the real one, for every read after. */
    later: (ms: number) => {
      const at = Date.now() + ms;
      clock?.mockRestore();
      clock = vi.spyOn(Date, 'now').mockReturnValue(at);
    },
    /** Sends one AppState change to everything listening. */
    emit: (state: 'active' | 'background' | 'inactive') => act(() => {
      for (const listener of listeners) listener(state);
    }),
    restore: () => { spy.mockRestore(); clock?.mockRestore(); },
  };
}
