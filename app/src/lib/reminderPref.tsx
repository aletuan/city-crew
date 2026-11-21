// The two facts the Account row for trip reminders turns on — the phone's
// permission and the reader's own switch — held once for the whole app,
// because two places read them: the row, which changes them, and
// `ReminderSync`, which has to plant or pull when either does.
//
// A module-level store read through `useSyncExternalStore`, as
// `lib/guideGrant` does it, and for the same reason: the row and the sync
// are far apart in the tree, and a context provider between them would be
// a third thing to mount for two readers.
//
// The permission is read again whenever the app comes back to the
// foreground. That is how a reader who was sent to iOS Settings and
// switched notifications on finds the row changed, and the sync planting
// the reminders, without a restart or a tap.

import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askReminderPermission, cancelAllTripReminders, reminderPermission } from './reminders';
import { OFF_KEY, offFrom, remindState, type PermissionStatus, type RemindState } from './remindState';

type Held = { status: PermissionStatus | null; off: boolean | null };

let held: Held = { status: null, off: null };
const listeners = new Set<() => void>();

function put(next: Partial<Held>) {
  held = { ...held, ...next };
  listeners.forEach((l) => l());
}

/** Read both again. Each answer lands on its own, so one that is slow does
 *  not hold the other back. */
export async function loadReminderPref(): Promise<void> {
  await Promise.all([
    reminderPermission().then((status) => put({ status })),
    AsyncStorage.getItem(OFF_KEY).then((raw) => put({ off: offFrom(raw) }), () => put({ off: false })),
  ]);
}

/** The reader's press on the row's switch. */
async function setOn(on: boolean): Promise<void> {
  if (!on) {
    put({ off: true });
    AsyncStorage.setItem(OFF_KEY, '1').catch(() => {});
    await cancelAllTripReminders();
    return;
  }
  // Raises the sheet when never asked; where it was refused the row is not
  // a switch, so this is only reached allowed or not asked.
  if (!(await askReminderPermission())) {
    put({ status: await reminderPermission() });
    return;
  }
  put({ status: 'granted', off: false });
  AsyncStorage.removeItem(OFF_KEY).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const snapshot = () => held;

/** What the row draws and what the sync obeys. */
export function useReminderPref(): { state: RemindState | null; off: boolean | null; status: PermissionStatus | null; setOn: (on: boolean) => Promise<void> } {
  const { status, off } = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { state: remindState(status, off), off, status, setOn };
}

/** Mounted once, beside the sync: reads at launch and on every return to
 *  the foreground. */
export function useReminderPrefWatch(): void {
  useEffect(() => {
    void loadReminderPref();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void loadReminderPref();
    });
    return () => sub.remove();
  }, []);
}

/** For tests: forget what was read. */
export function resetReminderPref(): void {
  held = { status: null, off: null };
}
