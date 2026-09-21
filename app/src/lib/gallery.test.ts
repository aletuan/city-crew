// The gallery's rule, decided on the phone.

import { describe, expect, it } from 'vitest';
import { canKeepGallery, galleryActions, galleryOrder, type GalleryPhoto } from './gallery';
import { canAddPhoto } from './guide';

const photo = (over: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  id: 'p', photo_uri: 'x', is_cover: false, is_hidden: false, sort_order: 0, source: 'google', ...over,
});

describe('who may keep the gallery', () => {
  // The same three conditions that let a person add to it, and no fourth.
  it('is exactly the add-a-photo rule', () => {
    expect(canKeepGallery).toBe(canAddPhoto);
  });
});

describe('what the menu offers', () => {
  // No boundary between kinds: the desk's upload and Google's row get the
  // same menu as the keeper's own.
  it('offers cover, hide and delete on any visible photograph', () => {
    for (const source of ['google', 'upload']) {
      expect(galleryActions(photo({ source }))).toEqual(['cover', 'hide', 'delete']);
    }
  });

  it('does not offer to set the cover on the cover', () => {
    expect(galleryActions(photo({ is_cover: true }))).toEqual(['hide', 'delete']);
  });

  // No veto: hidden by anybody, the way back is offered.
  it('offers the way back and delete on a hidden photograph', () => {
    expect(galleryActions(photo({ is_hidden: true }))).toEqual(['unhide', 'delete']);
  });
});

describe('the order', () => {
  const three = [
    photo({ id: 'b', sort_order: 1 }),
    photo({ id: 'c', sort_order: 2, is_cover: true }),
    photo({ id: 'a', sort_order: 0 }),
  ];

  // `photosOf` leads with the cover; this does not.
  it('is sort_order and nothing cleverer, cover included', () => {
    expect(galleryOrder(three).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the input alone', () => {
    const before = three.map((p) => p.id);
    galleryOrder(three);
    expect(three.map((p) => p.id)).toEqual(before);
  });
});
