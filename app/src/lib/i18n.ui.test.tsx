// @vitest-environment jsdom
//
// Every string the reader sees passes through `t`, so its fallbacks are
// the difference between a missing translation and a blank button.
//
// The screen tests ran this provider on every render and still left a
// third of its branches unexercised (61% on 9 October): they mount it in
// English and assert English, so the paths that only exist for a gap —
// Japanese with no Japanese, Vietnamese with no Vietnamese, a string with
// no English at all — never ran. Those are exactly the paths a partial
// translation takes in production; the header of `i18n.tsx` promises
// "partial coverage never renders a blank", and this is what holds it.
//
// The stored choice is the other half: a word in storage the app did not
// write (an old build's value, a hand-edited device) must leave the
// reader in English rather than in an unknown language.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '../uitest/render';
import { I18nProvider, spokenIn, useI18n, type Lang } from './i18n';

const KEY = 'citycrew.lang';

// Each row is (en, vi, ja, zh) as a caller would pass it; `null` is a
// translation nobody wrote.
const CASES: [string, string | null, string | null, string | null, string | null][] = [
  ['all three', 'Places', 'Địa điểm', '場所', null],
  ['all four', 'Places', 'Địa điểm', '場所', '地点'],
  ['no Japanese', 'Places', 'Địa điểm', null, null],
  ['no Vietnamese', 'Places', null, '場所', null],
  ['English only', 'Places', null, null, null],
  ['no English', null, 'Địa điểm', null, null],
  ['nothing', null, null, null, null],
];

function Probe() {
  const { lang, setLang, t } = useI18n();
  return (
    <>
      <span data-testid="lang">{lang}</span>
      {CASES.map(([name, en, vi, ja, zh]) => (
        <span key={name} data-testid={name}>{t(en, vi, ja, zh)}</span>
      ))}
      {(['en', 'vi', 'ja', 'zh'] as Lang[]).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)}>{l}</button>
      ))}
    </>
  );
}

const mount = () => render(<I18nProvider><Probe /></I18nProvider>);
const read = (name: string) => screen.getByTestId(name).textContent;
const pick = (l: Lang) => act(() => { screen.getByText(l, { selector: 'button' }).click(); });

beforeEach(async () => {
  await AsyncStorage.removeItem(KEY);
  vi.mocked(AsyncStorage.getItem).mockClear();
});

describe('t', () => {
  it('speaks English first, then Vietnamese, never a blank it can avoid', async () => {
    mount();
    expect(read('all three')).toBe('Places');
    expect(read('no Vietnamese')).toBe('Places');
    expect(read('no English')).toBe('Địa điểm');
    expect(read('nothing')).toBe('');
  });

  it('gives Vietnamese, and English where no Vietnamese was written', async () => {
    mount();
    await pick('vi');
    expect(read('all three')).toBe('Địa điểm');
    expect(read('no Vietnamese')).toBe('Places');
    expect(read('no English')).toBe('Địa điểm');
    expect(read('nothing')).toBe('');
  });

  // The order the header names: Japanese, then English, then Vietnamese.
  // English before Vietnamese because a Japanese reader is likelier to
  // read the former; the last step is only for a string with no English.
  it('gives Japanese, then English, then Vietnamese', async () => {
    mount();
    await pick('ja');
    expect(read('all three')).toBe('場所');
    expect(read('no Japanese')).toBe('Places');
    expect(read('English only')).toBe('Places');
    expect(read('no English')).toBe('Địa điểm');
    expect(read('nothing')).toBe('');
  });

  // Chinese: its own, then English — the string most screens have until
  // their translation lands — then Vietnamese. Never the Japanese, which
  // shares characters with it and is not readable Chinese.
  it('gives Chinese, then English, then Vietnamese, and never Japanese', async () => {
    mount();
    await pick('zh');
    expect(read('all four')).toBe('地点');
    expect(read('all three')).toBe('Places');
    expect(read('no Vietnamese')).toBe('Places');
    expect(read('no English')).toBe('Địa điểm');
    expect(read('nothing')).toBe('');
  });
});

describe('the stored choice', () => {
  it('is written when the reader picks a language', async () => {
    mount();
    await pick('ja');
    expect(read('lang')).toBe('ja');
    expect(await AsyncStorage.getItem(KEY)).toBe('ja');
  });

  it('is read back on the next launch', async () => {
    await AsyncStorage.setItem(KEY, 'vi');
    mount();
    await waitFor(() => expect(read('lang')).toBe('vi'));
    expect(read('all three')).toBe('Địa điểm');
  });

  it('reads Chinese back too', async () => {
    await AsyncStorage.setItem(KEY, 'zh');
    mount();
    await waitFor(() => expect(read('lang')).toBe('zh'));
    expect(read('all four')).toBe('地点');
  });

  it('is ignored when it is not a language the app speaks', async () => {
    await AsyncStorage.setItem(KEY, 'fr');
    mount();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(KEY));
    await act(async () => {});
    expect(read('lang')).toBe('en');
  });

  // Storage can refuse — a full disk, a locked keychain. Neither the read
  // nor the write may take the provider down with it.
  //
  // The write is watched for a handler rather than for an escaped
  // rejection, and through a plain function rather than the shared mock.
  // Both were tried and both passed with the write's `.catch` deleted:
  // nothing in this run reports a rejection nobody handled, and a `vi.fn`
  // attaches a handler of its own to every promise it returns, to record
  // how it settled — so it always looks handled. On a phone the missing
  // handler is a red box in dev and a logged crash in release.
  it('survives storage that refuses to read or write', async () => {
    const store = AsyncStorage as {
      getItem: typeof AsyncStorage.getItem;
      setItem: typeof AsyncStorage.setItem;
    };
    const real = { getItem: store.getItem, setItem: store.setItem };
    const handled = { read: 0, write: 0 };
    // A rejected promise that counts the handlers put on it, or on any
    // promise chained from it — the read is `.then(…).catch(…)`, so its
    // handler lands one link down. Other keys (the harness's own
    // providers) get one quietly, so only this provider is counted.
    const watch = <T,>(p: Promise<T>, as: 'read' | 'write'): Promise<T> => {
      const then = p.then.bind(p);
      return Object.assign(p, {
        then: (ok?: (x: T) => unknown, bad?: (e: unknown) => unknown) => {
          if (bad) handled[as] += 1;
          return watch(then(ok, bad), as);
        },
        catch: (f: (e: unknown) => unknown) => {
          handled[as] += 1;
          return watch(then(undefined, f), as);
        },
      }) as Promise<T>;
    };
    const refuse = (k: string, as: 'read' | 'write') => {
      const p = Promise.reject(new Error(as === 'read' ? 'locked' : 'full'));
      if (k !== KEY) { p.catch(() => {}); return p; }
      return watch(p, as);
    };
    try {
      store.getItem = ((k: string) => refuse(k, 'read')) as typeof store.getItem;
      store.setItem = ((k: string) => refuse(k, 'write')) as typeof store.setItem;
      mount();
      await act(async () => {});
      expect(read('lang')).toBe('en');
      await pick('vi');
      expect(read('lang')).toBe('vi');
      expect(handled).toEqual({ read: 1, write: 1 });
    } finally {
      Object.assign(store, real);
    }
  });
});

describe('without a provider', () => {
  it('falls back to English and a picker that does nothing', () => {
    function Bare() {
      const { lang, setLang, t } = useI18n();
      setLang('vi');
      return <span data-testid="bare">{lang}:{t('Places', 'Địa điểm')}:{t(null, 'Địa điểm')}</span>;
    }
    render(<Bare />);
    expect(read('bare')).toBe('en:Places:');
  });
});

// `t` is `spokenIn` plus a lookup, so the order is tested once, here, and
// the screens that ask "did I fall back?" get the same answer `t` gave.
describe('spokenIn', () => {
  it('names the slot each reader is handed, in the provider’s own order', () => {
    expect(spokenIn('en', 'a', 'b', 'c')).toBe('en');
    expect(spokenIn('en', null, 'b', 'c')).toBe('vi');
    expect(spokenIn('en', null, null, 'c')).toBeNull();
    expect(spokenIn('vi', 'a', 'b', 'c')).toBe('vi');
    expect(spokenIn('vi', 'a', null, 'c')).toBe('en');
    expect(spokenIn('vi', null, null, 'c')).toBeNull();
    expect(spokenIn('ja', 'a', 'b', 'c')).toBe('ja');
    expect(spokenIn('ja', 'a', 'b')).toBe('en');
    expect(spokenIn('ja', null, 'b')).toBe('vi');
    expect(spokenIn('ja', null, null, null)).toBeNull();
    expect(spokenIn('zh', 'a', 'b', 'c', 'd')).toBe('zh');
    expect(spokenIn('zh', 'a', 'b', 'c')).toBe('en');
    expect(spokenIn('zh', null, 'b', 'c')).toBe('vi');
    expect(spokenIn('zh', null, null, 'c')).toBeNull();
  });

  it('treats an empty string as written, exactly as t does', () => {
    expect(spokenIn('ja', 'a', 'b', '')).toBe('ja');
  });
});
