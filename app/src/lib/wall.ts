// The cover across the top of a person's page, as its owner chose it —
// docs/wall-plan.md (owner, 21 Nov 2026).
//
// Until then the page chose: the cover of the newest public list that had
// one, else the city's. On the owner's own phone that put the same
// pastries twice, one above the other — the page's first card is that
// same newest list. Now the owner picks a city, one of their collections'
// covers, or a picture they upload; and *automatic*, kept for everyone who
// never picks, skips the first list for exactly that reason.
//
// Pure, so the 100% gate reads it: what the page shows and what the sheet
// offers are both answered here from data the page already holds. The
// server stores only the choice (`profiles.wall_kind`, `wall_ref`); a
// collection that has since gone private or away is simply not among the
// public lists the page has, and the answer falls back to automatic —
// decision 4 of the plan — with no ghost and no blank.

import type { Collection, PlacePhoto } from './types';

export type WallKind = 'city' | 'collection' | 'upload';
export type Wall = { kind: WallKind; ref: string };

const KINDS: readonly string[] = ['city', 'collection', 'upload'];

/** The choice a profile row stores, or null for automatic. A row the
 *  database's check would never admit — a kind with nothing named — reads
 *  as automatic too, rather than as a cover that resolves to nothing. */
export function wallOf(p: { wall_kind?: string | null; wall_ref?: string | null } | null | undefined): Wall | null {
  if (!p?.wall_kind || !p.wall_ref || !KINDS.includes(p.wall_kind)) return null;
  return { kind: p.wall_kind as WallKind, ref: p.wall_ref };
}

/** What a choice is written back as. */
export function wallColumns(w: Wall | null): { wall_kind: WallKind | null; wall_ref: string | null } {
  return w ? { wall_kind: w.kind, wall_ref: w.ref } : { wall_kind: null, wall_ref: null };
}

type CityLike = { id: string; hero_photo_uri?: string | null; hero_place_slug?: string | null };

/**
 * A city's picture: its own photograph, else its hero place's cover.
 *
 * `cityCoverUri` does the same for the city on screen from the places
 * already loaded; the sheet offers every city, whose hero places are not,
 * so their photographs come in by slug (`fetchPlacePhotos`) and are
 * sorted here as `photosOf` sorts them. Three cities of eleven had no
 * photograph of their own on 21 Nov 2026 (Buôn Ma Thuột, Hà Nội, Ninh
 * Bình); without the fallback the sheet would offer them as grey.
 */
export function cityWallUri(city: CityLike, heroPhotos: Readonly<Record<string, PlacePhoto[]>>): string | undefined {
  if (city.hero_photo_uri) return city.hero_photo_uri;
  const photos = city.hero_place_slug ? heroPhotos[city.hero_place_slug] : undefined;
  return photos
    ?.filter((ph) => !ph.is_hidden)
    .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.sort_order - b.sort_order)[0]
    ?.photo_uri;
}

/** The hero places whose photographs a city needs, because it has none
 *  of its own. */
export function heroSlugsWanted(cities: readonly CityLike[]): string[] {
  return cities.filter((c) => !c.hero_photo_uri && c.hero_place_slug).map((c) => c.hero_place_slug as string);
}

/**
 * Automatic: the newest public list's cover *after the first*, else the
 * city's.
 *
 * The first is skipped because it is the first card under the cover: the
 * same photograph twice, one over the other, was what the owner saw and
 * the reason any of this was built. A person with one list gets the city.
 */
export function autoWall(
  open: readonly Collection[],
  coverFor: (c: Collection) => string | undefined,
  cityCover: string | undefined,
): string | undefined {
  for (const c of open.slice(1)) {
    const uri = coverFor(c);
    if (uri) return uri;
  }
  return cityCover;
}

/**
 * The cover the page shows.
 *
 * A city or a collection is looked up among what the page holds; one not
 * found — a city dropped, a list gone private, deleted or no longer
 * copied — or found without a picture is automatic. An upload is its URL.
 */
export function resolveWall(
  wall: Wall | null,
  { cities, heroPhotos, open, coverFor, auto }: {
    cities: readonly CityLike[];
    heroPhotos: Readonly<Record<string, PlacePhoto[]>>;
    open: readonly Collection[];
    coverFor: (c: Collection) => string | undefined;
    auto: string | undefined;
  },
): string | undefined {
  if (wall?.kind === 'upload') return wall.ref;
  if (wall?.kind === 'city') {
    const city = cities.find((c) => c.id === wall.ref);
    return (city && cityWallUri(city, heroPhotos)) || auto;
  }
  if (wall?.kind === 'collection') {
    const list = open.find((c) => c.id === wall.ref);
    return (list && coverFor(list)) || auto;
  }
  return auto;
}

export type WallTile = { wall: Wall; uri: string; title: string };

/** The sheet's city row: every city with a picture, in the order the
 *  city list has them. */
export function cityTiles(
  cities: readonly (CityLike & { name: string })[],
  heroPhotos: Readonly<Record<string, PlacePhoto[]>>,
): WallTile[] {
  const out: WallTile[] = [];
  for (const c of cities) {
    const uri = cityWallUri(c, heroPhotos);
    if (uri) out.push({ wall: { kind: 'city', ref: c.id }, uri, title: c.name });
  }
  return out;
}

/** The sheet's collection row: the owner's public lists — made or
 *  copied — that have a cover, newest first as the page has them. A
 *  private list is not offered: the cover is what every visitor sees. */
export function collectionTiles(
  open: readonly Collection[],
  coverFor: (c: Collection) => string | undefined,
  titleOf: (c: Collection) => string,
): WallTile[] {
  const out: WallTile[] = [];
  for (const c of open) {
    const uri = coverFor(c);
    // A list from the launch cache can arrive without its id; it cannot be
    // named, so it is not offered.
    if (uri && c.id) out.push({ wall: { kind: 'collection', ref: c.id }, uri, title: titleOf(c) });
  }
  return out;
}

/** Whether two choices are the same one — the tick in the sheet. */
export function sameWall(a: Wall | null, b: Wall | null): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.ref === b.ref);
}
