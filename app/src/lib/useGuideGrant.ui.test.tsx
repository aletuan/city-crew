// @vitest-environment jsdom
//
// The React half of the guide grant: the one launch request, and the two
// hooks that read what it brought back.
//
// The store itself — who counts as a guide where, the uid check, the
// idempotent load — is `guideGrant.test.ts`'s, at 100% in Node. What is
// left here is the wiring nothing in Node can reach: that the launch asks
// *both* questions (the guide's cities and the editor's hand, since #717
// one request for two answers), that the answers reach every hook reading
// them on the next render, and that a change of account asks again.

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '../uitest/render';
import { cacheKey, packCache } from './data/cache';

const world = vi.hoisted(() => ({ uid: 'u1' as string | null }));
const fetchGuideCities = vi.hoisted(() => vi.fn(async () => [] as (string | null)[]));
const fetchIsEditor = vi.hoisted(() => vi.fn(async () => false));

vi.mock('./auth', () => ({
  useAuth: () => ({ session: world.uid ? { user: { id: world.uid } } : null }),
}));
vi.mock('./data', () => ({ fetchGuideCities, fetchIsEditor }));

import { guideGrant } from './guideGrant';
import { GuideGrantSync, useGrantSettled, useIsEditor, useIsGuide, useIsGuideAnywhere } from './useGuideGrant';

function Probe() {
  return (
    <>
      <span data-testid="hue">{String(useIsGuide('hue'))}</span>
      <span data-testid="danang">{String(useIsGuide('danang'))}</span>
      <span data-testid="unnamed">{String(useIsGuide(null))}</span>
      <span data-testid="editor">{String(useIsEditor())}</span>
      <span data-testid="anywhere">{String(useIsGuideAnywhere())}</span>
      <span data-testid="settled">{String(useGrantSettled())}</span>
    </>
  );
}
const mount = () => render(<><GuideGrantSync /><Probe /></>);
const read = (id: string) => screen.getByTestId(id).textContent;

beforeEach(async () => {
  guideGrant.reset();
  for (const uid of ['u1', 'u2']) await AsyncStorage.removeItem(cacheKey('grant', 'all', uid));
  world.uid = 'u1';
  fetchGuideCities.mockReset().mockResolvedValue([]);
  fetchIsEditor.mockReset().mockResolvedValue(false);
});

describe('the launch question', () => {
  it('asks both halves once, and a guide of one city is a guide there only', async () => {
    fetchGuideCities.mockResolvedValue(['hue']);
    mount();
    await waitFor(() => expect(read('hue')).toBe('true'));
    expect(read('danang')).toBe('false');
    // A place nobody has named yet belongs to no one city.
    expect(read('unnamed')).toBe('false');
    // ...but the account is a guide, which is what its own profile asks.
    expect(read('anywhere')).toBe('true');
    expect(read('editor')).toBe('false');
    expect(fetchGuideCities).toHaveBeenCalledOnce();
    expect(fetchIsEditor).toHaveBeenCalledOnce();
  });

  it('brings the editor’s answer back with it', async () => {
    fetchIsEditor.mockResolvedValue(true);
    mount();
    await waitFor(() => expect(read('editor')).toBe('true'));
    // Being the desk's hand is not a guide grant: the panel's own rules
    // still see a reader, and the gallery is what `editor` opens.
    expect(read('hue')).toBe('false');
  });

  it('answers for every city when the grant is for all of them', async () => {
    fetchGuideCities.mockResolvedValue([null]);
    mount();
    await waitFor(() => expect(read('unnamed')).toBe('true'));
    expect(read('hue')).toBe('true');
    expect(read('danang')).toBe('true');
  });

  it('asks nothing for a guest, and answers no', async () => {
    world.uid = null;
    mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchGuideCities).not.toHaveBeenCalled();
    expect(fetchIsEditor).not.toHaveBeenCalled();
    expect(read('editor')).toBe('false');
    expect(read('unnamed')).toBe('false');
  });

  it('is unsettled until the answer lands, and settled after', async () => {
    let answer!: (v: boolean) => void;
    fetchIsEditor.mockImplementation(() => new Promise<boolean>((r) => { answer = r; }));
    mount();
    expect(read('settled')).toBe('false');
    answer(true);
    await waitFor(() => expect(read('settled')).toBe('true'));
    expect(read('editor')).toBe('true');
  });

  it('has nothing to wait for as a guest', () => {
    world.uid = null;
    mount();
    expect(read('settled')).toBe('true');
  });

  it('asks again for the next account, and forgets the last one’s answer', async () => {
    fetchIsEditor.mockResolvedValue(true);
    const { rerender } = mount();
    await waitFor(() => expect(read('editor')).toBe('true'));
    fetchIsEditor.mockResolvedValue(false);
    world.uid = 'u2';
    rerender(<><GuideGrantSync /><Probe /></>);
    await waitFor(() => expect(fetchIsEditor).toHaveBeenCalledTimes(2));
    expect(read('editor')).toBe('false');
  });
});

// Last launch's answer, stashed the way the profile row is, so a badge
// the reader had yesterday is on the first frame today.
describe('the remembered answer', () => {
  const key = cacheKey('grant', 'all', 'u1');

  it('primes the stash while the question is out, and lets the answer replace it', async () => {
    await AsyncStorage.setItem(key, packCache([{ cities: ['hue'], editor: true }], Date.now()));
    let answer!: (v: boolean) => void;
    fetchIsEditor.mockImplementation(() => new Promise<boolean>((r) => { answer = r; }));
    fetchGuideCities.mockImplementation(() => new Promise(() => {}));
    mount();
    await waitFor(() => expect(read('editor')).toBe('true'));
    expect(read('hue')).toBe('true');
    expect(read('settled')).toBe('false');
    // Cities never answer, so the ask as a whole never settles: what was
    // remembered stands. (A settled no is `guideGrant.test.ts`'s case.)
    answer(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(read('editor')).toBe('true');
  });

  it('writes the answer to the stash for the next launch', async () => {
    fetchGuideCities.mockResolvedValue(['hue']);
    fetchIsEditor.mockResolvedValue(true);
    mount();
    await waitFor(() => expect(read('settled')).toBe('true'));
    await waitFor(async () => expect(await AsyncStorage.getItem(key)).toBeTruthy());
    const stashed = JSON.parse((await AsyncStorage.getItem(key))!);
    expect(stashed.data).toEqual([{ cities: ['hue'], editor: true }]);
  });

  it('ignores a stash from another account', async () => {
    await AsyncStorage.setItem(cacheKey('grant', 'all', 'u2'), packCache([{ cities: [null], editor: true }], Date.now()));
    fetchIsEditor.mockImplementation(() => new Promise(() => {}));
    mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(read('editor')).toBe('false');
    expect(read('anywhere')).toBe('false');
  });

  it('ignores a stash it cannot read', async () => {
    await AsyncStorage.setItem(key, 'not json');
    fetchIsEditor.mockResolvedValue(true);
    mount();
    await waitFor(() => expect(read('editor')).toBe('true'));
  });
});
