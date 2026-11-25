// @vitest-environment jsdom
//
// A person's visits as cards: when they are asked for and for whom; what
// a friend's card says and what your own says; the heart, moved on the
// press and put back on a refusal; and the note of your own, edited from
// its card.

import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, propsWhere, render, screen, waitFor, within } from '../../uitest/render';
import type { PersonCheckin } from '../../lib/checkin';
import type { FriendProfile } from '../../lib/data';

const data = vi.hoisted(() => ({
  fetchPersonCheckins: vi.fn(async (_id: string): Promise<unknown[]> => []),
  likeCheckin: vi.fn(async (_id: string, _on: boolean) => {}),
  saveCheckin: vi.fn(async (_id: string, _said: unknown) => {}),
  submitReport: vi.fn(async (_r: unknown) => {}),
  signCheckinPhotos: vi.fn(async (paths: readonly string[]): Promise<Record<string, string>> =>
    Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`]))),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPersonCheckins: data.fetchPersonCheckins,
  likeCheckin: data.likeCheckin,
  saveCheckin: data.saveCheckin,
  signCheckinPhotos: data.signCheckinPhotos,
  submitReport: data.submitReport,
}));
const auth = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../../lib/auth', () => ({ useSession: () => ({ session: auth.me ? { user: { id: auth.me } } : null }) }));
const mine = vi.hoisted(() => ({ loadedAt: 1 as number | null, reload: vi.fn() }));
vi.mock('../../lib/checkins', () => ({ useMyCheckins: () => ({ data: [], loadedAt: mine.loadedAt, reload: mine.reload }) }));
vi.mock('../../lib/city', () => ({
  useCityList: () => ({ cities: [{ id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: null }] }),
}));
const flags = vi.hoisted(() => ({ place_checkin: true, checkin_photos: false, ready: true }));
vi.mock('../../lib/useFlag', () => ({
  useFlag: (k: string) => (flags as Record<string, boolean>)[k] ?? false,
  useFlagsReady: () => flags.ready,
}));
const i18n = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: i18n.lang, t: (en: string, vi?: string) => (i18n.lang === 'vi' ? vi : en) ?? en }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { cacheKey } from '../../lib/data/cache';
import { HOLD_MS, useVisitCards } from './CheckinAct';
import { forgetSignedPhotos } from '../../components/useSignedPhotos';

const LAN: FriendProfile = { id: 'lan', handle: 'lan', full_name: 'Lan Pham', avatar_url: '' } as FriendProfile;
const ME: FriendProfile = { id: 'me', handle: 'andy', full_name: '', avatar_url: '' } as FriendProfile;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const visit = (id: string, over: Partial<PersonCheckin> = {}): PersonCheckin => ({
  id, place_slug: `slug-${id}`,
  place: { name_en: `Place ${id}`, name_vi: `Quán ${id}`, cover: `https://x/${id}.jpg`, categories: ['cafes'] },
  city_id: 'hanoi', day: today(), note: null, audience: null, likes: 0, liked: false, ...over,
});

const onPlace = vi.fn();
function Page({ me, person, searching = false }: { me: string | null; person: FriendProfile | null; searching?: boolean }) {
  const seen = useVisitCards({ me, person, onPlace });
  return (
    <>
      {seen.holding(searching) ? <Text testID="holding">wait</Text> : null}
      {seen.visits(searching).map(seen.card)}{seen.sheet}
    </>
  );
}
const show = async (me: string | null, person: FriendProfile | null, rows: PersonCheckin[] = [], searching = false) => {
  data.fetchPersonCheckins.mockResolvedValue(rows);
  const r = render(<Page me={me} person={person} searching={searching} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return r;
};
const cards = () => screen.queryAllByTestId('person-visit');

beforeEach(() => {
  vi.clearAllMocks();
  data.likeCheckin.mockImplementation(async () => {});
  data.saveCheckin.mockImplementation(async () => {});
  flags.place_checkin = true;
  flags.checkin_photos = false;
  flags.ready = true;
  auth.me = 'me';
  forgetSignedPhotos();
  mine.loadedAt = 1;
  i18n.lang = 'en';
});
afterEach(async () => {
  cleanup();
  // What a page kept of its visits must not be the next test's first frame.
  for (const who of ['me', 'someone-else']) {
    for (const page of ['lan', 'me', 'minh']) await AsyncStorage.removeItem(cacheKey('personvisits', page, who));
  }
});

describe('when the visits are asked for', () => {
  it('asks for the person whose page it is, as somebody signed in', async () => {
    await show('me', LAN, [visit('k1')]);
    expect(data.fetchPersonCheckins).toHaveBeenCalledWith('lan');
    expect(cards()).toHaveLength(1);
  });

  it('asks nothing for a guest, before the person is known, or with check-ins switched off', async () => {
    await show(null, LAN, [visit('k1')]);
    cleanup();
    await show('me', null, [visit('k1')]);
    cleanup();
    flags.place_checkin = false;
    await show('me', LAN, [visit('k1')]);
    expect(data.fetchPersonCheckins).not.toHaveBeenCalled();
    expect(cards()).toHaveLength(0);
  });

  it('draws none while the page is searched, having read them all the same', async () => {
    await show('me', LAN, [visit('k1')], true);
    expect(data.fetchPersonCheckins).toHaveBeenCalledTimes(1);
    expect(cards()).toHaveLength(0);
  });

  it('asks again on your own page when your visits were asked again, and not on somebody else’s', async () => {
    const own = await show('me', ME, [visit('k1', { audience: 'private' })]);
    expect(data.fetchPersonCheckins).toHaveBeenCalledTimes(1);
    mine.loadedAt = 2;
    own.rerender(<Page me="me" person={ME} />);
    await waitFor(() => expect(data.fetchPersonCheckins).toHaveBeenCalledTimes(2));
    cleanup();
    data.fetchPersonCheckins.mockClear();

    const theirs = await show('me', LAN, [visit('k1')]);
    mine.loadedAt = 3;
    theirs.rerender(<Page me="me" person={LAN} />);
    await act(async () => { await Promise.resolve(); });
    expect(data.fetchPersonCheckins).toHaveBeenCalledTimes(1);
  });
});

describe('the column waiting for the visits', () => {
  // A read that answers when the test says.
  const pending = () => {
    let answer: (rows: PersonCheckin[]) => void = () => {};
    let fail: (e: Error) => void = () => {};
    data.fetchPersonCheckins.mockImplementation(() => new Promise<unknown[]>((ok, no) => { answer = ok; fail = no; }));
    return { answer: (rows: PersonCheckin[]) => act(async () => { answer(rows); await Promise.resolve(); }), fail: () => act(async () => { fail(new Error('down')); await Promise.resolve(); }) };
  };
  const mount = async (me: string | null, person: FriendProfile | null, searching = false) => {
    const r = render(<Page me={me} person={person} searching={searching} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    return r;
  };
  const holding = () => screen.queryByTestId('holding') !== null;

  it('waits until they answer, then does not', async () => {
    const read = pending();
    await mount('me', LAN);
    expect(holding()).toBe(true);
    await read.answer([visit('k1')]);
    expect(holding()).toBe(false);
    expect(cards()).toHaveLength(1);
  });

  it('stops waiting when the read fails: the lists are still worth drawing', async () => {
    const read = pending();
    await mount('me', LAN);
    await read.fail();
    expect(holding()).toBe(false);
  });

  it('gives up waiting after the hold, and not a moment before', async () => {
    vi.useFakeTimers();
    try {
      pending();
      render(<Page me="me" person={LAN} />);
      expect(HOLD_MS).toBe(1200);
      act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
      expect(holding()).toBe(true);
      act(() => { vi.advanceTimersByTime(1); });
      expect(holding()).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('waits afresh for the next person’s page', async () => {
    vi.useFakeTimers();
    try {
      pending();
      const r = render(<Page me="me" person={LAN} />);
      act(() => { vi.advanceTimersByTime(HOLD_MS); });
      expect(holding()).toBe(false);
      r.rerender(<Page me="me" person={{ ...LAN, id: 'minh', handle: 'minh' } as FriendProfile} />);
      expect(holding()).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  // Owner, 25 Nov 2026: as the app opens the switches are not known yet,
  // and check-ins may be off only because nothing has said otherwise.
  it('waits while it does not know whether to ask, and stops once it knows', async () => {
    flags.ready = false;
    flags.place_checkin = false;
    pending();
    const r = await mount('me', LAN);
    expect(holding()).toBe(true);
    expect(data.fetchPersonCheckins).not.toHaveBeenCalled();
    // Known, and off: nothing to wait for.
    flags.ready = true;
    r.rerender(<Page me="me" person={LAN} />);
    expect(holding()).toBe(false);
  });

  it('waits on from not knowing to asking, within the one hold', async () => {
    vi.useFakeTimers();
    try {
      flags.ready = false;
      flags.place_checkin = false;
      pending();
      const r = render(<Page me="me" person={LAN} />);
      act(() => { vi.advanceTimersByTime(HOLD_MS - 200); });
      flags.ready = true;
      flags.place_checkin = true;
      r.rerender(<Page me="me" person={LAN} />);
      expect(holding()).toBe(true);
      act(() => { vi.advanceTimersByTime(200); });
      expect(holding()).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('does not wait on unknown switches for a guest, who is asked nothing either way', async () => {
    flags.ready = false;
    pending();
    await mount(null, LAN);
    expect(holding()).toBe(false);
  });

  it('never waits where nothing is asked — a guest, check-ins off — nor while the page is searched', async () => {
    pending();
    await mount(null, LAN);
    expect(holding()).toBe(false);
    cleanup();
    flags.place_checkin = false;
    await mount('me', LAN);
    expect(holding()).toBe(false);
    cleanup();
    flags.place_checkin = true;
    await mount('me', LAN, true);
    expect(holding()).toBe(false);
  });

  // Not even for the frame it takes "nothing to ask" to come back: a
  // guest's page must not open on a spinner.
  it('does not wait on the first frame either, where nothing is asked', () => {
    render(<Page me={null} person={LAN} />);
    expect(holding()).toBe(false);
  });

  it('does not wait again when your own visits are asked again: the cards stay while the new answer comes', async () => {
    const own = await show('me', ME, [visit('k1', { audience: 'private' })]);
    expect(holding()).toBe(false);
    pending();
    mine.loadedAt = 2;
    own.rerender(<Page me="me" person={ME} />);
    await act(async () => { await Promise.resolve(); });
    expect(holding()).toBe(false);
    expect(cards()).toHaveLength(1);
  });

  it('draws a page opened before from what it kept, before the network answers', async () => {
    await show('me', LAN, [visit('k1', { note: 'Kept.' })]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    cleanup();
    const read = pending();
    await mount('me', LAN);
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(holding()).toBe(false);
    expect(screen.getByTestId('activity-desc').textContent).toBe('Kept.');
    // And the fresh answer replaces it.
    await read.answer([]);
    expect(cards()).toHaveLength(0);
  });

  it('keeps one reader’s copy of a page from another reader', async () => {
    await show('me', LAN, [visit('k1')]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    cleanup();
    pending();
    await mount('someone-else', LAN);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(cards()).toHaveLength(0);
    expect(holding()).toBe(true);
  });
});

describe('a friend’s visit', () => {
  it('says who checked in and on what day, the place, its kind and city, and their note', async () => {
    await show('me', LAN, [visit('k1', { note: 'Crisp sourdough.', likes: 3 })]);
    const card = cards()[0];
    expect(within(card).getByTestId('activity-line').textContent).toBe('Lan Pham checked in');
    expect(within(card).getByTestId('activity-when').textContent).toBe('today');
    expect(within(card).getByTestId('activity-open').getAttribute('aria-label')).toBe('Place k1, Cafés · Hanoi');
    expect(within(card).getByTestId('activity-desc').textContent).toBe('Crisp sourdough.');
    expect(within(card).getByTestId('activity-mark').getAttribute('aria-label')).toBe('Friends');
    expect(within(card).getByTestId('activity-likes').textContent).toBe('3');
  });

  it('is not theirs to edit: no pencil where there is no note, and no press on one there is', async () => {
    await show('me', LAN, [visit('k1'), visit('k2', { note: 'Theirs.' })]);
    expect(screen.queryByTestId('visit-note-add')).toBeNull();
    expect(screen.queryByTestId('visit-note')).toBeNull();
    expect(screen.queryByTestId('activity-desc')?.textContent).toBe('Theirs.');
  });

  it('names the place in the reader’s language, by the handle when they gave no name, and says less when less is known', async () => {
    i18n.lang = 'vi';
    await show('me', { ...LAN, full_name: '' } as FriendProfile, [visit('k1', {
      city_id: null, place: { name_en: 'Place k1', name_vi: 'Quán k1', cover: null, categories: [] },
    })]);
    const card = cards()[0];
    expect(within(card).getByTestId('activity-line').textContent).toBe('@lan đã check-in');
    expect(within(card).getByTestId('activity-open').getAttribute('aria-label')).toBe('Quán k1, ');
    expect(within(card).getByTestId('activity-tint')).toBeTruthy();
  });

  it('opens the place', async () => {
    await show('me', LAN, [visit('k1')]);
    fireEvent.click(screen.getByTestId('activity-open'));
    expect(onPlace).toHaveBeenCalledWith('slug-k1');
  });
});

describe('the heart', () => {
  const heart = () => screen.getByTestId('activity-heart');

  it('is set on the press, counted, and written behind it', async () => {
    await show('me', LAN, [visit('k1', { likes: 2 })]);
    await act(async () => { fireEvent.click(heart()); });
    expect(data.likeCheckin).toHaveBeenCalledWith('k1', true);
    expect(screen.getByTestId('activity-likes').textContent).toBe('3');
  });

  it('is taken back by a second press, to the count the server gave', async () => {
    await show('me', LAN, [visit('k1', { likes: 2 })]);
    await act(async () => { fireEvent.click(heart()); });
    await act(async () => { fireEvent.click(heart()); });
    expect(data.likeCheckin).toHaveBeenLastCalledWith('k1', false);
    expect(screen.getByTestId('activity-likes').textContent).toBe('2');
  });

  it('takes one off a visit the reader had already hearted', async () => {
    await show('me', LAN, [visit('k1', { likes: 2, liked: true })]);
    await act(async () => { fireEvent.click(heart()); });
    expect(data.likeCheckin).toHaveBeenCalledWith('k1', false);
    expect(screen.getByTestId('activity-likes').textContent).toBe('1');
  });

  it('is put back when the server refuses, on that visit alone', async () => {
    data.likeCheckin.mockRejectedValueOnce(new Error('checkin:unseen'));
    await show('me', LAN, [visit('k1', { likes: 2 }), visit('k2', { likes: 5 })]);
    await act(async () => { fireEvent.click(screen.getAllByTestId('activity-heart')[0]); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getAllByTestId('activity-likes').map((el) => el.textContent)).toEqual(['2', '5']);
  });
});

describe('your own visits', () => {
  it('marks a private one with the padlock and gives it no heart', async () => {
    await show('me', ME, [visit('k1', { audience: 'private' }), visit('k0', { audience: null })]);
    for (const card of cards()) {
      expect(within(card).getByTestId('activity-mark').getAttribute('aria-label')).toBe('Only me');
      expect(within(card).queryByTestId('activity-heart')).toBeNull();
    }
  });

  it('marks a shared one as a friend sees it, with its heart', async () => {
    await show('me', ME, [visit('k1', { audience: 'friends', likes: 1 })]);
    expect(screen.getByTestId('activity-mark').getAttribute('aria-label')).toBe('Friends');
    expect(screen.getByTestId('activity-heart')).toBeTruthy();
  });

  it('asks for a note where there is none, and reads one back as a control — never as the plain line', async () => {
    await show('me', ME, [visit('k1', { audience: 'private' }), visit('k2', { audience: 'friends', note: 'Mine.' })]);
    const [bare, noted] = cards();
    expect(within(bare).getByTestId('visit-note-add')).toBeTruthy();
    expect(within(noted).getByTestId('visit-note').textContent).toBe('Mine.');
    expect(screen.queryByTestId('activity-desc')).toBeNull();
  });

  it('opens the sheet over that visit from its note, not the place, with its words, its day and its answer', async () => {
    await show('me', ME, [visit('k1', { audience: 'friends', note: 'Mine.', day: '2026-10-08' })]);
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('visit-note'));
    const sheet = await screen.findByTestId('checkin-sheet');
    expect(onPlace).not.toHaveBeenCalled();
    expect(within(sheet).getByTestId('checkin-sheet-name').textContent).toBe('Place k1');
    // The 8th on any clock: the day is read at local noon.
    expect(within(sheet).getByTestId('checkin-sheet-when').textContent).toBe('8 Oct');
    expect((within(sheet).getByTestId('checkin-sheet-note') as HTMLTextAreaElement).value).toBe('Mine.');
    expect(within(sheet).getByTestId('checkin-sheet-seen-friends').getAttribute('aria-checked')).toBe('true');
  });

  it('opens a visit never answered as private', async () => {
    await show('me', ME, [visit('k1', { audience: null })]);
    fireEvent.click(screen.getByTestId('visit-note-add'));
    const sheet = await screen.findByTestId('checkin-sheet');
    expect(within(sheet).getByTestId('checkin-sheet-seen-private').getAttribute('aria-checked')).toBe('true');
  });

  it('saves the note to that visit and asks your visits again; and asks nothing when the sheet is only closed', async () => {
    await show('me', ME, [visit('k1', { audience: 'private' })]);
    fireEvent.click(screen.getByTestId('visit-note-add'));
    await screen.findByTestId('checkin-sheet');
    fireEvent.change(screen.getByTestId('checkin-sheet-note'), { target: { value: 'Egg coffee.' } });
    fireEvent.click(screen.getByTestId('checkin-sheet-save'));
    await waitFor(() => expect(data.saveCheckin).toHaveBeenCalledWith('k1', { note: 'Egg coffee.' }));
    await waitFor(() => expect(mine.reload).toHaveBeenCalledTimes(1));
    cleanup();
    mine.reload.mockClear();

    await show('me', ME, [visit('k1', { audience: 'private' })]);
    fireEvent.click(screen.getByTestId('visit-note-add'));
    await screen.findByTestId('checkin-sheet');
    fireEvent.click(screen.getByTestId('checkin-sheet-close'));
    await act(async () => { await Promise.resolve(); });
    expect(mine.reload).not.toHaveBeenCalled();
  });
});

describe('a visit’s own photos', () => {
  const ph = (id: string) => ({ id, path: `lan/k1/${id}.jpg`, width: 1200, height: 900 });
  const WITH = visit('k1', { photos: [ph('p1'), ph('p2'), ph('p3')] });
  const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

  it('draws the place’s cover, and asks for no link, with the switch off', async () => {
    await show('me', LAN, [WITH]);
    expect(data.signCheckinPhotos).not.toHaveBeenCalled();
    expect(screen.queryByTestId('activity-photo')).toBeNull();
    expect(document.querySelector('img[src="https://x/k1.jpg"]')).not.toBeNull();
  });

  it('asks once for the whole column, and wears the first photo with the count', async () => {
    flags.checkin_photos = true;
    await show('me', LAN, [WITH, visit('k2', { photos: [ph('q1')] }), visit('k3')]);
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenCalledTimes(1);
    expect(data.signCheckinPhotos).toHaveBeenCalledWith(['lan/k1/p1.jpg', 'lan/k1/p2.jpg', 'lan/k1/p3.jpg', 'lan/k1/q1.jpg']);
    const [first, second, third] = cards();
    expect(within(first).getByTestId('activity-photo').getAttribute('aria-label')).toBe('3 photos');
    expect(within(first).getByTestId('activity-photo-count').textContent).toBe('3');
    expect(first.querySelector('img[src="https://signed/lan/k1/p1.jpg"]')).not.toBeNull();
    // In the cover's place, not as well as it.
    expect(first.querySelector('img[src="https://x/k1.jpg"]')).toBeNull();
    // One photo: no count, said as one.
    expect(within(second).getByTestId('activity-photo').getAttribute('aria-label')).toBe('Photo');
    expect(within(second).queryByTestId('activity-photo-count')).toBeNull();
    // None: the place, as before.
    expect(within(third).queryByTestId('activity-photo')).toBeNull();
    expect(third.querySelector('img[src="https://x/k3.jpg"]')).not.toBeNull();
  });

  it('draws no picture of the place while its own are on their way', async () => {
    flags.checkin_photos = true;
    data.signCheckinPhotos.mockReturnValueOnce(new Promise(() => {}));
    await show('me', LAN, [WITH]);
    const [first] = cards();
    expect(within(first).queryByTestId('activity-photo')).toBeNull();
    expect(first.querySelector('img[src="https://x/k1.jpg"]')).toBeNull();
    expect(within(first).getByTestId('activity-tint')).toBeTruthy();
  });

  it('counts only the photos the bucket signed, and draws none of the place until one is', async () => {
    flags.checkin_photos = true;
    data.signCheckinPhotos.mockResolvedValueOnce({ 'lan/k1/p2.jpg': 'https://signed/p2' });
    await show('me', LAN, [WITH, visit('k2', { photos: [ph('q1')] })]);
    await settle();
    const [first, second] = cards();
    expect(first.querySelector('img[src="https://signed/p2"]')).not.toBeNull();
    expect(within(first).queryByTestId('activity-photo-count')).toBeNull();
    expect(within(second).queryByTestId('activity-photo')).toBeNull();
  });

  it('opens them full screen from the picture, pages through them, and closes; the words still open the place', async () => {
    flags.checkin_photos = true;
    await show('me', LAN, [WITH]);
    await settle();
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-photo'));
    expect(onPlace).not.toHaveBeenCalled();
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('1/3');
    expect(screen.getByTestId('photo-viewer-page-p3')).toBeTruthy();
    expect(document.querySelectorAll('img[src="https://signed/lan/k1/p2.jpg"]')).toHaveLength(1);
    // Cached by the photo, not by a link that changes every hour.
    const sourceOf = (uri: string) => propsWhere((p) => (p.source as { uri?: string } | undefined)?.uri === uri).source;
    expect(sourceOf('https://signed/lan/k1/p1.jpg')).toEqual({ uri: 'https://signed/lan/k1/p1.jpg', cacheKey: 'p1' });
    expect(sourceOf('https://signed/lan/k1/p2.jpg')).toEqual({ uri: 'https://signed/lan/k1/p2.jpg', cacheKey: 'p2' });
    // A swipe that settles on the third page (the pager's own reading of
    // a swipe is `PhotoViewer.ui.test.tsx`'s).
    act(() => { (propsWhere((p) => 'onIndex' in p).onIndex as (i: number) => void)(2); });
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('3/3');
    fireEvent.click(screen.getByTestId('photo-viewer-close'));
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-open'));
    expect(onPlace).toHaveBeenCalledWith('slug-k1');
  });

  it('closes on the back gesture', async () => {
    flags.checkin_photos = true;
    await show('me', LAN, [WITH]);
    await settle();
    fireEvent.click(screen.getByTestId('activity-photo'));
    act(() => { (propsWhere((p) => p.visible === true && 'onRequestClose' in p).onRequestClose as () => void)(); });
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  it('does not ask again for links it already holds', async () => {
    flags.checkin_photos = true;
    const { unmount } = await show('me', LAN, [WITH]);
    await settle();
    unmount();
    await show('me', LAN, [WITH]);
    await settle();
    expect(data.signCheckinPhotos).toHaveBeenCalledTimes(1);
  });
});

// K5: a friend's photo carries a flag to the desk; your own does not.
describe('reporting a photo', () => {
  const ph = (id: string) => ({ id, path: `lan/k1/${id}.jpg`, width: 1200, height: 900 });
  const WITH = visit('k1', { photos: [ph('p1'), ph('p2')] });
  const open = async (me: string, person: FriendProfile) => {
    flags.checkin_photos = true;
    await show(me, person, [WITH]);
    await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
    fireEvent.click(screen.getByTestId('activity-photo'));
  };

  it('closes the viewer, then asks why, then files the photo shown', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      await open('me', LAN);
      act(() => { (propsWhere((p) => 'onIndex' in p).onIndex as (i: number) => void)(1); });
      expect(screen.getByTestId('photo-viewer-report').getAttribute('aria-label')).toBe('Report photo');
      fireEvent.click(screen.getByTestId('photo-viewer-report'));
      expect(screen.queryByTestId('photo-viewer')).toBeNull();
      // Not yet: the viewer is still going.
      expect(screen.queryByTestId('sheet-action-offensive')).toBeNull();
      act(() => { vi.advanceTimersByTime(220); });
      expect(screen.getByTestId('sheet-action-offensive')).toBeTruthy();
      fireEvent.click(screen.getByTestId('sheet-action-offensive'));
      act(() => { vi.advanceTimersByTime(220); });
    } finally {
      vi.useRealTimers();
    }
    await act(async () => { await Promise.resolve(); });
    expect(data.submitReport).toHaveBeenCalledWith({ reporter: 'me', kind: 'checkin_photo', targetId: 'p2', reason: 'offensive' });
  });

  it('carries no flag on your own photos', async () => {
    await open('me', ME);
    expect(screen.getByTestId('photo-viewer')).toBeTruthy();
    expect(screen.queryByTestId('photo-viewer-report')).toBeNull();
  });
});
