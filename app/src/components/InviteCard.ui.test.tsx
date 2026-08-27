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

beforeEach(() => { onAnswer.mockClear(); onOpen.mockClear(); });

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
