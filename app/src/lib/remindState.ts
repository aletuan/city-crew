// What the Account row for trip reminders says, from the two facts it
// depends on — the phone's permission and the reader's own switch.
//
// Pure, like every module the gate can see; `lib/reminderPref` reads the
// phone and the storage and hands the answers in.
//
// ── why four states and not a switch ──
//
// iOS raises its permission sheet once. After a "Don't Allow" the app can
// ask as often as it likes and nothing appears, so a switch that is shown
// as a switch there is a control that does nothing. The row is a switch
// where pressing it can work, and a way into the phone's Settings where
// only the reader can:
//
//   ask      never asked      switch off; pressing it raises the sheet
//   on       allowed, wanted  switch on
//   off      allowed, but the reader switched them off here
//   blocked  refused in iOS   no switch: a row that opens Settings
//
// "off" is the reader's own and lives on the phone (`OFF_KEY`): the
// sync that runs at every launch would otherwise plant again what a
// switch had just pulled.

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
export type RemindState = 'ask' | 'on' | 'off' | 'blocked';

/** Where the reader's own "off" is kept, on this phone. */
export const OFF_KEY = 'reminders:off';

/** The stored answer: only a written "1" is off, so a missing or odd
 *  value reads as the default, which is on. */
export function offFrom(raw: string | null): boolean {
  return raw === '1';
}

/** What the OS reports, as the three states a row can act on. Not asked
 *  is the only state in which it will still show its sheet. */
export function permissionOf(p: { granted: boolean; canAskAgain: boolean }): PermissionStatus {
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Null until both facts are known: the row is not drawn on a guess. */
export function remindState(status: PermissionStatus | null, off: boolean | null): RemindState | null {
  if (status === null || off === null) return null;
  if (status === 'denied') return 'blocked';
  if (status === 'undetermined') return 'ask';
  return off ? 'off' : 'on';
}
