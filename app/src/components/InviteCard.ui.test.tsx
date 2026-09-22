// @vitest-environment jsdom
//
// The invitation card, rendered.
//
// The thing worth holding here is that both answers are reachable and
// neither is hidden. A card that made declining harder to find would be
// the app leaning on somebody about their own evening — and it is the kind
// of drift a refactor makes without meaning to, because the accept path is
// the one anybody tests by hand.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
// The photographer's credit is behind the `photo_attribution` switch —
// see `lib/flags` — and a test that never turned it off could not tell a
// card that honours the switch from one that ignores it.
const flags = vi.hoisted(() => ({ credit: true }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => flags.credit }));

import InviteCard from './InviteCard';
import type { Trip } from '../lib/data';

const place = (over: Record<string, unknown> = {}) => ({
  slug: 'cafe', name_en: 'The Café Apartment', name_vi: 'The Café Apartment', name_ja: 'カフェ',
  neighborhood_en: 'D1', neighborhood_vi: 'Q1', neighborhood_ja: 'D1',
  lat: 10.77, lng: 106.7, price_vnd: 60000, categories: ['cafes'], place_photos: [],
  ...over,
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', owner_id: 'lan', city_id: 'hcmc', title: 'Cà phê rồi hẻm Sài Gòn',
  company: 'friends', categories: ['cafes'], district: null,
  day: '2026-08-28', when_part: 'evening', generated_by: 'rules',
  created_at: '2026-08-26T10:00:00Z',
  trip_stops: [
    { sort_order: 0, arrive_min: 17 * 60, dwell_min: 60, why: null, why_lang: null, places: place() as never },
    { sort_order: 1, arrive_min: 18 * 60 + 45, dwell_min: 75, why: null, why_lang: null,
      places: place({ slug: 'com', name_en: 'Cơm tấm Ba Ghiền', name_vi: 'Cơm tấm Ba Ghiền', name_ja: 'コムタム' }) as never },
  ],
  ...over,
});

const from = { id: 'lan', handle: 'lanphuong', full_name: 'Lan Phương', avatar_url: '' };
const onAnswer = vi.fn();
const onOpen = vi.fn();

const show = (props: Partial<React.ComponentProps<typeof InviteCard>> = {}) => render(
  <InviteCard trip={trip()} from={from} busy={false} onOpen={onOpen} onAnswer={onAnswer} {...props} />,
);

beforeEach(() => { onAnswer.mockClear(); onOpen.mockClear(); flags.credit = true; });

/** A stop that carries a photograph, credited or not. */
const pictured = (attribution_name: string | null = 'Bởi Minh') => ({
  sort_order: 0, arrive_min: 17 * 60, dwell_min: 60, why: null, why_lang: null,
  places: place({ place_photos: [
    { photo_uri: 'https://pic/cafe.jpg', is_cover: true, is_hidden: false, sort_order: 0, attribution_name },
  ] }) as never,
});

describe('what the card says', () => {
  it('names who asked, as a person rather than as the app', () => {
    show();
    expect(screen.getByText(/Lan Phương/)).toBeTruthy();
    expect(screen.getByText('invited you')).toBeTruthy();
  });

  it('carries the trip’s own title and its stops', () => {
    show();
    expect(screen.getByText('Cà phê rồi hẻm Sài Gòn')).toBeTruthy();
    expect(screen.getByText('The Café Apartment · Cơm tấm Ba Ghiền')).toBeTruthy();
  });

  it('draws without a name rather than waiting for the crew copy', () => {
    show({ from: null });
    expect(screen.getByText(/Someone/)).toBeTruthy();
    expect(screen.getByText('Cà phê rồi hẻm Sài Gòn')).toBeTruthy();
  });
});

describe('the cover', () => {
  it('wears the photograph a stop brings, credited', () => {
    show({
      trip: trip({
        trip_stops: [
          { sort_order: 0, arrive_min: 17 * 60, dwell_min: 60, why: null, why_lang: null,
            places: place({ place_photos: [
              { photo_uri: 'https://pic/cafe.jpg', is_cover: true, is_hidden: false,
                sort_order: 0, attribution_name: 'Bởi Minh' },
            ] }) as never },
        ],
      }),
    });
    // The credit only renders on a drawn cover, so it is the proof the
    // photograph made it through. Every fixture above carries no photos,
    // which is how the original slipped past this file: the card unwrapped
    // the stops before handing them to `tripCover`, and every invitation
    // drew the grey block regardless of what the places carried.
    expect(screen.getByText('Bởi Minh')).toBeTruthy();
  });
});

describe('both answers', () => {
  it('offers each of them, from the card', () => {
    show();
    fireEvent.click(screen.getByText('I’m in'));
    expect(onAnswer).toHaveBeenCalledWith('accepted');

    onAnswer.mockClear();
    fireEvent.click(screen.getByText('Can’t make it'));
    expect(onAnswer).toHaveBeenCalledWith('declined');
  });

  it('refuses a second press while one is in flight', () => {
    show({ busy: true });
    fireEvent.click(screen.getByText('I’m in'));
    fireEvent.click(screen.getByText('Can’t make it'));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('the way in', () => {
  it('leads to the whole plan without answering anything', () => {
    show();
    fireEvent.click(screen.getByText('See the whole plan'));
    expect(onOpen).toHaveBeenCalled();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

// ── the line under the title ──
//
// Day and first-stop time, joined by the same dot the sketch uses, and
// each half able to be missing without taking the other with it.

describe('when', () => {
  it('spells the day and the first stop’s time', () => {
    show();
    expect(screen.getByText('Friday, Aug 28 · from 17:00')).toBeTruthy();
  });

  it('keeps the day alone when the first stop has no time', () => {
    show({ trip: trip({ trip_stops: [{ ...trip().trip_stops![0], arrive_min: null as never }] }) });
    expect(screen.getByText('Friday, Aug 28')).toBeTruthy();
    expect(screen.queryByText(/from \d/)).toBeNull();
  });

  // A day the row holds that is not a date — a row written by hand, or
  // by a version that spelled it differently — is shown as it came,
  // rather than as nothing: the card is still about a day.
  it('shows a day it cannot read as it came', () => {
    show({ trip: trip({ day: 'next friday' }) });
    expect(screen.getByText('next friday · from 17:00')).toBeTruthy();
  });
});

describe('the stops', () => {
  it('draws the card with no stops at all: no route line, the day alone', () => {
    show({ trip: trip({ trip_stops: undefined as never }) });
    expect(screen.getByText('Cà phê rồi hẻm Sài Gòn')).toBeTruthy();
    expect(screen.getByText('Friday, Aug 28')).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
    // Both answers are still on offer; a plan with no stops is still a plan.
    expect(screen.getByText('I’m in')).toBeTruthy();
  });

  it('skips a stop whose place has left the catalog', () => {
    const [first, second] = trip().trip_stops!;
    show({ trip: trip({ trip_stops: [{ ...first, places: null as never }, second] }) });
    expect(screen.getByText('Cơm tấm Ba Ghiền')).toBeTruthy();
    expect(screen.queryByText(/The Café Apartment/)).toBeNull();
  });
});

describe('who asked', () => {
  it('falls back to the handle when the profile has no name', () => {
    show({ from: { ...from, full_name: '' } });
    expect(screen.getByText(/@lanphuong/)).toBeTruthy();
  });

  it('says Someone on the photograph too, while the crew copy is loading', () => {
    show({ from: null, trip: trip({ trip_stops: [pictured()] }) });
    expect(screen.getByText(/Someone/)).toBeTruthy();
    expect(screen.getByText('Bởi Minh')).toBeTruthy();
  });

  it('uses the handle on the photograph when the profile has no name', () => {
    show({ from: { ...from, full_name: '' }, trip: trip({ trip_stops: [pictured()] }) });
    expect(screen.getByText(/@lanphuong/)).toBeTruthy();
  });
});

describe('the credit', () => {
  it('is withheld when the switch is off, photograph or not', () => {
    flags.credit = false;
    show({ trip: trip({ trip_stops: [pictured()] }) });
    expect(screen.queryByText('Bởi Minh')).toBeNull();
    // The photograph itself is still there — only the line is the switch's.
    expect(screen.getByText(/Lan Phương/)).toBeTruthy();
  });

  it('is absent for a photograph nobody signed', () => {
    show({ trip: trip({ trip_stops: [pictured(null)] }) });
    expect(screen.queryByText('Bởi Minh')).toBeNull();
  });
});
