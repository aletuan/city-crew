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

/** A photograph as the gallery reads it. `source` is printed, never
 *  decided on. */
export type GalleryPhoto = {
  id: string;
  photo_uri: string;
  is_cover: boolean;
  is_hidden: boolean;
  sort_order: number;
  source: string;
};

/** Who may open the gallery at all: the same three conditions that let a
 *  person add to it. There is no fourth. */
export const canKeepGallery = canAddPhoto;

export type GalleryAction = 'cover' | 'hide' | 'unhide' | 'delete';

/**
 * What the ⋯ menu on a tile offers, in the order it offers it.
 *
 * Never empty: every photograph on the place is the keeper's to change.
 * A hidden one offers its way back; a visible one offers the cover
 * (unless it already is) and the way out. Delete is last on both.
 */
export function galleryActions(photo: GalleryPhoto): GalleryAction[] {
  const out: GalleryAction[] = [];
  if (photo.is_hidden) {
    out.push('unhide');
  } else {
    if (!photo.is_cover) out.push('cover');
    out.push('hide');
  }
  out.push('delete');
  return out;
}

/**
 * The gallery's order, which is `sort_order` and nothing cleverer.
 *
 * Not cover-first, though `photosOf` is. That function chooses what the
 * carousel *shows*; this one shows what the guide is looking at, and
 * the cover wears a badge wherever it sits.
 */
export function galleryOrder(photos: readonly GalleryPhoto[]): GalleryPhoto[] {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order);
}
