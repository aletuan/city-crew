// The gallery's rule, decided on the phone.

import { describe, expect, it } from 'vitest';
import { applyEdit, canKeepGallery, galleryActions, galleryOrder, type GalleryPhoto } from './gallery';
import { canAddPhoto } from './guide';

const photo = (over: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  id: 'p', photo_uri: 'x', is_cover: false, is_hidden: false, sort_order: 0, source: 'google', storage_path: null, ...over,
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

  // Held, not offered: the screen draws it as the cover it already is.
  it('keeps the cover slot on the cover', () => {
    expect(galleryActions(photo({ is_cover: true }))).toEqual(['cover', 'hide', 'delete']);
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

  // The cover where it is found without looking (owner, 16 Oct 2026).
  it('leads with the cover, then follows sort_order', () => {
    expect(galleryOrder(three).map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('is sort_order alone when there is no cover', () => {
    const none = three.map((p) => ({ ...p, is_cover: false }));
    expect(galleryOrder(none).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the input alone', () => {
    const before = three.map((p) => p.id);
    galleryOrder(three);
    expect(three.map((p) => p.id)).toEqual(before);
  });
});

// What the grid draws the moment a tap lands, before the server answers
// (owner, 23 Oct 2026) — the server's rules restated, so the guess is
// the answer.
describe('an edit, drawn at once', () => {
  const four = () => [
    photo({ id: 'c', sort_order: 2, is_cover: true }),
    photo({ id: 'a', sort_order: 0 }),
    photo({ id: 'b', sort_order: 1 }),
    photo({ id: 'h', sort_order: 3, is_hidden: true }),
  ];
  const ids = (ps: GalleryPhoto[]) => ps.map((p) => `${p.id}${p.is_cover ? '*' : ''}${p.is_hidden ? '-' : ''}`);

  it('moves the cover, one of it, to the front', () => {
    expect(ids(applyEdit(four(), { kind: 'cover', id: 'b' }))).toEqual(['b*', 'a', 'c', 'h-']);
  });

  // `guide_set_cover` refuses one; the menu never offers it.
  it('draws no cover on a hidden photograph', () => {
    const before = four();
    const out = applyEdit(before, { kind: 'cover', id: 'h' });
    expect(ids(out)).toEqual(ids(before));
    expect(out).not.toBe(before);
  });

  // `guide_set_hidden` takes the cover off what it hides.
  it('hides a photograph, and the cover with it when it was the cover', () => {
    expect(ids(applyEdit(four(), { kind: 'hide', id: 'a', hidden: true }))).toEqual(['c*', 'a-', 'b', 'h-']);
    expect(ids(applyEdit(four(), { kind: 'hide', id: 'c', hidden: true }))).toEqual(['c-', 'a', 'b', 'h-']);
  });

  it('shows one again without making it the cover', () => {
    expect(ids(applyEdit(four(), { kind: 'hide', id: 'h', hidden: false }))).toEqual(['c*', 'a', 'b', 'h']);
  });

  it('takes out every photograph deleted, and nothing else', () => {
    expect(ids(applyEdit(four(), { kind: 'delete', ids: ['a', 'c'] }))).toEqual(['b', 'h-']);
  });

  it('leaves the photographs it was given alone', () => {
    const before = four();
    applyEdit(before, { kind: 'cover', id: 'b' });
    applyEdit(before, { kind: 'hide', id: 'c', hidden: true });
    expect(ids(before)).toEqual(['c*', 'a', 'b', 'h-']);
  });
});
