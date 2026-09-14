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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { appFlags } from '../lib/flags';

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
  appFlags.reset();
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

// What the clock is allowed to put on the card, and where.
//
// Three states, three appearances, and the point of the set is that no
// two of them look alike: a shut place is marked on the photograph, a
// place about to shut names its hour, and a place with hours yet says
// nothing at all. Before this, all three said something in the same grey.
describe('the hour', () => {
  const week = (hours: string) =>
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d) => `${d}: ${hours}`);
  // Vietnam is UTC+7. 2026-09-10 is a Thursday.
  const atICT = (iso: string) => vi.setSystemTime(new Date(iso));
  const shown = () => screen.getByTestId('card').textContent ?? '';
  const card = (hours: string[]) =>
    render(<PlaceCard testID="card" onPress={() => {}} place={place({
      neighborhood_en: 'Hoan Kiem', opening_hours: hours,
    })} />);

  afterEach(() => { vi.useRealTimers(); });

  it('says nothing while the place has hours left', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T03:00:00Z'); // 10:00 — twelve hours to go
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('Hoan Kiem');
    expect(shown()).not.toContain('until');
  });

  it('names the closing hour once it is close', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T14:30:00Z'); // 21:30 — half an hour to go
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('until 22:00');
  });

  // On the photograph, not the meta line — and said once, not twice.
  it('marks a shut place on its picture, and does not repeat it below', () => {
    vi.useFakeTimers();
    atICT('2026-09-09T23:00:00Z'); // 06:00 — two hours before opening
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('Closed · opens 08:00');
    expect(shown()).not.toContain('opens 08:00 ·');
  });

  // A place that never closes is the one place where nothing is ever
  // about to happen.
  it('says nothing for a place that is always open', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T03:00:00Z');
    card(week('Open 24 hours'));
    expect(shown()).toContain('Hoan Kiem');
    expect(shown()).not.toContain('24');
  });
});

// The vibe pill shares the district's line: the first tag spelled out, the
// rest as a count. What is asserted is what a reader sees — the word, and
// whether a number appears beside it — not the layout, which
// `react-native-web` does not simulate.
describe('the vibe pill', () => {
  it('spells out the only tag, with no count beside it', () => {
    render(<PlaceCard onPress={() => {}} place={place({ vibe_tags: ['cafes'] })} />);
    expect(screen.getByText('Cafés')).toBeTruthy();
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('counts the tags it did not spell out', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      vibe_tags: ['food_tour', 'kid_friendly'],
    })} />);
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    // The second tag is counted, not named.
    expect(screen.queryByText('Kid-friendly')).toBeNull();
  });

  it('counts every tag past the first, however many', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      vibe_tags: ['culture', 'views', 'chill', 'quiet'],
    })} />);
    expect(screen.getByText('Culture')).toBeTruthy();
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('speaks the reader’s language', () => {
    state.lang = 'vi';
    render(<PlaceCard onPress={() => {}} place={place({ vibe_tags: ['cafes', 'quiet'] })} />);
    expect(screen.getByText('Cà phê')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
  });

  // A tag the catalog grew before `VIBES` knew about it still gets a word
  // rather than a blank pill — `vibeLabel` falls back to the key itself.
  it('names a tag the table has never heard of', () => {
    render(<PlaceCard onPress={() => {}} place={place({ vibe_tags: ['late_night'] })} />);
    expect(screen.getByText('Late night')).toBeTruthy();
  });

  it('is absent when the place carries no tags', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      neighborhood_en: 'Ngoc Ha', vibe_tags: [],
    })} />);
    expect(screen.getByText(/Ngoc Ha/)).toBeTruthy();
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  // The line is drawn for the tags alone: a place with no district and no
  // hour still shows its vibe rather than dropping the row.
  it('is drawn even with neither a district nor an hour', () => {
    render(<PlaceCard onPress={() => {}} place={place({ vibe_tags: ['outdoors'] })} />);
    expect(screen.getByText('Nature')).toBeTruthy();
  });

  // The long name this catalog actually holds, beside a two-tag pill: the
  // name is its own line, so nothing here competes with it.
  it('stands beside the longest names in the catalog', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      name_en: 'Vietnam Military History Museum',
      neighborhood_en: 'Xuan Phuong',
      vibe_tags: ['culture', 'kid_friendly'],
    })} />);
    expect(screen.getByText('Vietnam Military History Museum')).toBeTruthy();
    expect(screen.getByText('Culture')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
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

// The photographer's credit over a Google photo is what Google's terms
// ask for, and whether it is drawn is a switch in the database rather
// than a release — see `lib/flags.ts`. What is pinned: it is drawn as
// shipped, and the switch alone takes it away.
describe('the credit', () => {
  const photo = {
    id: 'ph-1', photo_uri: 'https://x/y.jpg', is_cover: true, is_hidden: false,
    sort_order: 0, attribution_name: 'Bởi Minh',
  };

  it('is drawn as shipped', () => {
    render(<PlaceCard place={place({ place_photos: [photo] } as Partial<Place>)} onPress={() => {}} />);
    expect(screen.getByText('Bởi Minh')).toBeTruthy();
  });

  it('is gone when the switch says so', () => {
    appFlags.set('photo_attribution', false);
    render(<PlaceCard place={place({ place_photos: [photo] } as Partial<Place>)} onPress={() => {}} />);
    expect(screen.queryByText('Bởi Minh')).toBeNull();
  });
});
