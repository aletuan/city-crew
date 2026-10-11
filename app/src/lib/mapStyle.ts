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

/** Each dark look's own night; a dark look not named here is charcoal's. */
const NIGHTS: Partial<Record<Look, MapStyleRule[]>> = {
  coffee: COFFEE_NIGHT,
  midnight: MIDNIGHT_NIGHT,
  navy: NAVY_NIGHT,
};

/**
 * The style for a map that carries our own pins, in the reading the
 * reader chose in Profile. The light looks — Rose, Blush, Slate — take
 * Google's own day map, as paper does; each dark look its own night.
 *
 * Not for `MiniMap`, which is a picker: there the reader is choosing a
 * point on the map rather than reading ours off it, and Google's badges
 * are what they aim at.
 */
export function mapStyle(scheme: Scheme, look: Look = 'standard'): MapStyleRule[] {
  if (scheme !== 'dark') return NO_BADGES;
  return [...NO_BADGES, ...(NIGHTS[look] ?? NIGHT)];
}
