// The boundary of a guide's gallery, decided on the phone.

import { describe, expect, it } from 'vitest';
import {
  canKeepGallery, canManagePhoto, canUnhide, galleryActions, galleryIds, galleryOrder,
  isOwnPhoto, moveId, type GalleryPhoto,
} from './gallery';
import { canAddPhoto } from './guide';

const ME = { uid: 'u1', granted: true };
const GUEST = { uid: null, granted: false };

const photo = (over: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  id: 'p', photo_uri: 'x', is_cover: false, is_hidden: false, sort_order: 0,
  source: 'google', uploaded_by: null, hidden_by: null, ...over,
});
const mine = (over: Partial<GalleryPhoto> = {}) => photo({ source: 'upload', uploaded_by: 'u1', ...over });
const desk = (over: Partial<GalleryPhoto> = {}) => photo({ source: 'upload', uploaded_by: null, ...over });

describe('who may keep the gallery', () => {
  // The same three conditions that let a person add to it, and no fourth.
  it('is exactly the add-a-photo rule', () => {
    expect(canKeepGallery).toBe(canAddPhoto);
  });
});

describe('the boundary', () => {
  it('counts an upload as theirs only when signed in as the uploader', () => {
    expect(isOwnPhoto(mine(), ME)).toBe(true);
    expect(isOwnPhoto(mine(), { uid: 'u2', granted: true })).toBe(false);
    expect(isOwnPhoto(mine(), GUEST)).toBe(false);
  });

  it('lets them manage their own and the importer’s, never the desk’s', () => {
    expect(canManagePhoto(mine(), ME)).toBe(true);
    expect(canManagePhoto(photo(), ME)).toBe(true);
    expect(canManagePhoto(desk(), ME)).toBe(false);
  });

  // The veto. Hidden by the desk means hidden; hidden by yourself is
  // yours to undo.
  it('lets them unhide only what they hid', () => {
    expect(canUnhide(photo({ is_hidden: true, hidden_by: 'u1' }), ME)).toBe(true);
    expect(canUnhide(photo({ is_hidden: true, hidden_by: 'editor' }), ME)).toBe(false);
    expect(canUnhide(photo({ is_hidden: true, hidden_by: null }), ME)).toBe(false);
    expect(canUnhide(photo({ is_hidden: false, hidden_by: 'u1' }), ME)).toBe(false);
    expect(canUnhide(photo({ is_hidden: true, hidden_by: 'u1' }), GUEST)).toBe(false);
  });
});

describe('what the menu offers', () => {
  it('offers nothing outside the boundary, which is how a tile draws no menu', () => {
    expect(galleryActions(desk(), ME)).toEqual([]);
    expect(galleryActions(mine(), GUEST)).toEqual([]);
  });

  it('offers cover, hide and delete on their own visible upload', () => {
    expect(galleryActions(mine(), ME)).toEqual(['cover', 'hide', 'delete']);
  });

  it('does not offer to set the cover on the cover', () => {
    expect(galleryActions(mine({ is_cover: true }), ME)).toEqual(['hide', 'delete']);
  });

  // An imported photograph is hidden, never deleted: the row carries a
  // `photo_ref` that cannot be fetched again cheaply, and hiding is the
  // same thing to the reader and undoable to the guide.
  it('offers hide but not delete on an imported photograph', () => {
    expect(galleryActions(photo(), ME)).toEqual(['cover', 'hide']);
  });

  it('offers the way back only to the hand that hid it', () => {
    expect(galleryActions(photo({ is_hidden: true, hidden_by: 'u1' }), ME)).toEqual(['unhide']);
    expect(galleryActions(photo({ is_hidden: true, hidden_by: 'editor' }), ME)).toEqual([]);
  });

  // Their own photograph, hidden by the desk: they cannot show it, but
  // taking it down entirely is still theirs — the delete policy asks only
  // whose it is.
  it('still lets them delete their own upload the desk hid', () => {
    expect(galleryActions(mine({ is_hidden: true, hidden_by: 'editor' }), ME)).toEqual(['delete']);
    expect(galleryActions(mine({ is_hidden: true, hidden_by: 'u1' }), ME)).toEqual(['unhide', 'delete']);
  });
});

describe('the order', () => {
  const three = [
    photo({ id: 'b', sort_order: 1 }),
    photo({ id: 'c', sort_order: 2, is_cover: true }),
    photo({ id: 'a', sort_order: 0 }),
  ];

  // `photosOf` leads with the cover; this does not, because "Sắp xếp" has
  // to edit the list it displays.
  it('is sort_order and nothing cleverer, cover included', () => {
    expect(galleryOrder(three).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(galleryIds(three)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the input alone', () => {
    const before = three.map((p) => p.id);
    galleryOrder(three);
    expect(three.map((p) => p.id)).toEqual(before);
  });

  it('moves one id and returns a new array', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(moveId(ids, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(ids, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('hands back a copy for a move that goes nowhere or off the end', () => {
    const ids = ['a', 'b'];
    for (const [from, to] of [[1, 1], [-1, 0], [0, -1], [2, 0], [0, 2]] as const) {
      const out = moveId(ids, from, to);
      expect(out).toEqual(ids);
      expect(out).not.toBe(ids);
    }
  });
});
