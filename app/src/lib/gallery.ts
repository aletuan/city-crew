// The gallery a local guide keeps, decided without asking the server.
//
// ── the rule, in one place twice ──
//
// Postgres enforces this — `20260921120000_gallery_guide_rpcs.sql`, whose
// three functions refuse anything outside the boundary — and this module
// states the same boundary in the app, so a control that would be refused
// is never drawn. The reasoning is `lib/guide`'s: a button that exists and
// then fails is worse than one that was never offered.
//
// The boundary:
//
//     their own uploads     manage
//     the importer's rows   manage — Google's photographs are nobody's
//     the desk's uploads    look, do not touch
//
// and the desk's one veto: a photograph the desk hid is not the guide's
// to show again. `hidden_by` is who hid it, stamped by the database.
//
// ── what "delete" means here ──
//
// Only an upload of one's own is ever deleted. An imported photograph is
// hidden instead: the row carries a `photo_ref` that cannot be fetched
// again cheaply, and hiding is the same thing to the reader and undoable
// to the guide. So `galleryActions` never offers `delete` on a Google
// row — it offers `hide`, which is the honest word for what would happen.
//
// Plain TypeScript, tested from `gallery.test.ts`.

import { canAddPhoto, type Guide } from './guide';

/** A photograph as the gallery reads it — the catalog's shape plus the
 *  three columns the boundary is decided on. */
export type GalleryPhoto = {
  id: string;
  photo_uri: string;
  is_cover: boolean;
  is_hidden: boolean;
  sort_order: number;
  source: string;
  uploaded_by: string | null;
  hidden_by: string | null;
};

/** Who may open the gallery at all: the same three conditions that let a
 *  person add to it. There is no fourth. */
export const canKeepGallery = canAddPhoto;

/** Their own upload, as opposed to the importer's or the desk's. */
export function isOwnPhoto(photo: GalleryPhoto, me: Guide): boolean {
  return !!me.uid && photo.uploaded_by === me.uid;
}

/** May this person change this photograph — cover, hidden, order? */
export function canManagePhoto(photo: GalleryPhoto, me: Guide): boolean {
  return isOwnPhoto(photo, me) || photo.source === 'google';
}

/** May this person show a hidden photograph again? Only one they hid. */
export function canUnhide(photo: GalleryPhoto, me: Guide): boolean {
  return photo.is_hidden && !!me.uid && photo.hidden_by === me.uid;
}

export type GalleryAction = 'cover' | 'hide' | 'unhide' | 'delete';

/**
 * What the ⋯ menu on a tile offers, in the order it offers it.
 *
 * Empty for a photograph outside the boundary, which is how the tile
 * knows to draw no menu. A hidden photograph offers its way back only to
 * the hand that hid it; the desk's hide offers nothing, and that nothing
 * is the veto made visible.
 */
export function galleryActions(photo: GalleryPhoto, me: Guide): GalleryAction[] {
  if (!canManagePhoto(photo, me)) return [];
  const out: GalleryAction[] = [];
  if (photo.is_hidden) {
    if (canUnhide(photo, me)) out.push('unhide');
  } else {
    if (!photo.is_cover) out.push('cover');
    out.push('hide');
  }
  if (isOwnPhoto(photo, me)) out.push('delete');
  return out;
}

/**
 * The gallery's order, which is `sort_order` and nothing cleverer.
 *
 * Not cover-first, deliberately, though `photosOf` is. That function
 * chooses what the carousel *shows*; this one shows what the guide is
 * *editing*, and "Sắp xếp" has to edit the same list it displays. The
 * cover wears a badge wherever it sits, and the carousel will still lead
 * with it.
 */
export function galleryOrder(photos: readonly GalleryPhoto[]): GalleryPhoto[] {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order);
}

/** Every id, in gallery order — the whole list `guide_reorder_photos`
 *  insists on. */
export function galleryIds(photos: readonly GalleryPhoto[]): string[] {
  return galleryOrder(photos).map((p) => p.id);
}

/**
 * One tile moved. A new array, the old one untouched; a move that goes
 * nowhere or off the end hands back a copy rather than a surprise.
 */
export function moveId(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
