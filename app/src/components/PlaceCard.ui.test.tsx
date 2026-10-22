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

const state = vi.hoisted(() => ({ lang: 'en' as Exclude<Lang, 'zh' | 'zh-Hant'>, saved: new Set<string>() }));
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
vi.mock('../lib/save', () => {
  const useSave = () => ({ save, isSaved: (slug: string) => state.saved.has(slug) });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});

import PlaceCard from './PlaceCard';
import { CATEGORIES } from '../lib/categories';
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

  it('names the place from the i18n object when the reader’s language lives there', () => {
    state.lang = 'ja';
    render(<PlaceCard place={place({ name_ja: null, i18n: { ja: { name: 'オブジェクト' } } })} onPress={() => {}} />);
    expect(screen.getByText('オブジェクト')).toBeTruthy();
  });

  // The ward after the dash is the line under the name — see the
  // component, and `docs/place-naming.md` on who shows which half.
  it('shows the brand alone, leaving the branch after the dash to the line below', () => {
    render(<PlaceCard place={place({ name_en: 'Comfy Coffee & Bakes – Thủ Đức', neighborhood_en: 'Thủ Đức' })} onPress={() => {}} />);
    expect(screen.getByText('Comfy Coffee & Bakes')).toBeTruthy();
    expect(screen.queryByText(/Bakes – Thủ Đức/)).toBeNull();
    // The ward is still on the card, once.
    expect(screen.getAllByText(/Thủ Đức/)).toHaveLength(1);
  });

  it('cuts the name in the reader’s own language', () => {
    state.lang = 'vi';
    render(<PlaceCard place={place({ name_vi: 'Cộng Cà Phê – Tràng Tiền' })} onPress={() => {}} />);
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
    expect(screen.queryByText(/Tràng Tiền/)).toBeNull();
  });

  it('leaves a hyphenated word whole: only a dash with a space each side is a cut', () => {
    render(<PlaceCard place={place({ name_en: 'Coffee-N-Bagel 24/7' })} onPress={() => {}} />);
    expect(screen.getByText('Coffee-N-Bagel 24/7')).toBeTruthy();
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

  // Search's list can hold more than one city's places (owner, 22 Oct
  // 2026): the city goes before the district, on the district's own line.
  it('says the city before the district when handed one, and the city alone without a district', () => {
    const view = render(<PlaceCard testID="card" onPress={() => {}} city="Hà Nội" place={place({
      neighborhood_en: 'Giang Vo', neighborhood_vi: 'Giảng Võ',
    })} />);
    expect(screen.getByTestId('card-district').textContent).toBe('Hà Nội · Giang Vo');
    view.unmount();
    render(<PlaceCard testID="card" onPress={() => {}} city="Hà Nội" place={place()} />);
    expect(screen.getByTestId('card-district').textContent).toBe('Hà Nội');
  });

  it('says no city when handed none', () => {
    render(<PlaceCard testID="card" onPress={() => {}} place={place({ neighborhood_en: 'Giang Vo' })} />);
    expect(screen.getByTestId('card-district').textContent).toBe('Giang Vo');
  });

  // Dropped rather than left blank when the catalog has no district: an
  // empty line under a name reads as a loading state.
  it('is absent when there is neither a district nor an hour', () => {
    render(<PlaceCard place={place()} onPress={() => {}} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});

// The distance, which the card prints only when handed one: the screen
// hands it over with "Nearest first" and with nothing else, so a figure
// here always explains the order the card sits in.
describe('the distance', () => {
  const line = () => screen.getByTestId('card').textContent ?? '';
  const card = (distanceKm: number | null | undefined, extra: Partial<Place> = {}) =>
    render(<PlaceCard testID="card" onPress={() => {}} distanceKm={distanceKm} place={place({
      neighborhood_en: 'Kim Lien', neighborhood_vi: 'Kim Liên', ...extra,
    })} />);

  it('says nothing when there is no figure', () => {
    card(null);
    expect(line()).toContain('Kim Lien');
    expect(line()).not.toMatch(/·|\d+ m\b|km/);
  });

  // District first, then the figure: the line reads as a sentence about
  // a place, and "Kim Lien · 850 m" is how that sentence goes.
  it('follows the district, in metres while it is a walk', () => {
    card(0.847);
    expect(line()).toContain('Kim Lien · 850 m');
  });

  // The pin is the pin whatever the sort. A first cut swapped it for the
  // sort's arrow beside a figure, and the owner read the swap as a glitch.
  it('keeps the pin beside the figure, the same glyph as without one', () => {
    card(0.847);
    expect(document.querySelector('[data-icon="location-outline"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="navigate-outline"]')).toBeNull();
  });

  it('rounds to one decimal on a ride and to whole kilometres beyond ten', () => {
    card(1.24);
    expect(line()).toContain('Kim Lien · 1.2 km');
    cleanup();
    card(12.4);
    expect(line()).toContain('Kim Lien · 12 km');
  });

  // The district is the one piece of the line that may shrink; the
  // figures' box never does, so a long district ends in an ellipsis and
  // the number stays whole. jsdom lays nothing out, so this holds the
  // flex rules themselves — the mutant that puts the figures back in the
  // district's Text, or lets their box shrink, fails here.
  it('lets the district shrink and never the figures', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T14:30:00Z'));
    card(1.24, {
      neighborhood_en: 'Van Mieu - Quoc Tu Giam', neighborhood_vi: 'Văn Miếu - Quốc Tử Giám',
      opening_hours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .map((d) => `${d}: 8:00 AM – 10:00 PM`),
    });
    const district = screen.getByTestId('card-district');
    const figures = screen.getByTestId('card-figures');
    expect(district.textContent).toBe('Van Mieu - Quoc Tu Giam');
    expect(figures.textContent).toBe(' · 1.2 km · until 22:00');
    expect(getComputedStyle(district).flexShrink).toBe('1');
    expect(getComputedStyle(figures).flexShrink).toBe('0');
    vi.useRealTimers();
  });

  // A place with no district still gets its figure, and the line is
  // not dropped the way an empty one is.
  it('stands alone when the catalog has no district', () => {
    card(0.4, { neighborhood_en: null, neighborhood_vi: null });
    expect(line()).toContain('400 m');
    expect(line()).not.toContain('·');
  });

  // The hour keeps its place at the end, after the figure: when the
  // line is clipped it is the hour that goes, never the distance.
  it('sits between the district and the closing hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T14:30:00Z')); // 21:30 Hanoi, half an hour to close
    card(0.4, {
      opening_hours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .map((d) => `${d}: 8:00 AM – 10:00 PM`),
    });
    expect(line()).toContain('Kim Lien · 400 m · until 22:00');
    vi.useRealTimers();
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

  // A shut place says so on the photograph, in words, because the band
  // alone could not: it marks *now* with a two-point tick and leaves the
  // reader to notice which side of the fill it fell on. At 22:42, 23 of
  // the 122 shut places in this catalog put that tick within three points
  // of the fill — a distinction nobody was going to make on a moving
  // list. The body stays quiet either way; it is the picture that speaks.
  it('writes the opening hour across the photograph, and leaves the state to the red', () => {
    vi.useFakeTimers();
    atICT('2026-09-09T23:00:00Z'); // 06:00 — two hours before opening
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('Opens 08:00');
    expect(shown()).not.toContain('Closed');
  });

  // The hour that matters most is tomorrow's: at half past eleven the
  // feed is mostly shut, and "Closed" was all the sash could say until
  // `openState` looked a day ahead.
  it('names tomorrow’s opening late at night', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T16:30:00Z'); // 23:30 — the next 08:00 is tomorrow's
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('Opens 08:00');
  });

  // The colour says shut; a reader who cannot see it must still hear it.
  // So the sash's text carries the full sentence as its label, once —
  // the band stays silent, as before, rather than reading the same words
  // to the same person again.
  it('tells a screen reader the state the eye gets from the colour', () => {
    vi.useFakeTimers();
    atICT('2026-09-09T23:00:00Z');
    card(week('8:00 AM – 10:00 PM'));
    expect(screen.getAllByLabelText('Closed · opens 08:00')).toHaveLength(1);
    expect(shown().match(/Opens 08:00/g)).toHaveLength(1);
  });

  // Nothing within a day to promise — the bare word, which the colour
  // was already saying, is the honest fallback.
  it('says Closed alone when nothing opens within a day', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T03:00:00Z');
    card(week('Closed'));
    expect(shown()).toContain('Closed');
    expect(shown()).not.toContain('Opens');
  });

  // The picture keeps the sash only while the door is shut: the mark is
  // the answer to "can I go now", so an open place must not wear it.
  it('leaves the photograph alone while the place is open', () => {
    vi.useFakeTimers();
    atICT('2026-09-10T03:00:00Z'); // 10:00
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).not.toContain('Closed');
  });

  // The sash speaks the reader's language, like every other word on the
  // card — it is a sentence, not a badge with a fixed English on it.
  it('speaks the reader’s language', () => {
    vi.useFakeTimers();
    atICT('2026-09-09T23:00:00Z');
    state.lang = 'vi';
    card(week('8:00 AM – 10:00 PM'));
    expect(shown()).toContain('Mở 08:00');
    expect(screen.getByLabelText('Đóng cửa · mở 08:00')).toBeTruthy();
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

// The kind pill shares the district's line: what the place is, spelled
// out, with the dot its pin wears, and the rest of its kinds as a count.
// What is asserted is what a reader sees — the word, the dot's colour and
// whether a number appears beside it — not the layout, which
// `react-native-web` does not simulate.
describe('the kind pill', () => {
  const pill = () => screen.getByTestId('c-kind');
  const dot = () => pill().firstElementChild as HTMLElement;
  // The colour as the browser reports it, from the table's hex.
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  it('spells out the only kind, in its own colour, with no count beside it', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({ categories: ['cafes'] })} />);
    expect(pill().textContent).toBe('Cafés');
    expect(getComputedStyle(dot()).backgroundColor).toBe(rgb(CATEGORIES.cafes.color));
  });

  // The vibe pill this replaced read `vibe_tags[0]`: here that is a
  // judgement, and the card would have said "Quiet" in a colour no
  // category wears.
  it('reads the category, not the first vibe', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({
      categories: ['eats'], vibe_tags: ['quiet', 'food_tour'],
    })} />);
    expect(pill().textContent).toBe('Eats');
    expect(screen.queryByText('Quiet')).toBeNull();
  });

  // What it is *most*, by the filter row's order, which is the pin's rule
  // — not whichever the row stored first.
  it('names the kind its pin wears and counts the rest', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({
      categories: ['views', 'heritage', 'cafes'],
    })} />);
    expect(pill().textContent).toBe('Cafés+2');
    expect(getComputedStyle(dot()).backgroundColor).toBe(rgb(CATEGORIES.cafes.color));
    expect(screen.queryByText('Views')).toBeNull();
  });

  // Under a chip, every card is already that kind of place; the pill
  // names the chip, as the pin does, rather than contradict the row.
  it('names the chip the list is filtered to', () => {
    render(<PlaceCard testID="c" chip="focus" onPress={() => {}} place={place({
      categories: ['cafes', 'focus'],
    })} />);
    expect(pill().textContent).toBe('Focus+1');
    expect(getComputedStyle(dot()).backgroundColor).toBe(rgb(CATEGORIES.focus.color));
  });

  it('speaks the reader’s language', () => {
    state.lang = 'vi';
    render(<PlaceCard testID="c" onPress={() => {}} place={place({ categories: ['cafes', 'focus'] })} />);
    expect(pill().textContent).toBe('Cà phê+1');
  });

  // A key the catalog grew before `CATEGORIES` knew about it still gets a
  // word, tidied, but no dot: a colour is a category's, and this one has
  // none to give.
  it('names a kind the table has never heard of, without a dot', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({ categories: ['street_food'] })} />);
    expect(pill().textContent).toBe('Street food');
    expect(pill().children.length).toBe(1);
  });

  // A known kind beside an unknown one: the known one leads, and the
  // unknown one is still counted.
  it('leads with the kind it knows and counts the one it does not', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({ categories: ['street_food', 'nightlife'] })} />);
    expect(pill().textContent).toBe('Nightlife+1');
  });

  it('is absent when nothing classifies the place', () => {
    render(<PlaceCard testID="c" onPress={() => {}} place={place({
      neighborhood_en: 'Ngoc Ha', categories: [], vibe_tags: ['quiet'],
    })} />);
    expect(screen.getByText(/Ngoc Ha/)).toBeTruthy();
    expect(screen.queryByTestId('c-kind')).toBeNull();
  });

  // The line is drawn for the pill alone: a place with no district and no
  // hour still says what it is rather than dropping the row.
  it('is drawn even with neither a district nor an hour', () => {
    render(<PlaceCard onPress={() => {}} place={place({ categories: ['nature'] })} />);
    expect(screen.getByText('Nature')).toBeTruthy();
  });

  // The long name this catalog actually holds, beside a two-kind pill:
  // the name is its own line, so nothing here competes with it.
  it('stands beside the longest names in the catalog', () => {
    render(<PlaceCard onPress={() => {}} place={place({
      name_en: 'Vietnam Military History Museum',
      neighborhood_en: 'Xuan Phuong',
      categories: ['heritage', 'nature'],
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

// The collection screen lifts a card on a hold. The card's own button is
// what hears the hold, so the props have to reach it. Played through the
// real press machinery, not by calling the props: a card that dropped
// them would still render, and only a hold would find out.
describe('a hold', () => {
  it('reaches the card\'s button, and so does letting go', async () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const onPressOut = vi.fn();
    const onPress = vi.fn();
    render(
      <PlaceCard
        place={place()}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={100}
        onPressOut={onPressOut}
      />,
    );
    const target = screen.getByText('Cong Caphe');
    fireEvent.mouseDown(target, { button: 0, pageY: 300 });
    // After the delay the card was given, and well before the default
    // (react-native-web's 450 ms, plus its own 50 ms press-start delay on
    // top of either): a card that dropped the delay would still lift, late.
    await vi.advanceTimersByTimeAsync(99);
    expect(onLongPress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    fireEvent.mouseUp(target, { button: 0 });
    expect(onPressOut).toHaveBeenCalled();
    // A press that lifted is not also a tap.
    expect(onPress).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
