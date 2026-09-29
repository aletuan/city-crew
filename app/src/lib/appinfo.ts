// Which copy of the app this is: the binary, the channel it was stamped
// with, and the update it is running.
//
// Three answers that come from two places and are easy to mix up. The
// version a reader would quote is the *binary's* — what TestFlight and the
// App Store call it — and it is not `app.json`'s: `Constants.expoConfig`
// is the manifest of the update that launched, so after an OTA published
// from a tree already bumped to 1.0.5, a 1.0.4 install reads its config
// and calls itself 1.0.5. The binary's own Info.plist is the only place
// the installed version is written, and `ExpoApplication` is what reads it.
//
// That module is asked for with `requireOptionalNativeModule`, never
// `expo-application`'s own import, which throws when the native half is
// missing. It is in the builds this was written against — linked in with
// `expo-notifications` — but this file travels by OTA to every build
// with the same runtime, and a build without it should read "unknown",
// not crash on Profile.
//
// Nothing here leaves the phone. It is read on the device and shown on the
// device; sharing it is the reader's own act, through the system sheet.

import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Updates from 'expo-updates';

type NativeApplication = {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
};

/** What is read off `expo-updates`. Optional throughout, because a
 *  development build or a test run answers with less than a release. */
type UpdatesInfo = {
  channel?: string | null;
  runtimeVersion?: string | null;
  updateId?: string | null;
  createdAt?: Date | null;
  isEmbeddedLaunch?: boolean;
};

export type AppInfo = {
  /** The binary's marketing version, `CFBundleShortVersionString`. */
  version: string | null;
  /** The binary's build number, `CFBundleVersion`. */
  build: string | null;
  channel: string | null;
  runtime: string | null;
  /**
   * The update running now, or null when the code is the one the binary
   * shipped with — an install that has not taken an OTA yet, or a
   * development build that never takes one.
   */
  update: { id: string; at: Date | null } | null;
};

export function describeApp(native: NativeApplication | null, updates: UpdatesInfo): AppInfo {
  return {
    version: native?.nativeApplicationVersion || null,
    build: native?.nativeBuildVersion || null,
    channel: updates.channel ?? null,
    runtime: updates.runtimeVersion ?? null,
    update: !updates.isEmbeddedLaunch && updates.updateId
      ? { id: updates.updateId, at: updates.createdAt ?? null }
      : null,
  };
}

export const APP_INFO: AppInfo = describeApp(
  requireOptionalNativeModule<NativeApplication>('ExpoApplication'),
  Updates,
);

/** "1.0.4 (22)", the way TestFlight writes it; null when unknown. */
export function versionLabel(info: AppInfo): string | null {
  if (!info.version) return null;
  return info.build ? `${info.version} (${info.build})` : info.version;
}

/**
 * The update's id cut to its first eight characters — the first group of
 * the UUID, enough to tell two updates apart on the EAS page, where the
 * full id is one click away.
 */
export function shortUpdateId(id: string): string {
  return id.slice(0, 8);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * When an update was published, in the phone's own time, in the order the
 * reader's language writes a date. Written out by hand rather than through
 * `Intl`: the three orders are all that is wanted, and a formatter that
 * varies with the device's region settings would print a date the reader
 * then has to read twice.
 */
export function updateDate(d: Date, lang: 'en' | 'vi' | 'ja'): string {
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (lang === 'ja') return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${time}`;
  if (lang === 'vi') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${d.getDate()} ${month} ${d.getFullYear()}, ${time}`;
}

/**
 * The whole answer as plain text, for the share sheet — what somebody
 * pastes into a message when asked "which version are you on?". English
 * whatever the app's language: it is read by whoever maintains the app,
 * and the full update id is here because the one on screen is cut short.
 */
export function shareText(info: AppInfo): string {
  return [
    `City Crew ${versionLabel(info) ?? 'unknown version'}`,
    `Channel: ${info.channel ?? 'none'}`,
    `Runtime: ${info.runtime ?? 'none'}`,
    info.update
      ? `Update: ${info.update.id}${info.update.at ? ` (${info.update.at.toISOString()})` : ''}`
      : 'Update: shipped with the build',
  ].join('\n');
}
