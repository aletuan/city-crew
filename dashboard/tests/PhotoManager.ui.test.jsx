// The light-table: every action is staged into `edits`, nothing touches
// the API, and the grid shows the staged truth.
//
// Rendered on its own rather than through the editor, because the
// contract is the point: the component owns no state but the drag, and
// what it hands back through `setEdits` is what PlaceEditor's save will
// replay against the API. `stagedPhotoList` is the fold that turns saved
// rows plus staged edits into what the grid shows, and it is tested here
// as a function first.

import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PhotoManager, { emptyPhotoEdits, photoEditsDirty, stagedPhotoList } from '../src/components/PhotoManager.jsx';
import { resizeImage } from '../src/api.js';

const photo = (id, extra = {}) => ({
  id, photo_uri: `https://x/${id}.jpg`, sort_order: Number(id.slice(1)), is_cover: false, is_hidden: false,
  source: 'google', attribution_name: null, ...extra,
});

const PLACE = {
  name_en: 'Cộng Cà Phê',
  place_photos: [
    photo('p2'),
    photo('p1', { is_cover: true, attribution_name: 'Google user' }),
    photo('p3', { is_hidden: true, source: 'upload' }),
  ],
};

/** The editor's half of the contract: the state, and the last value set. */
function Harness({ place = PLACE, initial = emptyPhotoEdits(), onEdits }) {
  const [edits, setEditsRaw] = useState(initial);
  const setEdits = (fn) => setEditsRaw((e) => {
    const next = typeof fn === 'function' ? fn(e) : fn;
    onEdits?.(next);
    return next;
  });
  return <PhotoManager place={place} edits={edits} setEdits={setEdits} />;
}

const cells = () => [...document.querySelectorAll('.pcell')];
/** The photo ids in grid order, read off each cell's image: `…/p1.jpg`
 *  for a saved photo, `blob:temp-a` for a staged upload. */
const cellIds = () => cells().map((c) => c.querySelector('img').getAttribute('src').replace(/^blob:|^.*\/|\.jpg$/g, ''));
const coverCell = () => document.querySelector('.pcell.cover');

describe('stagedPhotoList', () => {
  it('sorts saved photos, drops the deleted, and applies staged hides', () => {
    const { list, cover } = stagedPhotoList(PLACE, { ...emptyPhotoEdits(), deleted: ['p2'], hidden: { p1: true, p3: false } });
    expect(list.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(list[0].is_hidden).toBe(true);
    expect(list[1].is_hidden).toBe(false);
    // The saved cover is hidden now, so the first visible photo stands in.
    expect(cover.id).toBe('p3');
  });

  it('appends uploads as temporary rows and honours a staged order', () => {
    const uploads = [{ tempId: 'temp-1', previewUrl: 'blob:1' }];
    const { list } = stagedPhotoList(PLACE, { ...emptyPhotoEdits(), uploads, order: ['temp-1', 'p3', 'p1', 'p2'] });
    expect(list.map((p) => p.id)).toEqual(['temp-1', 'p3', 'p1', 'p2']);
    expect(list[0]).toMatchObject({ isTemp: true, source: 'upload', photo_uri: 'blob:1', is_cover: false });
  });

  it('a staged cover wins, else the saved cover, else the first visible, else nothing', () => {
    expect(stagedPhotoList(PLACE, { ...emptyPhotoEdits(), coverId: 'p2' }).cover.id).toBe('p2');
    expect(stagedPhotoList(PLACE, emptyPhotoEdits()).cover.id).toBe('p1');
    expect(stagedPhotoList({ ...PLACE, place_photos: [photo('p2'), photo('p1')] }, emptyPhotoEdits()).cover.id).toBe('p1');
    expect(stagedPhotoList({ ...PLACE, place_photos: [photo('p9', { is_hidden: true })] }, emptyPhotoEdits()).cover).toBeNull();
  });

  it('photoEditsDirty is true for any staged change and false for none', () => {
    expect(photoEditsDirty(emptyPhotoEdits())).toBe(false);
    expect(photoEditsDirty({ ...emptyPhotoEdits(), coverId: 'p1' })).toBe(true);
    expect(photoEditsDirty({ ...emptyPhotoEdits(), hidden: { p1: true } })).toBe(true);
    expect(photoEditsDirty({ ...emptyPhotoEdits(), deleted: ['p1'] })).toBe(true);
    expect(photoEditsDirty({ ...emptyPhotoEdits(), uploads: [{}] })).toBe(true);
    expect(photoEditsDirty({ ...emptyPhotoEdits(), order: [] })).toBe(true);
  });
});

describe('PhotoManager', () => {
  it('shows the cover with its credit, the grid in order, and the badges', () => {
    render(<Harness />);
    const cover = screen.getByAltText('Cover photo of Cộng Cà Phê');
    expect(cover.getAttribute('src')).toBe('https://x/p1.jpg');
    expect(screen.getByText('📷 Google user')).toBeTruthy();
    expect(cellIds()).toEqual(['p1', 'p2', 'p3']);
    expect(screen.getByText('COVER').closest('.pcell')).toBe(cells()[0]);
    expect(screen.getByText('YOURS').closest('.pcell')).toBe(cells()[2]);
    expect(cells()[2].className).toContain('hidden-photo');
    // A hidden photo offers Show; the rest offer Hide.
    expect(screen.getAllByRole('button', { name: 'Hide' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Show' })).toHaveLength(1);
  });

  it('says so when nothing is visible', () => {
    render(<Harness place={{ name_en: 'x', place_photos: [photo('p1', { is_hidden: true })] }} />);
    expect(screen.getByText(/No visible photos/)).toBeTruthy();
  });

  it('a click, or Enter, stages a new cover; a hidden photo cannot be one', () => {
    const seen = [];
    render(<Harness onEdits={(e) => seen.push(e)} />);
    fireEvent.click(cells()[1]);
    expect(seen.at(-1).coverId).toBe('p2');
    expect(coverCell()).toBe(cells()[1]);
    expect(screen.getByAltText('Cover photo of Cộng Cà Phê').getAttribute('src')).toBe('https://x/p2.jpg');
    // Pressing the cover again is a no-op.
    fireEvent.click(cells()[1]);
    expect(seen).toHaveLength(1);
    // The hidden one refuses.
    fireEvent.click(cells()[2]);
    expect(seen).toHaveLength(1);
    fireEvent.keyDown(cells()[0], { key: 'Enter' });
    expect(seen.at(-1).coverId).toBe('p1');
    fireEvent.keyDown(cells()[1], { key: ' ' });
    expect(seen.at(-1).coverId).toBe('p2');
    // Any other key does nothing.
    fireEvent.keyDown(cells()[0], { key: 'a' });
    expect(seen.at(-1).coverId).toBe('p2');
  });

  it('hiding a photo stages it and un-stages it as the cover', () => {
    const seen = [];
    render(<Harness onEdits={(e) => seen.push(e)} />);
    fireEvent.click(cells()[1]); // p2 becomes the staged cover
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[1]); // hide p2
    expect(seen.at(-1)).toMatchObject({ hidden: { p2: true }, coverId: null });
    expect(cells()[1].className).toContain('hidden-photo');
    // Back to the saved cover.
    expect(coverCell()).toBe(cells()[0]);
    // Show puts it back, as a toggle of the staged value.
    fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0]);
    expect(seen.at(-1).hidden).toEqual({ p2: false });
  });

  it('deleting a saved photo stages the id; deleting an upload drops it and frees its URL', async () => {
    const seen = [];
    render(<Harness initial={{ ...emptyPhotoEdits(), uploads: [{ tempId: 'temp-a', previewUrl: 'blob:temp-a', blob: {}, name: 'a' }], coverId: 'temp-a', order: ['temp-a', 'p1', 'p2', 'p3'] }} onEdits={(e) => seen.push(e)} />);
    expect(cellIds()[0]).toBe('temp-a');
    expect(screen.getByText('NEW')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Del' })[0]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:temp-a');
    expect(seen.at(-1)).toMatchObject({ uploads: [], deleted: [], coverId: null, order: ['p1', 'p2', 'p3'] });
    expect(screen.queryByText('NEW')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Del' })[1]);
    expect(seen.at(-1)).toMatchObject({ deleted: ['p2'], order: ['p1', 'p3'] });
    expect(cellIds()).toEqual(['p1', 'p3']);
  });

  it('drag and drop stages a new order', () => {
    const seen = [];
    render(<Harness onEdits={(e) => seen.push(e)} />);
    fireEvent.dragStart(cells()[2]);
    fireEvent.dragOver(cells()[0]);
    expect(cells()[0].className).toContain('dragover');
    fireEvent.dragLeave(cells()[0]);
    expect(cells()[0].className).not.toContain('dragover');
    fireEvent.dragOver(cells()[0]);
    fireEvent.drop(cells()[0]);
    expect(seen.at(-1).order).toEqual(['p3', 'p1', 'p2']);
    expect(cellIds()).toEqual(['p3', 'p1', 'p2']);
    // Dropping a photo on itself changes nothing.
    fireEvent.dragStart(cells()[0]);
    fireEvent.drop(cells()[0]);
    expect(seen).toHaveLength(1);
  });

  it('stages chosen images through the resizer, and ignores anything else', async () => {
    const seen = [];
    render(<Harness onEdits={(e) => seen.push(e)} />);
    const input = document.querySelector('input[type=file]');
    const png = new File(['x'], 'front door.png', { type: 'image/png' });
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [png, txt] } });
    expect(await screen.findByText('Reading…')).toBeTruthy();
    await screen.findByText('NEW');
    expect(resizeImage).toHaveBeenCalledTimes(1);
    expect(resizeImage).toHaveBeenCalledWith(png);
    const upload = seen.at(-1).uploads[0];
    expect(upload.name).toBe('front door');
    expect(upload.tempId).toMatch(/^temp-/);
    expect(upload.previewUrl).toMatch(/^blob:/);
    expect(screen.getByText('Add photo')).toBeTruthy();
    // Only text: nothing happens at all.
    fireEvent.change(input, { target: { files: [txt] } });
    expect(resizeImage).toHaveBeenCalledTimes(1);
  });

  it('the drop zone takes files too, and the button opens the picker', async () => {
    render(<Harness />);
    const zone = screen.getByRole('button', { name: 'Upload photos' });
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('dragover');
    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('dragover');
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText('NEW');
    const input = document.querySelector('input[type=file]');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(zone);
    expect(click).toHaveBeenCalled();
  });

  it('a file that cannot be read stages nothing', async () => {
    resizeImage.mockRejectedValue(new Error('not an image'));
    const seen = [];
    render(<Harness onEdits={(e) => seen.push(e)} />);
    fireEvent.change(document.querySelector('input[type=file]'), {
      target: { files: [new File(['x'], 'bad.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getByText('Add photo')).toBeTruthy());
    expect(seen).toHaveLength(0);
    expect(screen.queryByText('NEW')).toBeNull();
  });
});
