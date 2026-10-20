// The picture each pin is drawn from.
//
// Twenty static imports and a lookup, deliberately with no logic in it:
// which category a place answers to is `pinCategory`'s question and is
// tested as a pure function, while Metro needs every asset path to be a
// literal it can see at build time. A table it can read and a rule it
// cannot are different things and live apart.
//
// Drawn by `scripts/map-pins.py` from the same table `pinCategory` reads;
// `taxonomy.test.ts` holds the two together.

import { pinCategory, type Categorisable, type Category } from '../lib/categories';

import cafes from '../../assets/pins/cafes.png';
import cafesChosen from '../../assets/pins/cafes-chosen.png';
import eats from '../../assets/pins/eats.png';
import eatsChosen from '../../assets/pins/eats-chosen.png';
import focus from '../../assets/pins/focus.png';
import focusChosen from '../../assets/pins/focus-chosen.png';
import fun from '../../assets/pins/fun.png';
import funChosen from '../../assets/pins/fun-chosen.png';
import heritage from '../../assets/pins/heritage.png';
import heritageChosen from '../../assets/pins/heritage-chosen.png';
import markets from '../../assets/pins/markets.png';
import marketsChosen from '../../assets/pins/markets-chosen.png';
import nature from '../../assets/pins/nature.png';
import natureChosen from '../../assets/pins/nature-chosen.png';
import neutral from '../../assets/pins/neutral.png';
import neutralChosen from '../../assets/pins/neutral-chosen.png';
import nightlife from '../../assets/pins/nightlife.png';
import nightlifeChosen from '../../assets/pins/nightlife-chosen.png';
import views from '../../assets/pins/views.png';
import viewsChosen from '../../assets/pins/views-chosen.png';

// Both tables must name every category and the neutral pin, or this
// does not compile: a category added to the filter row without its two
// pictures used to reach the map as an undefined image, which draws
// nothing. Read by any string below, as `pinCategory` hands back one.
const PLAIN: Readonly<Record<string, number>> = {
  cafes, eats, focus, fun, heritage, markets, nature, nightlife, views, neutral,
} satisfies Record<Category | 'neutral', number>;
const CHOSEN: Readonly<Record<string, number>> = {
  cafes: cafesChosen, eats: eatsChosen, focus: focusChosen, fun: funChosen,
  heritage: heritageChosen, markets: marketsChosen, nature: natureChosen,
  nightlife: nightlifeChosen, views: viewsChosen, neutral: neutralChosen,
} satisfies Record<Category | 'neutral', number>;

/**
 * The picture this place's pin is drawn from.
 *
 * `chip` is the category the reader is standing in, or null for the whole
 * catalog — under a chip every pin wears the chip's picture, which is
 * `pinCategory`'s rule and not this file's. A place nothing classifies
 * gets the neutral pin rather than a guess.
 */
export function pinImage(place: Categorisable, chip: string | null, chosen: boolean): number {
  const key = pinCategory(place, chip) ?? 'neutral';
  return (chosen ? CHOSEN : PLAIN)[key];
}
