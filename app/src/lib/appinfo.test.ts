import { describe, expect, it, vi } from 'vitest';

// A release build as it launches after taking an OTA: the binary's own
// version from Info.plist, and an update that is not the embedded one.
vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (name: string) => (name === 'ExpoApplication'
    ? { nativeApplicationVersion: '1.0.4', nativeBuildVersion: '22' }
    : null),
}));
vi.mock('expo-updates', () => ({
  channel: 'production',
  runtimeVersion: '57.0.0',
  updateId: '28f91171-a086-4959-78f6-6c4a944d5b67',
  createdAt: new Date(Date.UTC(2026, 8, 29, 2, 50)),
  isEmbeddedLaunch: false,
}));

import { APP_INFO, describeApp, shareText, shortUpdateId, updateDate, versionLabel } from './appinfo';

const RELEASE = {
  channel: 'production', runtimeVersion: '57.0.0',
  updateId: 'abc', createdAt: new Date(0), isEmbeddedLaunch: false,
};

describe('APP_INFO', () => {
  it('reads the binary from the native module and the update from expo-updates', () => {
    expect(APP_INFO).toEqual({
      version: '1.0.4',
      build: '22',
      channel: 'production',
      runtime: '57.0.0',
      update: { id: '28f91171-a086-4959-78f6-6c4a944d5b67', at: new Date(Date.UTC(2026, 8, 29, 2, 50)) },
    });
  });
});

describe('describeApp', () => {
  // The case the file exists for: no native module, which an OTA can
  // meet on an older build. Unknown, not a crash and not app.json's guess.
  it('knows no version without the native module', () => {
    const info = describeApp(null, RELEASE);
    expect(info.version).toBeNull();
    expect(info.build).toBeNull();
  });

  it('treats an empty native answer as unknown', () => {
    expect(describeApp({ nativeApplicationVersion: '', nativeBuildVersion: '' }, RELEASE))
      .toMatchObject({ version: null, build: null });
  });

  it('reports no update while the build runs the code it shipped with', () => {
    expect(describeApp(null, { ...RELEASE, isEmbeddedLaunch: true }).update).toBeNull();
  });

  it('reports no update when there is no id to name it by', () => {
    expect(describeApp(null, { ...RELEASE, updateId: null }).update).toBeNull();
  });

  // A development build or a test run: expo-updates answers with almost
  // nothing, and every field comes back as a plain null.
  it('fills what expo-updates leaves out with null', () => {
    expect(describeApp(null, {})).toEqual({
      version: null, build: null, channel: null, runtime: null, update: null,
    });
    expect(describeApp(null, { updateId: 'abc' }).update).toEqual({ id: 'abc', at: null });
  });
});

describe('versionLabel', () => {
  const info = describeApp({ nativeApplicationVersion: '1.0.4', nativeBuildVersion: '22' }, RELEASE);

  it('writes the version and build the way TestFlight does', () => {
    expect(versionLabel(info)).toBe('1.0.4 (22)');
  });

  it('leaves the build off when there is none', () => {
    expect(versionLabel({ ...info, build: null })).toBe('1.0.4');
  });

  it('has nothing to say without a version', () => {
    expect(versionLabel({ ...info, version: null })).toBeNull();
  });
});

describe('shortUpdateId', () => {
  it('keeps the first group of the id', () => {
    expect(shortUpdateId('28f91171-a086-4959-78f6-6c4a944d5b67')).toBe('28f91171');
  });
});

describe('updateDate', () => {
  // Built from local fields, so the assertion holds on any clock the
  // suite runs on — test:tz included.
  const d = new Date(2026, 8, 9, 7, 5);

  it('writes day first in Vietnamese', () => {
    expect(updateDate(d, 'vi')).toBe('09/09/2026 07:05');
  });

  it('writes year first in Japanese', () => {
    expect(updateDate(d, 'ja')).toBe('2026/09/09 07:05');
  });

  it('names the month in English', () => {
    expect(updateDate(d, 'en')).toBe('9 Sep 2026, 07:05');
    expect(updateDate(new Date(2026, 11, 31, 23, 59), 'en')).toBe('31 Dec 2026, 23:59');
  });
});

describe('shareText', () => {
  it('spells out everything, with the full update id and its time', () => {
    expect(shareText(APP_INFO)).toBe([
      'City Crew 1.0.4 (22)',
      'Channel: production',
      'Runtime: 57.0.0',
      'Update: 28f91171-a086-4959-78f6-6c4a944d5b67 (2026-09-29T02:50:00.000Z)',
    ].join('\n'));
  });

  it('says what it does not know rather than leaving a line out', () => {
    expect(shareText(describeApp(null, {}))).toBe([
      'City Crew unknown version',
      'Channel: none',
      'Runtime: none',
      'Update: shipped with the build',
    ].join('\n'));
  });

  it('leaves the time off an update that has none', () => {
    expect(shareText(describeApp(null, { updateId: 'abc' })).split('\n').at(-1)).toBe('Update: abc');
  });
});
