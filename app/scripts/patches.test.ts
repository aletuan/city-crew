// Every patch in `patches/` is applied, and is for the version installed.
//
// `postinstall` runs `patch-package`, and a patch that no longer applies
// warns rather than fails: an upgrade of the library would quietly drop
// the fix, and nothing would say so until a phone did. The pins on the
// Explore map were invisible for one build for exactly that kind of
// reason — a native line that stopped working with no error anywhere — so
// this holds each patch to two facts CI can read without a phone: the
// version in its file name is the one in node_modules, and a line it adds
// is in the file it patched. When either fails, look first at whether the
// new version fixed the bug upstream; if it did, delete the patch.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const patches = readdirSync(join(app, 'patches')).filter((f) => f.endsWith('.patch'));

/** `react-native-maps+1.29.11.patch` → the package and the version. */
function parse(file: string): { name: string; version: string } {
  const m = /^(.+)\+([^+]+)\.patch$/.exec(file)!;
  return { name: m[1].replace('+', '/'), version: m[2] };
}

describe('patches', () => {
  it('has the one patch this file was written for', () => {
    expect(patches).toEqual(['react-native-maps+1.29.11.patch']);
  });

  it.each(patches)('%s is for the version installed', (file) => {
    const { name, version } = parse(file);
    const installed = JSON.parse(readFileSync(join(app, 'node_modules', name, 'package.json'), 'utf8')).version;
    expect(installed).toBe(version);
  });

  // The marker line is the patch's own comment, so it cannot be in the
  // library by accident.
  it('has loaded marker images without the legacy bridge', () => {
    const marker = readFileSync(join(app, 'node_modules/react-native-maps/ios/AirGoogleMaps/AIRGoogleMapMarker.m'), 'utf8');
    expect(marker).toContain('City Crew patch (patches/react-native-maps+1.29.11.patch)');
    // Both the picture pins and the icon path go through the fallback;
    // neither asks the bridge directly any more.
    expect(marker.match(/AIRGoogleLoadImage\(_(image|icon)Src/g)).toHaveLength(2);
    expect(marker.match(/\[\[RCTBridge currentBridge\] moduleForName:@"ImageLoader"\]/g)).toHaveLength(1);
  });
});
