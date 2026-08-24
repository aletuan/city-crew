// @vitest-environment jsdom
//
// The card three screens draw, rendered for real.
//
// It is the most-reused component in the app and had no test of any kind:
// every fault in it so far was found by opening the app and looking. What
// is asserted here is what a reader can actually see and do — the words in
// their language, which corner says what, and where a tap goes. Not the
// layout, which `react-native-web` does not simulate and this cannot speak
// about; see `src/uitest/setup.tsx`.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '../uitest/render';
import type { Lang } from '../lib/i18n';
import type { Place } from '../lib/data';

const state = vi.hoisted(() => ({ lang: 'en' as Lang, saved: new Set<string>() }));
const save = vi.hoisted(() => vi.fn());

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja?: string) => (
      { en, vi, ja: ja ?? en }[state.lang] ?? en
    ),
  }),
}));

// The save flow is a provider over data, auth and city. What the card owes
// it is one call with one place, which is what is pinned here; the flow's
// own branching is `lib/save`'s to answer for.
vi.mock('../lib/save', () => ({
  useSave: () => ({ save, isSaved: (slug: string) => state.saved.has(slug) }),
}));

import PlaceCard from './PlaceCard';

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'cong-caphe',
  city_id: 'hanoi',
  name_en: 'Cong Caphe',
  name_vi: 'Cộng Cà Phê',
  name_ja: 'コンカフェ',
  is_published: true,
  review_status: 'approved',
  place_photos: [],
  vibe_tags: [],
  categories: [],
  ...over,
} as unknown as Place);

beforeEach(() => {
  state.lang = 'en';
  state.saved = new Set();
  save.mockClear();
});

describe('the name', () => {
  it('is shown in the reader’s language', () => {
    state.lang = 'vi';
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
    expect(screen.queryByText('Cong Caphe')).toBeNull();
  });

  it('falls back to English where no Japanese was written', () => {
    state.lang = 'ja';
    render(<PlaceCard place={place({ name_ja: null })} onPress={() => {}} />);
    expect(screen.getByText('Cong Caphe')).toBeTruthy();
  });
});

describe('the photograph', () => {
  it('shows the cover, not merely the first photo', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      place_photos: [
        { photo_uri: 'http://x/second.jpg', is_cover: false, is_hidden: false, sort_order: 0 },
        { photo_uri: 'http://x/cover.jpg', is_cover: true, is_hidden: false, sort_order: 9 },
      ],
    } as Partial<Place>)} />);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('http://x/cover.jpg');
  });

  it('never shows a hidden one', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      place_photos: [
        { photo_uri: 'http://x/hidden.jpg', is_cover: true, is_hidden: true, sort_order: 0 },
      ],
    } as Partial<Place>)} />);
    expect(document.querySelector('img')).toBeNull();
  });

  // A card with no picture is a normal card, not a broken one: the emoji
  // stands in so the tile keeps its shape.
  it('stands the emoji in when there is no photo at all', () => {
    render(<PlaceCard place={place({ emoji: '☕' })} onPress={() => {}} />);
    expect(screen.getByText('☕')).toBeTruthy();
  });

  it('falls back to a pin when there is not even an emoji', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.getByText('📍')).toBeTruthy();
  });
});

describe('the rating', () => {
  it('is drawn with its review count', () => {
    render(<PlaceCard place={place({ rating: 4.6, rating_count: 1200 })} onPress={() => {}} />);
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('(1.2k)')).toBeTruthy();
  });

  // A place Google has no score for shows no star rather than a zero: a
  // zero is a rating, and "unrated" is not one.
  it('is absent entirely when there is no score', () => {
    render(<PlaceCard place={place({ rating: null })} onPress={() => {}} />);
    expect(screen.queryByText('★')).toBeNull();
  });
});

describe('the bookmark', () => {
  it('says what tapping it will do, and does it', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    const button = screen.getByLabelText('Save to a collection');
    fireEvent.click(button);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ slug: 'cong-caphe' }));
  });

  // Saved is a different offer, not the same one greyed out — tapping it
  // opens the sheet to change which lists hold the place.
  it('offers to change collections once the place is in one', () => {
    state.saved = new Set(['cong-caphe']);
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.getByLabelText('Saved — change collections')).toBeTruthy();
  });

  // The glyph is the whole of the difference a reader sees at a glance —
  // a filled bookmark against an outlined one.
  it('fills the glyph in once the place is saved', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(document.querySelector('[data-icon="bookmark-outline"]')).toBeTruthy();
    cleanup();
    state.saved = new Set(['cong-caphe']);
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(document.querySelector('[data-icon="bookmark"]')).toBeTruthy();
  });

  it('speaks the reader’s language', () => {
    state.lang = 'vi';
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.getByLabelText('Lưu vào bộ sưu tập')).toBeTruthy();
  });

  // The card and the bookmark are two targets in one tile, and the inner
  // one must not open the place on its way to saving it.
  it('does not open the place it saves', () => {
    const onPress = vi.fn();
    render(<PlaceCard place={place()} onPress={onPress} />);
    fireEvent.click(screen.getByLabelText('Save to a collection'));
    expect(save).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('the line under the name', () => {
  it('names the part of town', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      neighborhood_en: 'Ngoc Ha', neighborhood_vi: 'Ngọc Hà',
    })} />);
    expect(screen.getByText(/Ngoc Ha/)).toBeTruthy();
  });

  // Dropped rather than left blank when the catalog has no district: an
  // empty line under a name reads as a loading state.
  it('is absent when there is neither a district nor an hour', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});

// Only its submitter can see such a card at all, so the marker answers
// "why can nobody else see the place I added" rather than warning anyone.
describe('a place the desk has not published', () => {
  it('says so on a pending card', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      is_published: false, review_status: 'pending',
    })} />);
    expect(screen.getByText(/Only you can see this/i)).toBeTruthy();
  });

  // One is *wait*, the other is *no*. A person owed the second should not
  // be left expecting the first.
  it('does not soften a rejection into a wait', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      is_published: false, review_status: 'flagged',
    })} />);
    expect(screen.getByText('Not accepted')).toBeTruthy();
    expect(screen.queryByText(/Only you can see this/i)).toBeNull();
  });

  it('says nothing at all on a live card', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.queryByText(/Only you can see this/i)).toBeNull();
  });
});
