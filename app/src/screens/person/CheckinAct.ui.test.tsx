// @vitest-environment jsdom
//
// A person's visits as cards: when they are asked for and for whom; what
// a friend's card says and what your own says; the heart, moved on the
// press and put back on a refusal; and the note of your own, edited from
// its card.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../../uitest/render';
import type { PersonCheckin } from '../../lib/checkin';
import type { FriendProfile } from '../../lib/data';

const data = vi.hoisted(() => ({
  fetchPersonCheckins: vi.fn(async (_id: string): Promise<unknown[]> => []),
  likeCheckin: vi.fn(async (_id: string, _on: boolean) => {}),
  saveCheckin: vi.fn(async (_id: string, _said: unknown) => {}),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPersonCheckins: data.fetchPersonCheckins,
  likeCheckin: data.likeCheckin,
  saveCheckin: data.saveCheckin,
}));
const mine = vi.hoisted(() => ({ loadedAt: 1 as number | null, reload: vi.fn() }));
vi.mock('../../lib/checkins', () => ({ useMyCheckins: () => ({ data: [], loadedAt: mine.loadedAt, reload: mine.reload }) }));
vi.mock('../../lib/city', () => ({
  useCityList: () => ({ cities: [{ id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: null }] }),
}));
const flags = vi.hoisted(() => ({ place_checkin: true }));
vi.mock('../../lib/useFlag', () => ({ useFlag: (k: string) => (k === 'place_checkin' ? flags.place_checkin : false) }));
const i18n = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: i18n.lang, t: (en: string, vi?: string) => (i18n.lang === 'vi' ? vi : en) ?? en }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { useVisitCards } from './CheckinAct';

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
  return <>{seen.visits(searching).map(seen.card)}{seen.sheet}</>;
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
  mine.loadedAt = 1;
  i18n.lang = 'en';
});
afterEach(cleanup);

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
