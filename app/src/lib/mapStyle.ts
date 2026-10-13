// What the map is asked not to draw, so that what it does draw is ours.
//
// Every place this app pins is Google Places content — see the licence
// note atop `MiniMap` — which means Google's own map already knows each
// of them and draws its own badge for each. At the zoom where those
// badges appear, every pin of ours sat beside one: on 2026-09-19, Phở 10
// Lý Quốc Sư showed twice on one screen, an orange fork-and-knife of
// theirs and a brown pin of ours, the same restaurant in two visual
// languages a few points apart. Ours is drawn from their own marker art
// (`pinColor` only tints it), so the two could not be told apart by
// shape either.
//
// Hiding the badge takes the name with it. That was not the intention
// and it cannot be undone: on the Google Maps SDK a rule turning
// `poi` `labels.text` back on changes nothing — verified twice at the
// same corner of Hanoi, once with the rule and once without. So the
// choice this file makes is not "badges or names" but "their places or
// ours", and it chooses ours: what is left is streets, districts, water
// and parks, which is what a reader navigates by, with our pins as the
// only points of interest on it.
//
// `transit` icons are deliberately untouched: a station is wayfinding,
// and this app never pins one, so its icon can never be a duplicate of
// anything. The night reading recolours transit *geometry*, which is the
// line on the ground, not the badge above it.

import type { Look } from './look';
import type { Scheme } from './theme';

/** The shape `react-native-maps` takes for `customMapStyle`, declared
 *  here rather than imported: this file must stay free of that module,
 *  which is native and unreachable from the test environment — see
 *  `components/mapsModule`. Structural typing does the rest. */
export type MapStyleRule = { featureType?: string; elementType?: string; stylers: object[] };

/** Google draws a badge for every place we pin, because our places are
 *  its places. See the note at the top of this file. */
const NO_BADGES: MapStyleRule[] = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/**
 * The map in the app's dark reading.
 *
 * Google has no "dark mode" to switch on: a night map is a style like any
 * other, and this one is written in the app's own palette rather than
 * copied from Google's sample, so the map is the same material as the
 * screen around it.
 *
 * The land is not as dark as the app's background. It could be, and it
 * looked better empty — but the pins are drawn from Google's marker art,
 * which renders our colours much darker than the tokens they come from,
 * and a near-black ground swallowed them. The ground is lifted until the
 * pins stand off it; the app's own surfaces stay darker, which is also
 * how the map reads as a thing set into the screen rather than as the
 * screen itself.
 */
const NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#1C1A15' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#B7B6B1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0B0A' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#33302A' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F7F7F5' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1F2419' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1F2419' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2721' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9C978C' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#332F27' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#423B2F' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#C9C3B6' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A2721' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#101A1F' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4E6B75' }] },
];

// The coffee reading (10 Oct 2026), the Coffee look's own: the charcoal
// style above shifted into the page's brown family step for step — land a lift above #271910 as it was
// a lift above #0A0B0A, roads a step and two above the land, the labels in
// the theme's cream steps, the stroke behind them the page itself. Water
// and parks keep their own hue, cooled and greened off the brown, so the
// map still says where the river is.
const COFFEE_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#3A2A1F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C7AA9A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#271910' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#55402F' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F3E9E2' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#35361F' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#35361F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4A3628' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A88B7A' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#54402F' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#664E3A' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#DCC8BB' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#4A3628' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1E2B30' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6B8A93' }] },
];

// The two blue looks (11 Oct 2026), each in its own family by the coffee
// reading's steps: land a lift above the page, roads a step and two above
// the land, labels in the look's own type steps, the stroke behind them
// the page itself. The page is already blue, so the river cannot be told
// by hue alone: water goes *below* the page instead, the one surface
// darker than the ground, and parks take a green off the navy.
const MIDNIGHT_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#34406A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D2D0B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#252F52' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4A5786' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F9F8E2' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#2E4848' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2E4848' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3F4C7A' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#ABAA96' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#485687' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#56659A' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#E4E2CB' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#3F4C7A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#18203A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7F8DB8' }] },
];

const NAVY_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#22394A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C2B2A3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#162C39' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3A5568' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F2ECE6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#22402F' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#22402F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C4659' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A39486' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#335064' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3F5E74' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#DCCFC3' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2C4659' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1C25' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6F8C9C' }] },
];

// Chocolate (11 Oct 2026): a lift above its light-dark page in the same
// brown, the roads warmer still, parks an olive off the brown. Its page is
// light enough that the water goes below it, as the blue looks' does.
const CHOCOLATE_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#5B4C46' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#EECBC0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#4E403B' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#73625B' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FAF0EC' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#4F5543' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#4F5543' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#66564F' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#D0A79B' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#705F58' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#7E6C64' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#F5DED6' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#66564F' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2F3238' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9FB3BE' }] },
];

// Cosmic (11 Oct 2026): the midnight reading in the purple family — land
// a lift above the page, water below it.
const COSMIC_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#2F2446' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C9BFD6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#211832' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#453860' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F3EEF8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#283A3A' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#283A3A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3A2D55' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9E93AE' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#443662' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#524174' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#E1D8EA' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#3A2D55' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#141027' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7E86B0' }] },
];

// Honey (11 Oct 2026): the coffee reading on a brown-black page — land a
// lift above it in the same brown, roads warmer still, parks an olive.
// The page is near-black, so the water is the one surface below it.
const HONEY_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#2B2110' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D9C9A6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1E1608' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3E3220' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FBF3E0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#2B3420' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2B3420' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#352A16' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#B09E78' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3E321B' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4B3D21' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#EFE4C9' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#352A16' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#110C04' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8A8A6A' }] },
];

// Royal (11 Oct 2026): the midnight reading in a saturated blue — land
// a lift above the page, water below it, parks a teal off the blue.
const ROYAL_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#1151A3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#E2E8F3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#04408B' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2A66B4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F7F6EE' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1C5A6A' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1C5A6A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E5BAB' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#AEBFDB' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2A66B4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3B74BE' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#E8EDF7' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1E5BAB' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#032E66' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6E93C8' }] },
];

// Plum (12 Oct 2026): the chocolate reading on a light-dark indigo page —
// land a lift above it, parks a slate green, water the one surface below.
const PLUM_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#574F84' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#E6DAEB' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#4B4376' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6D6499' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F5F0F6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#4A5A5E' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#4A5A5E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#625A8F' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#C8B6CF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#6B639A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#7A72A8' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#F0E8F3' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#625A8F' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2E2850' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9A93C4' }] },
];

// Violet (12 Oct 2026): the cosmic reading in plum — land a lift above
// the page, water below it, parks an ash green.
const VIOLET_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#3F1539' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D7CDCD' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#31082C' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#55284F' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F6EEF4' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#3A3634' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#3A3634' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4A1F45' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#AC9BAA' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#562A51' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#65365F' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#E9DFE7' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#4A1F45' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1E0419' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8E7A8B' }] },
];

// Wine (12 Oct 2026): the coffee reading in burgundy — land a lift above
// the page in the same red, parks a warm olive, water below the page.
const WINE_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#602034' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#FACCD7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#501627' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#7A3348' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FBEFF2' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#553A34' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#553A34' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#6D2A41' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#D9A2B1' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#78334A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#884059' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#F6DEE5' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#6D2A41' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#340C19' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#A77A8A' }] },
];

// Maroon (12 Oct 2026): wine's reading a step darker and browner — land a
// lift above the page in its own red, parks a warm umber, water below.
const MAROON_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#4E1A2E' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#DEC9B0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#3D1223' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6A2A40' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F7EBDD' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#4A3430' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#4A3430' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#5A2238' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#B89A86' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#662A41' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#76344E' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#F0DFCB' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#5A2238' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#250A15' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9A7A86' }] },
];

// Neon (12 Oct 2026): violet's reading on the darker plum — the land a
// lift in the same plum, the neon kept off the tiles for the pins.
const NEON_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#352038' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#DCC8DA' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#271627' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4E2E4E' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F7EEF6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#38322F' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#38322F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#452A48' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#B096AE' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#532F57' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#633A68' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#EFE2ED' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#452A48' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#170B17' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8E7A8B' }] },
];

// Ember (12 Oct 2026): charcoal's reading with coffee in the black — the
// land a lift in warm greys, parks an olive, water the one true black.
const EMBER_NIGHT: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#1B1612' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D9CDC2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0C0903' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3A2E24' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F6EFE8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#24291B' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#24291B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A221C' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A69787' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#36291F' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#473424' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#EDE3D9' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A221C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#040201' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7F7066' }] },
];

/** Each dark look's own night; a dark look not named here is charcoal's. */
const NIGHTS: Partial<Record<Look, MapStyleRule[]>> = {
  coffee: COFFEE_NIGHT,
  midnight: MIDNIGHT_NIGHT,
  navy: NAVY_NIGHT,
  chocolate: CHOCOLATE_NIGHT,
  cosmic: COSMIC_NIGHT,
  honey: HONEY_NIGHT,
  royal: ROYAL_NIGHT,
  plum: PLUM_NIGHT,
  violet: VIOLET_NIGHT,
  wine: WINE_NIGHT,
  maroon: MAROON_NIGHT,
  neon: NEON_NIGHT,
  ember: EMBER_NIGHT,
};

/**
 * The style for a map that carries our own pins, in the reading the
 * reader chose in Profile. The light looks — Rose, Blush, Slate, Teal,
 * Amber, Sand — take Google's own day map, as paper does; each dark look its
 * own night.
 *
 * Not for `MiniMap`, which is a picker: there the reader is choosing a
 * point on the map rather than reading ours off it, and Google's badges
 * are what they aim at.
 */
export function mapStyle(scheme: Scheme, look: Look = 'standard'): MapStyleRule[] {
  if (scheme !== 'dark') return NO_BADGES;
  return [...NO_BADGES, ...(NIGHTS[look] ?? NIGHT)];
}
