// @vitest-environment jsdom
//
// The sheet over a visit: what it says over a fresh one and over an old
// one; that every way out of a fresh one keeps the words and only Save
// keeps them on an old one; what is written and what is left alone; that
// a failed save keeps the sheet and the words; and what moves.

import React from 'react';
import { Alert, Animated } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, propsWhere, render, screen, viewStyleOf, within } from '../uitest/render';
import { NOTE_MAX } from '../lib/checkin';
import { appFlags } from '../lib/flags';

const data = vi.hoisted(() => ({
  saveCheckin: vi.fn(async (_id: string, _said: { note: string | null; audience?: string }) => {}),
}));
vi.mock('../lib/data', () => ({ saveCheckin: data.saveCheckin }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
const i18n = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: i18n.lang, t: (en: string, vi?: string) => (i18n.lang === 'vi' ? vi : en) ?? en }) }));
const motion = vi.hoisted(() => ({ still: false }));
const upload = vi.hoisted(() => vi.fn());
vi.mock('../lib/data/checkinPhotos', () => ({ uploadCheckinPhoto: upload }));
vi.mock('./ui', async (orig) => ({ ...(await orig<Record<string, unknown>>()), useReducedMotion: () => motion.still }));
// The photos' own behaviour is `VisitPhotos.ui.test.tsx`'s; here they are a
// hook the sheet asks whether anything changed.
const pics = vi.hoisted(() => ({
  args: [] as unknown[],
  changed: false,
  tiles: [] as unknown[],
}));
// A phone's window, for the viewer's pages (jsdom's is 0×0).
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));
vi.mock('./useVisitPhotos', () => ({
  useVisitPhotos: (...args: unknown[]) => {
    pics.args = args;
    return {
      tiles: pics.tiles, room: 3,
      add: async () => {}, retry: () => {}, remove: () => {},
      changed: () => pics.changed,
    };
  },
}));

import CheckinSheet, { type SheetVisit } from './CheckinSheet';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
const onClose = vi.fn();
const FRESH: SheetVisit = { id: 'k9', name: 'Cộng Cà Phê', cover: 'https://x/cong.jpg', at: '2026-11-24T03:00:00Z', note: null, audience: 'friends', fresh: true };
// Midday UTC: the same day on the suite's New York clock (`test:tz`).
const OLD: SheetVisit = { ...FRESH, id: 'k1', at: '2026-10-08T12:00:00Z', audience: 'private', fresh: false };
const show = (visit: SheetVisit | null, withAudience = false) =>
  render(<CheckinSheet visit={visit} onClose={onClose} withAudience={withAudience} />);
const field = () => screen.getByTestId('checkin-sheet-note') as HTMLTextAreaElement;
const type = (words: string) => fireEvent.change(field(), { target: { value: words } });
const press = (id: string) => act(async () => { fireEvent.click(screen.getByTestId(id)); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  data.saveCheckin.mockImplementation(async () => {});
  i18n.lang = 'en';
  motion.still = false;
  Object.assign(pics, { args: [], changed: false });
  appFlags.set('checkin_photos', false);
  appFlags.set('checkin_public', false);
  pics.tiles = [];
});
afterEach(() => { cleanup(); });

describe('CheckinSheet', () => {
  it('draws nothing with no visit', () => {
    show(null);
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
  });

  it('says a fresh visit is checked in, names the place, and leaves the keyboard down', () => {
    show(FRESH);
    expect(screen.getByTestId('checkin-sheet-name').textContent).toBe('Cộng Cà Phê');
    expect(screen.getByTestId('checkin-sheet-done').textContent).toBe('Checked in');
    expect(screen.queryByTestId('checkin-sheet-when')).toBeNull();
    expect(propsWhere((p) => p.testID === 'checkin-sheet-note').autoFocus).toBeFalsy();
    expect(screen.getByTestId('checkin-sheet-save').textContent).toBe('Done');
  });

  // Nor on an old one (owner, 26 Nov 2026): the keyboard comes when the
  // field is touched, whichever way the sheet was opened.
  it('says the day of an old visit, not that it was just made, and leaves the keyboard down there too', () => {
    i18n.lang = 'vi';
    show({ ...OLD, note: 'Bánh mì giòn.', cover: null });
    expect(screen.getByTestId('checkin-sheet-when').textContent).toBe('08/10');
    expect(screen.queryByTestId('checkin-sheet-done')).toBeNull();
    expect(field().value).toBe('Bánh mì giòn.');
    expect(propsWhere((p) => p.testID === 'checkin-sheet-note').autoFocus).toBeFalsy();
    expect(screen.getByTestId('checkin-sheet-save').textContent).toBe('Lưu');
  });

  it('writes the words, trimmed, on Done, and nothing about who sees it while that is not asked', async () => {
    show(FRESH);
    type('  Crisp sourdough.  ');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenCalledWith('k9', { note: 'Crisp sourdough.' });
    expect(onClose).toHaveBeenCalledWith(true, false);
  });

  it('writes nothing for a fresh visit left without words', async () => {
    show(FRESH);
    type('   ');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('keeps the words of a fresh visit on a tap outside too', async () => {
    show(FRESH);
    type('Quiet upstairs.');
    await press('checkin-sheet-close');
    expect(data.saveCheckin).toHaveBeenCalledWith('k9', { note: 'Quiet upstairs.' });
    expect(onClose).toHaveBeenCalledWith(true, false);
  });

  it('treats the back gesture as the tap outside: kept on a fresh visit, dropped on an old one', async () => {
    const back = () => act(async () => {
      (propsWhere((p) => 'onRequestClose' in p).onRequestClose as () => void)();
      await Promise.resolve(); await Promise.resolve();
    });
    show(FRESH);
    type('Quiet upstairs.');
    await back();
    expect(data.saveCheckin).toHaveBeenCalledWith('k9', { note: 'Quiet upstairs.' });
    cleanup();
    data.saveCheckin.mockClear(); onClose.mockClear();

    show({ ...OLD, note: 'Before.' });
    type('After.');
    await back();
    expect(data.saveCheckin).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('leaves an old visit as it was on a tap outside, whatever was typed', async () => {
    show({ ...OLD, note: 'Before.' });
    type('After.');
    await press('checkin-sheet-close');
    expect(data.saveCheckin).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('saves a changed note on an old visit, takes one away when the field is emptied, and writes nothing unchanged', async () => {
    show({ ...OLD, note: 'Before.' });
    type('After.');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k1', { note: 'After.' });
    cleanup();

    show({ ...OLD, note: 'Before.' });
    type('');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k1', { note: null });
    cleanup();
    data.saveCheckin.mockClear(); onClose.mockClear();

    show({ ...OLD, note: 'Before.' });
    await press('checkin-sheet-save');
    expect(data.saveCheckin).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('keeps the sheet and the words when the save fails, says so, and can be tried again', async () => {
    data.saveCheckin.mockRejectedValueOnce(new Error('connection lost'));
    show(FRESH);
    type('Crisp sourdough.');
    await press('checkin-sheet-save');
    expect(alert).toHaveBeenCalledWith('Could not save your note', 'connection lost');
    expect(onClose).not.toHaveBeenCalled();
    expect(field().value).toBe('Crisp sourdough.');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledWith(true, false);
  });

  it('does not send twice while one save is on its way', async () => {
    let done = () => {};
    data.saveCheckin.mockImplementationOnce(() => new Promise<void>((r) => { done = r; }));
    show(FRESH);
    type('Once.');
    await press('checkin-sheet-save');
    await press('checkin-sheet-close');
    expect(data.saveCheckin).toHaveBeenCalledTimes(1);
    await act(async () => { done(); await Promise.resolve(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('counts only the last forty characters, and holds the field to the bound', () => {
    show(FRESH);
    type('a'.repeat(NOTE_MAX - 41));
    expect(screen.queryByTestId('checkin-sheet-count')).toBeNull();
    type('a'.repeat(NOTE_MAX - 40));
    expect(screen.getByTestId('checkin-sheet-count').textContent).toBe(`${NOTE_MAX - 40}/${NOTE_MAX}`);
    expect(propsWhere((p) => p.testID === 'checkin-sheet-note').maxLength).toBe(NOTE_MAX);
  });

  it('does not carry the words typed over one visit to the next', () => {
    const { rerender } = show(FRESH);
    type('About the first.');
    rerender(<CheckinSheet visit={{ ...FRESH, id: 'k10' }} onClose={onClose} />);
    expect(field().value).toBe('');
  });

  // ── who sees it: drawn only when asked for ──

  it('asks nothing about who sees the visit unless told to', () => {
    show(FRESH);
    expect(screen.queryByTestId('checkin-sheet-seen')).toBeNull();
    expect(screen.queryByTestId('checkin-sheet-gloss')).toBeNull();
  });

  it('opens on the answer it was given, and says what each answer means', () => {
    show(FRESH, true);
    expect(screen.getByTestId('checkin-sheet-seen-friends').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('checkin-sheet-gloss').textContent).toBe('Your friends see the place, the day and your note.');
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-private'));
    expect(screen.getByTestId('checkin-sheet-seen-private').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('checkin-sheet-seen-friends').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('checkin-sheet-gloss').textContent).toBe('Nobody else sees this visit.');
  });

  it('writes the answer with a fresh visit even unchanged and wordless: closing the sheet is the answer', async () => {
    show(FRESH, true);
    await press('checkin-sheet-close');
    expect(data.saveCheckin).toHaveBeenCalledWith('k9', { note: null, audience: 'friends' });
    expect(onClose).toHaveBeenCalledWith(true, true);
  });

  it('says whether what it wrote leaves the visit shared: Friends yes, Only me no, and words alone no', async () => {
    show(FRESH, true);
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-private'));
    await press('checkin-sheet-save');
    expect(onClose).toHaveBeenLastCalledWith(true, false);
    cleanup();

    show({ ...OLD, note: 'Before.' }, true);
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-friends'));
    await press('checkin-sheet-save');
    expect(onClose).toHaveBeenLastCalledWith(true, true);
    cleanup();

    // The words changed on a visit already shared: nothing about who
    // sees it was written, so nothing is claimed.
    show({ ...OLD, note: 'Before.', audience: 'friends' }, true);
    type('After.');
    await press('checkin-sheet-save');
    expect(onClose).toHaveBeenLastCalledWith(true, false);
  });

  it('offers Public only behind its flag, says what it means, writes it and calls it shared', async () => {
    show(FRESH, true);
    expect(screen.queryByTestId('checkin-sheet-seen-public')).toBeNull();
    cleanup();

    appFlags.set('checkin_public', true);
    show(FRESH, true);
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-public'));
    expect(screen.getByTestId('checkin-sheet-seen-public').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('checkin-sheet-gloss').textContent)
      .toBe('Anyone signed in sees the place, the day and your note on your page.');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k9', { note: null, audience: 'public' });
    expect(onClose).toHaveBeenLastCalledWith(true, true);
  });

  it('says under Public, where photos can be added, that it can lead to Highlights', () => {
    appFlags.set('checkin_public', true);
    appFlags.set('checkin_photos', true);
    show(FRESH, true);
    expect(screen.queryByTestId('checkin-sheet-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-public'));
    expect(screen.getByTestId('checkin-sheet-hint').textContent)
      .toBe('A public check-in with a photo can appear in Featured check-ins on Explore.');
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-friends'));
    expect(screen.queryByTestId('checkin-sheet-hint')).toBeNull();
    cleanup();
    appFlags.set('checkin_photos', false);
    show(FRESH, true);
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-public'));
    expect(screen.queryByTestId('checkin-sheet-hint')).toBeNull();
  });

  // A tile opens its photo full screen, over the sheet and inside its
  // Modal (owner, 26 Nov 2026).
  it('opens a stored photo full screen from its tile, at that photo, and closes back to the sheet', () => {
    appFlags.set('checkin_photos', true);
    const ph = (id: string) => ({ key: id, uri: `https://s/${id}.jpg`, state: 'done', photo: { id, path: `u/k1/${id}.jpg`, width: 10, height: 10 } });
    pics.tiles = [ph('p1'), ph('p2'), { key: 'up', uri: 'file://up.jpg', state: 'sending' }];
    show(OLD, true);
    expect(screen.queryByTestId('checkin-sheet-viewer')).toBeNull();
    fireEvent.click(screen.getAllByTestId('visit-photo')[1]);
    const viewer = screen.getByTestId('checkin-sheet-viewer');
    expect(within(viewer).getByTestId('photo-viewer-count').textContent).toBe('2/2');
    // Swiped back to the first, the count follows.
    const pager = within(viewer).getByTestId('photo-viewer-pager');
    Object.defineProperty(pager, 'scrollLeft', { value: 0, configurable: true });
    fireEvent.scroll(pager);
    expect(within(viewer).getByTestId('photo-viewer-count').textContent).toBe('1/2');
    fireEvent.click(within(viewer).getByTestId('photo-viewer-close'));
    expect(screen.queryByTestId('checkin-sheet-viewer')).toBeNull();
    expect(screen.getByTestId('checkin-sheet')).toBeTruthy();
  });

  it('keeps Public on a visit already answered so, with the flag off', async () => {
    show({ ...OLD, note: 'Before.', audience: 'public' }, true);
    expect(screen.getByTestId('checkin-sheet-seen-public').getAttribute('aria-checked')).toBe('true');
    type('After.');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k1', { note: 'After.' });
  });

  it('writes a changed answer on an old visit, and no answer when only the words changed', async () => {
    show({ ...OLD, note: 'Before.' }, true);
    fireEvent.click(screen.getByTestId('checkin-sheet-seen-friends'));
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k1', { note: 'Before.', audience: 'friends' });
    cleanup();

    show({ ...OLD, note: 'Before.' }, true);
    type('After.');
    await press('checkin-sheet-save');
    expect(data.saveCheckin).toHaveBeenLastCalledWith('k1', { note: 'After.' });
  });

  // ── what moves ──

  it('rises on the sheets’ spring, and lands at once for a reader who asked for less motion', () => {
    const spring = vi.spyOn(Animated, 'spring');
    show(FRESH);
    expect(spring).toHaveBeenCalledTimes(1);
    expect(spring.mock.calls[0][1]).toMatchObject({ toValue: 0, useNativeDriver: true });
    cleanup();
    spring.mockClear();

    motion.still = true;
    const set = vi.spyOn(Animated.Value.prototype, 'setValue');
    show(FRESH);
    expect(spring).not.toHaveBeenCalled();
    // At rest: the sheet where it stands, not under the screen's foot.
    expect(set).toHaveBeenCalledWith(0);
    spring.mockRestore(); set.mockRestore();
  });

  it('keeps the home indicator’s margin under its button', () => {
    show(FRESH);
    expect(viewStyleOf(screen.getByTestId('checkin-sheet')).paddingBottom).toBe(34 + 16);
  });

  // ── photos ──

  describe('photos', () => {
    const on = () => appFlags.set('checkin_photos', true);
    const tap = (id: string) => act(async () => { fireEvent.click(screen.getByTestId(id)); for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
    const rise = () => {
      const t = propsWhere((p) => p.testID === 'checkin-sheet').style as unknown as unknown[];
      const flat = (t.flat(3) as { transform?: { translateY: { __getValue: () => number } }[] }[]).find((x) => x?.transform);
      return flat!.transform![0].translateY.__getValue();
    };

    // Held where it starts, so the interpolation reads the rise's height.
    const hold = () => vi.spyOn(Animated, 'spring').mockReturnValue({ start: () => {} } as never);

    it('draws no photo row with the switch off, and asks for none', () => {
      const spring = hold();
      show(OLD);
      expect(screen.queryByTestId('visit-photos')).toBeNull();
      expect(pics.args).toEqual(['k1', false, true, undefined]);
      expect(rise()).toBe(360);
      spring.mockRestore();
    });

    it('draws the row under the note with the switch on, asking an old visit for its photos', () => {
      on();
      const spring = hold();
      show(OLD);
      expect(screen.getByTestId('visit-photos')).toBeTruthy();
      expect(pics.args).toEqual(['k1', true, true, undefined]);
      // Rises from its own, taller height: the tile and a gap more.
      expect(rise()).toBe(360 + 72 + 14);
      cleanup();
      // A fresh visit has none to ask for.
      show(FRESH);
      expect(pics.args).toEqual(['k9', true, false, undefined]);
      spring.mockRestore();
    });

    it('reports an old visit changed when a photo went up, whichever way it is closed', async () => {
      on();
      pics.changed = true;
      show(OLD);
      await tap('checkin-sheet-close');
      expect(onClose).toHaveBeenLastCalledWith(true);
      cleanup(); onClose.mockClear();
      show(OLD);
      await tap('checkin-sheet-save');
      expect(onClose).toHaveBeenLastCalledWith(true);
      expect(data.saveCheckin).not.toHaveBeenCalled();
    });

    // Owner, 25 Nov 2026: Done no longer waits for a photo going up — it
    // went on spinning for 3.5–4 s. The upload is the app's
    // (`lib/visitUploads`) and carries on after the sheet.
    it('closes at once, an old visit or a fresh one, while a photo is still going up', async () => {
      on();
      const { sendVisitPhoto, uploadsGoing, resetVisitUploads } = await import('../lib/visitUploads');
      let land!: () => void;
      upload.mockReturnValueOnce(new Promise((r) => { land = () => r({ id: 'p', path: 'p', width: 1, height: 1 }); }));
      sendVisitPhoto({ key: 'x', visitId: 'k1', uri: 'file://x', image: 'AAAA' });
      show(OLD);
      await tap('checkin-sheet-close');
      expect(onClose).toHaveBeenCalledWith(false);
      expect(uploadsGoing()).toBe(1);
      cleanup(); onClose.mockClear();

      show(FRESH);
      type('Quiet upstairs.');
      await tap('checkin-sheet-save');
      expect(data.saveCheckin).toHaveBeenCalledWith('k9', { note: 'Quiet upstairs.' });
      expect(onClose).toHaveBeenCalledWith(true, false);
      expect(uploadsGoing()).toBe(1);
      land();
      resetVisitUploads();
    });
  });
});
