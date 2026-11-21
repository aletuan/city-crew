// Whether the sheet that explains trip reminders is up — held once for the
// app, because the two that raise it (saving a plan, accepting an
// invitation) leave their screens the moment they succeed, and the sheet
// has to outlive them. A module store read through `useSyncExternalStore`,
// as `lib/reminderPref` and `lib/guideGrant` do it, with the sheet mounted
// once beside `ReminderSync`.
//
// Imports nothing from `lib/reminders`, which imports this: the offer is
// raised from there, where the permission is read, and the answer is
// handled by the sheet through `lib/reminderPref`.

import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function put(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
}

/** Raise the sheet. Safe to call twice: a second save before the first
 *  was answered does not stack a second sheet. */
export function offerReminderAsk(): void { put(true); }

export function closeReminderAsk(): void { put(false); }

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const snapshot = () => open;

export function useReminderAsk(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** For tests: put it away. */
export function resetReminderAsk(): void { put(false); }
