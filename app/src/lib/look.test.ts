import { describe, expect, it } from 'vitest';
import { LOOK_KEY, PREFS, canHoldLook, lookOf, storeOf, needsRestart, parseLook, parsePref, pinnedScheme, readLook, writeLook } from './look';

describe('look', () => {
  it('reads a stored look, and anything else as the standard one', () => {
    expect(parseLook('coffee')).toBe('coffee');
    expect(parseLook('rose')).toBe('rose');
    expect(parseLook('standard')).toBe('standard');
    expect(parseLook(undefined)).toBe('standard');
    expect(parseLook('charcoal')).toBe('standard');
    expect(parseLook(3)).toBe('standard');
  });

  it('reads a stored setting, and anything else as Automatic', () => {
    for (const p of PREFS) expect(parsePref(p)).toBe(p);
    expect(parsePref(null)).toBe('system');
    expect(parsePref('sepia')).toBe('system');
    expect(parsePref(1)).toBe('system');
  });

  // Light, Dark and Automatic share the standard look, so moving among
  // them stays the instant repaint it always was.
  it('gives the three standard settings one look, and coffee and rose their own', () => {
    expect(lookOf('system')).toBe('standard');
    expect(lookOf('light')).toBe('standard');
    expect(lookOf('dark')).toBe('standard');
    expect(lookOf('coffee')).toBe('coffee');
    expect(lookOf('rose')).toBe('rose');
  });

  it('pins coffee dark and rose light, and lets Automatic follow the phone', () => {
    expect(pinnedScheme('system')).toBeNull();
    expect(pinnedScheme('light')).toBe('light');
    expect(pinnedScheme('dark')).toBe('dark');
    expect(pinnedScheme('coffee')).toBe('dark');
    expect(pinnedScheme('rose')).toBe('light');
  });

  it('asks for a restart only when the look changes', () => {
    expect(needsRestart('standard', 'dark')).toBe(false);
    expect(needsRestart('standard', 'system')).toBe(false);
    expect(needsRestart('standard', 'coffee')).toBe(true);
    expect(needsRestart('coffee', 'coffee')).toBe(false);
    expect(needsRestart('coffee', 'light')).toBe(true);
    expect(needsRestart('rose', 'coffee')).toBe(true);
  });

  it('keeps the key the look is stored under', () => {
    expect(LOOK_KEY).toBe('citycrew.look');
  });

  it('reads the look off a store, and nothing off a missing or broken one', () => {
    expect(readLook({ get: (k) => (k === LOOK_KEY ? 'rose' : 'coffee') })).toBe('rose');
    expect(readLook({ get: () => null })).toBe('standard');
    expect(readLook({})).toBe('standard');
    expect(readLook(undefined)).toBe('standard');
    expect(readLook({ get: () => { throw new Error('no defaults'); } })).toBe('standard');
  });

  it('fetches the store, and nothing where the fetch throws', () => {
    const store = { get: () => null };
    expect(storeOf(() => store)).toBe(store);
    expect(storeOf(() => undefined)).toBeUndefined();
    expect(storeOf(() => { throw new Error('no Settings on this mock'); })).toBeUndefined();
  });

  it('holds a look only where it can be read back', () => {
    expect(canHoldLook({ get: () => null, set: () => {} })).toBe(true);
    expect(canHoldLook({ get: () => null })).toBe(false);
    expect(canHoldLook({ set: () => {} })).toBe(false);
    expect(canHoldLook(undefined)).toBe(false);
  });

  it('writes the look under its key, and says when it could not', () => {
    const kept: Record<string, unknown>[] = [];
    expect(writeLook({ get: () => null, set: (v) => { kept.push(v); } }, 'coffee')).toBe(true);
    expect(kept).toEqual([{ [LOOK_KEY]: 'coffee' }]);
    expect(writeLook({ get: () => null }, 'rose')).toBe(false);
    expect(writeLook(undefined, 'rose')).toBe(false);
    expect(writeLook({ get: () => null, set: () => { throw new Error('full'); } }, 'rose')).toBe(false);
  });
});
