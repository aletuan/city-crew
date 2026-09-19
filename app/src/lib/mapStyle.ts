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
// `transit` is a different featureType and is deliberately untouched: a
// station is wayfinding, and this app never pins one, so its icon can
// never be a duplicate of anything.

/** The shape `react-native-maps` takes for `customMapStyle`, declared
 *  here rather than imported: this file must stay free of that module,
 *  which is native and unreachable from the test environment — see
 *  `components/mapsModule`. Structural typing does the rest. */
export type MapStyleRule = { featureType?: string; elementType?: string; stylers: object[] };

/**
 * Passed to every map that carries our own pins.
 *
 * Not to `MiniMap`, which is a picker: there the reader is choosing a
 * point on the map rather than reading ours off it, and Google's badges
 * are what they aim at.
 */
export const MAP_STYLE: MapStyleRule[] = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
