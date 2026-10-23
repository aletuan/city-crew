// The gallery a local guide keeps, decided without asking the server.
//
// ── the rule, in one place twice ──
//
// Postgres enforces this — `20260921140000_gallery_same_rights.sql` —
// and this module states the same rule in the app, so a control that
// would be refused is never drawn. The reasoning is `lib/guide`'s: a
// button that exists and then fails is worse than one that was never
// offered.
//
// The rule is the plain one. On a place the guide brought in, the guide
// and the desk may do the same things to any photograph — cover, hide,
// show again, delete — and whoever acts last wins. There is no boundary
// between kinds of photograph and no veto; an earlier draft had both and
// was more than was asked for.
//
// So the only question a photograph gets asked is "is it hidden?", which
// decides whether the menu offers the way out or the way back. Who may
// open the gallery at all is `canKeepGallery`, a question about the
// place, not the photograph.
//
// Plain TypeScript, tested from `gallery.test.ts`.

import { canAddPhoto } from './guide';
import type { PhotoKind } from './photoKind';
import type { PhotoScore } from './photoScore';

/** A photograph as the gallery reads it. `source` is printed, never
 *  decided on. */
export type GalleryPhoto = {
  id: string;
  photo_uri: string;
  is_cover: boolean;
  is_hidden: boolean;
  sort_order: number;
  source: string;
  /** Where the file is in `place-photos`; null for a row whose picture
   *  was never ours to store. A delete passes it on to the bucket. */
  storage_path: string | null;
  /** Vision's reading, once somebody has asked for it (`photoScore`). */
  score?: PhotoScore | null;
  /** What it shows, from the photo labels, when they are sure
   *  (`photoKind`). */
  kind?: PhotoKind | null;
};

/** Who may open the gallery at all: the same three conditions that let a
 *  person add to it. There is no fourth. */
export const canKeepGallery = canAddPhoto;

export type GalleryAction = 'cover' | 'hide' | 'unhide' | 'delete';

/**
 * What the ⋯ menu on a tile offers, in the order it offers it.
 *
 * Never empty: every photograph on the place is the keeper's to change.
 * A hidden one offers its way back; a visible one offers the cover and
 * the way out. Delete is last on both. The cover keeps its cover slot,
 * held rather than offered (the screen draws it so), so the photo
 * sheet's dock is three slots on every visible photograph and does not
 * change shape as the guide swipes onto the cover (owner, 18 Oct 2026).
 */
export function galleryActions(photo: GalleryPhoto): GalleryAction[] {
  const out: GalleryAction[] = [];
  if (photo.is_hidden) {
    out.push('unhide');
  } else {
    out.push('cover', 'hide');
  }
  out.push('delete');
  return out;
}

/**
 * The gallery's order: the cover first, then `sort_order`.
 *
 * It was `sort_order` alone, the cover wearing its badge wherever it sat,
 * on the reasoning that this screen shows what the guide is arranging and
 * the carousel (`photosOf`, cover-first) shows what readers see. The
 * owner turned it round (16 Oct 2026): the cover is the photograph that
 * matters most, and it should be where it is found without looking — the
 * first tile, as it is the first picture on the place. The cost, taken
 * knowingly: making another photograph the cover moves it to the front
 * and the rest along one. The ring on the tile last opened follows the
 * photograph, not the cell, so the guide still sees which one it was.
 */
export function galleryOrder(photos: readonly GalleryPhoto[]): GalleryPhoto[] {
  return [...photos].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
}

/** One change the guide asked for, as the grid should draw it at once. */
export type GalleryEdit =
  | { kind: 'cover'; id: string }
  | { kind: 'hide'; id: string; hidden: boolean }
  | { kind: 'delete'; ids: readonly string[] };

/**
 * The gallery as it will be once the server has done what was asked.
 *
 * ── why (owner, 23 Oct 2026) ──
 *
 * A tap used to change nothing on the grid until two round trips had
 * come back one after the other — the write, then the gallery read again
 * — with every tile disabled in between and no sign of why. "It hangs a
 * little when a photo changes." The grid draws this instead the moment
 * the tap lands, and the read-back replaces it when it arrives.
 *
 * The server's own rules, restated so the guess matches the answer
 * (`guide_set_cover`, `guide_set_hidden`): one cover, which moves to the
 * front (`galleryOrder`); a hidden photograph is never the cover, so
 * hiding the cover leaves the place without one, as the server does; a
 * hidden photograph cannot be made the cover — the menu never offers it
 * — so that guess is not drawn. Deleting the cover leaves none either:
 * the server picks no successor.
 */
export function applyEdit(photos: readonly GalleryPhoto[], e: GalleryEdit): GalleryPhoto[] {
  if (e.kind === 'delete') return photos.filter((p) => !e.ids.includes(p.id));
  if (e.kind === 'hide') {
    return photos.map((p) => (p.id === e.id
      ? { ...p, is_hidden: e.hidden, is_cover: e.hidden ? false : p.is_cover }
      : p));
  }
  if (photos.find((p) => p.id === e.id)?.is_hidden) return [...photos];
  return galleryOrder(photos.map((p) => ({ ...p, is_cover: p.id === e.id })));
}
