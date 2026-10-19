import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS, isRemote, namesPreset, presetOf, presetUrl } from './avatars';

describe('the preset faces', () => {
  it('are the eight animals the owner supplied, each named in three languages', () => {
    expect(AVATAR_PRESETS.map((p) => p.key)).toEqual([
      'koala', 'kangaroo', 'wombat', 'quokka', 'platypus', 'echidna', 'kookaburra', 'emu',
    ]);
    for (const p of AVATAR_PRESETS) {
      expect(p.en && p.vi && p.ja, p.key).toBeTruthy();
    }
  });

  it('round-trips through what avatar_url holds', () => {
    for (const p of AVATAR_PRESETS) expect(presetOf(presetUrl(p.key))).toBe(p.key);
    expect(presetUrl('emu')).toBe('preset:emu');
  });

  // A photograph, nothing at all, or an animal a newer build added: none
  // of them is a preset this build can draw.
  it('reads anything else as no preset', () => {
    for (const url of ['https://x/avatars/u1/avatar.jpg?v=1', '', null, undefined, 'preset:', 'preset:dingo', 'koala']) {
      expect(presetOf(url), String(url)).toBeNull();
    }
  });

  it('knows a preset by its form, whether or not this build has the animal', () => {
    expect(namesPreset('preset:koala')).toBe(true);
    expect(namesPreset('preset:dingo')).toBe(true);
    expect(namesPreset('https://x/a.jpg')).toBe(false);
    expect(namesPreset(null)).toBe(false);
  });

  it('tells a face on a server from one in the app', () => {
    expect(isRemote('https://x/a.jpg')).toBe(true);
    expect(isRemote('http://x/a.jpg')).toBe(true);
    expect(isRemote('preset:koala')).toBe(false);
    expect(isRemote('')).toBe(false);
    expect(isRemote(null)).toBe(false);
  });
});
