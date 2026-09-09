// One switch, as a subscription. The React half of `flags.ts`.
import { useSyncExternalStore } from 'react';
import { appFlags, type FlagKey } from './flags';

/** The current value of a switch; the component re-renders when it moves. */
export function useFlag(key: FlagKey): boolean {
  return useSyncExternalStore(appFlags.subscribe, () => appFlags.get(key));
}
