// One switch, as a subscription. The React half of `flags.ts`.
import { useSyncExternalStore } from 'react';
import { appFlags, type FlagKey } from './flags';

/** The current value of a switch; the component re-renders when it moves. */
export function useFlag(key: FlagKey): boolean {
  return useSyncExternalStore(appFlags.subscribe, () => appFlags.get(key));
}

/** Whether the switches are an answer yet — remembered from the last
 *  launch or read from the table (`Flags.ready`). */
export function useFlagsReady(): boolean {
  return useSyncExternalStore(appFlags.subscribe, () => appFlags.ready());
}
