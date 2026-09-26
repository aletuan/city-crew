// The editor: one place, end to end.
//
// Pinned here: what Save sends (the form, plus the stamp when Approve or
// Flag pressed it), the order the staged photo edits are replayed in —
// uploads first so a new cover has a real id by the time it is named —
// the keys, the walk through the siblings with its "discard?" question,
// and the two fields that rewrite what was pasted into them.

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { loadGoogleMaps } from '../src/lib/googleMaps.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

vi.mock('../src/lib/googleMaps.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGoogleMaps: vi.fn(async () => null),
}));

const photo = (id, extra = {}) => ({
  id, place_id: 'id-a', photo_uri: `https://x/${id}.jpg`, sort_order: Number(id.slice(1)), is_cover: false,
  is_hidden: false, source: 'google', attribution_name: null, storage_path: null, ...extra,
});

const PLACE = {
  id: 'id-a', slug: 'cafe-a', name_en: 'Café A', name_vi: 'Quán A', desc_en: 'A blurb', desc_vi: null,
  neighborhood_en: 'District 1', neighborhood_vi: 'Quận 1', address: '12 Lê Lợi', category: 'food',
  categories: ['cafes'], is_featured: false, vibe_tags: ['quiet'], emoji: '☕', price_display: '50k', price_vnd: 50000,
  duration_min: 45, duration_max: null, website: 'https://cafe-a.example', phone: null, threads_handle: null,
  is_published: false, review_note: null, reviewer_source: null, reviewer_name: null, reviewer_url: null,
  review_status: 'pending', lat: 10.7731, lng: 106.7012, rating: 4.4, rating_count: 812,
  google_place_id: 'gp-a', opening_hours: ['Mon 7–22', 'Tue 7–22'],
  place_photos: [photo('p1', { is_cover: true }), photo('p2')],
};
const SIBLINGS = [{ slug: 'bar-z' }, { slug: 'cafe-a' }, { slug: 'park-c' }];

const field = (id) => document.getElementById(id);
const saveButton = () => screen.getByRole('button', { name: /^Save/ });
const stampOf = (slug) => ({ ...PLACE, slug, name_en: slug, lat: PLACE.lat + 0.01, place_photos: [] });

function openEditor(route = '/place/cafe-a', place = PLACE) {
  api.place.mockImplementation(async (slug) => (slug === place.slug ? place : stampOf(slug)));
  api.places.mockResolvedValue(SIBLINGS);
  api.saveCount.mockResolvedValue(2);
  return renderDesk(route);
}

describe('PlaceEditor', () => {
  it('loads the place into the form, with what is read-only beside it', async () => {
    const { router } = openEditor('/place/cafe-a?status=pending&q=caf');
    expect(screen.getByText('Loading cafe-a…')).toBeTruthy();
    await screen.findByDisplayValue('Café A');
    expect(api.place).toHaveBeenCalledWith('cafe-a');
    // Siblings: the list's filters, without the search box, every row.
    await waitFor(() => expect(api.places).toHaveBeenCalledWith({ status: 'pending', city: 'hcmc', all: true }));
    expect(field('name_vi').value).toBe('Quán A');
    expect(field('desc_en').tagName).toBe('TEXTAREA');
    expect(field('price_vnd').value).toBe('50000');
    expect(field('duration_max').value).toBe('');
    expect(screen.getByRole('link', { name: '← All places' }).getAttribute('href')).toBe('/?status=pending&q=caf');
    expect(screen.getByText('cafe-a', { selector: '.slug' })).toBeTruthy();
    expect(within(document.querySelector('.crumbs')).getByText('pending').className).toContain('stamp');
    expect(screen.getByText('Opening hours (from Google)')).toBeTruthy();
    expect(document.querySelector('.hoursline').textContent).toBe('Mon 7–22\nTue 7–22');
    expect(await screen.findByText(/10\.773100, 106\.701200 · ★ 4\.4 \(812 reviews\) · in 2 lists/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open in Google Maps ↗' }).getAttribute('href')).toBe('https://www.google.com/maps/place/?q=place_id:gp-a');
    expect(screen.getByRole('link', { name: 'Website ↗' }).getAttribute('href')).toBe('https://cafe-a.example');
    expect(screen.getByRole('button', { name: /^Approve/ }).className).not.toContain('on');
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(url(router)).toBe('/place/cafe-a?status=pending&q=caf');
  });

  it('the save count is counted beside the row: one, none, or nothing to say', async () => {
    const { unmount } = openEditor();
    api.saveCount.mockResolvedValueOnce(1);
    expect(await screen.findByText(/in 1 list$/)).toBeTruthy();
    unmount();
    let finish;
    openEditor();
    api.saveCount.mockReturnValueOnce(new Promise((_, reject) => { finish = reject; }));
    expect(await screen.findByText(/counting saves…/)).toBeTruthy();
    await act(async () => finish(new Error('slow')));
    expect(await screen.findByText(/saves —/)).toBeTruthy();
  });

  it('an edit lights Save; Save sends the form and refreshes in place', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    fireEvent.change(field('name_en'), { target: { value: 'Café A+' } });
    fireEvent.change(field('price_vnd'), { target: { value: '' } });
    fireEvent.change(field('duration_max'), { target: { value: '90' } });
    fireEvent.click(screen.getByLabelText('Published'));
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().className).toContain('dirty');
    api.place.mockResolvedValue({ ...PLACE, name_en: 'Café A+', price_vnd: null, duration_max: 90, is_published: true });
    fireEvent.click(saveButton());
    expect((await findToast()).textContent).toBe('Saved');
    expect(api.savePlace).toHaveBeenCalledWith('cafe-a', expect.objectContaining({
      name_en: 'Café A+', price_vnd: null, duration_max: 90, is_published: true, categories: ['cafes'],
    }));
    expect(api.savePlace.mock.calls[0][1]).not.toHaveProperty('review_status');
    expect(api.savePlace.mock.calls[0][1]).not.toHaveProperty('lat');
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    // Still the editor — no loading screen flashed.
    expect(screen.queryByText(/^Loading/)).toBeNull();
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
  });

  it('every plain field writes its own key, and the numbers are numbers', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    const type = (id, value) => fireEvent.change(field(id), { target: { value } });
    type('name_vi', 'Quán A mới');
    type('desc_en', 'A longer blurb');
    type('desc_vi', 'Một đoạn');
    type('neighborhood_en', 'District 3');
    type('neighborhood_vi', 'Quận 3');
    type('address', '1 Võ Văn Tần');
    type('emoji', '🍵');
    type('website', 'https://new.example');
    type('phone', '+84 28 0000');
    type('price_display', '80k');
    type('price_vnd', '80000');
    type('duration_min', '');
    fireEvent.click(saveButton());
    await findToast();
    expect(api.savePlace).toHaveBeenCalledWith('cafe-a', expect.objectContaining({
      name_vi: 'Quán A mới', desc_en: 'A longer blurb', desc_vi: 'Một đoạn', neighborhood_en: 'District 3',
      neighborhood_vi: 'Quận 3', address: '1 Võ Văn Tần', emoji: '🍵', website: 'https://new.example',
      phone: '+84 28 0000', price_display: '80k', price_vnd: 80000, duration_min: null,
    }));
  });

  it('Approve and Flag save with the stamp, and the stamp wears the button', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    api.place.mockResolvedValue({ ...PLACE, review_status: 'approved' });
    fireEvent.click(screen.getByRole('button', { name: /^Approve/ }));
    expect((await findToast()).textContent).toBe('Marked approved');
    expect(api.savePlace).toHaveBeenLastCalledWith('cafe-a', expect.objectContaining({ review_status: 'approved' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Approve/ }).className).toContain('on'));
    api.place.mockResolvedValue({ ...PLACE, review_status: 'flagged', review_note: 'blurry' });
    fireEvent.change(screen.getByPlaceholderText('Review note…'), { target: { value: 'blurry' } });
    fireEvent.click(screen.getByRole('button', { name: /^Flag/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Marked flagged'));
    expect(api.savePlace).toHaveBeenLastCalledWith('cafe-a', expect.objectContaining({ review_status: 'flagged', review_note: 'blurry' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Flag/ }).className).toContain('on'));
  });

  it('a save that fails says why and keeps the edit', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    api.savePlace.mockRejectedValue(new Error('not an editor'));
    fireEvent.change(field('name_en'), { target: { value: 'x' } });
    fireEvent.click(saveButton());
    expect((await findToast()).textContent).toBe('Save failed: not an editor');
    expect(field('name_en').value).toBe('x');
    expect(saveButton().disabled).toBe(false);
  });

  it('the keys: a, f and s from the page, Cmd+S from a field, arrows to walk', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    fireEvent.keyDown(document.body, { key: 'a' });
    await waitFor(() => expect(api.savePlace).toHaveBeenLastCalledWith('cafe-a', expect.objectContaining({ review_status: 'approved' })));
    fireEvent.keyDown(document.body, { key: 'f' });
    await waitFor(() => expect(api.savePlace).toHaveBeenLastCalledWith('cafe-a', expect.objectContaining({ review_status: 'flagged' })));
    await waitFor(() => expect(api.savePlace).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(document.body, { key: 's' });
    await waitFor(() => expect(api.savePlace).toHaveBeenCalledTimes(3));
    expect(api.savePlace.mock.calls[2][1]).not.toHaveProperty('review_status');
    // Typing a letter into a field is typing, not a command…
    fireEvent.keyDown(field('name_en'), { key: 'a' });
    fireEvent.keyDown(field('name_en'), { key: 's' });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.savePlace).toHaveBeenCalledTimes(3);
    // …except the one every editor's fingers know.
    const cmdS = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true });
    field('name_en').dispatchEvent(cmdS);
    expect(cmdS.defaultPrevented).toBe(true);
    await waitFor(() => expect(api.savePlace).toHaveBeenCalledTimes(4));
    fireEvent.keyDown(field('name_en'), { key: 'x', ctrlKey: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.savePlace).toHaveBeenCalledTimes(4);
  });

  it('walks the siblings under the list\'s filters, and asks before losing an edit', async () => {
    const { router } = openEditor('/place/cafe-a?status=pending');
    await screen.findByDisplayValue('Café A');
    expect(screen.getByRole('button', { name: 'Previous place' }).disabled).toBe(false);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await waitFor(() => expect(url(router)).toBe('/place/park-c?status=pending'));
    await screen.findByDisplayValue('park-c');
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next place' }).disabled).toBe(true);
    // Off the end is nowhere.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(url(router)).toBe('/place/park-c?status=pending');
    fireEvent.click(screen.getByRole('button', { name: 'Previous place' }));
    await screen.findByDisplayValue('Café A');
    fireEvent.change(field('name_en'), { target: { value: 'edited' } });
    window.confirm.mockReturnValueOnce(false);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(window.confirm).toHaveBeenCalledWith('Discard unsaved changes (text and photo edits)?');
    expect(url(router)).toBe('/place/cafe-a?status=pending');
    expect(field('name_en').value).toBe('edited');
    // Stage an upload too, so discarding has a URL to give back.
    fireEvent.change(document.querySelector('input[type=file]'), {
      target: { files: [new File(['x'], 'new.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByText('NEW');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    await waitFor(() => expect(url(router)).toBe('/place/bar-z?status=pending'));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    await screen.findByDisplayValue('bar-z');
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous place' }).disabled).toBe(true);
  });

  it('with no siblings to be had, the walk is simply off', async () => {
    api.places.mockRejectedValue(new Error('rls'));
    openEditor();
    api.places.mockRejectedValue(new Error('rls'));
    await screen.findByDisplayValue('Café A');
    await waitFor(() => expect(screen.getByText('0 / 0')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Previous place' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Next place' }).disabled).toBe(true);
  });

  it('the tab asks before closing on an unsaved edit', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(field('emoji'), { target: { value: '🍵' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('categories and vibes toggle, and a place with no category is told what that costs', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    const chip = (name) => screen.getByRole('button', { name });
    expect(chip('cafés').className).toContain('on');
    expect(screen.queryByText(/No category yet/)).toBeNull();
    fireEvent.click(chip('cafés'));
    expect(chip('cafés').className).not.toContain('on');
    expect(screen.getByText(/No category yet/)).toBeTruthy();
    fireEvent.click(chip('fun'));
    fireEvent.click(chip('cafés'));
    expect(chip('quiet').className).toContain('on');
    fireEvent.click(chip('quiet'));
    fireEvent.click(chip('romantic'));
    fireEvent.click(screen.getByLabelText(/Featured/));
    fireEvent.click(saveButton());
    await findToast();
    expect(api.savePlace).toHaveBeenCalledWith('cafe-a', expect.objectContaining({
      categories: ['fun', 'cafes'], vibe_tags: ['romantic'], is_featured: true,
    }));
  });

  it('the Threads field takes a pasted URL and keeps the handle bare', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    expect(screen.getByText('Nothing to check yet.')).toBeTruthy();
    expect(screen.getByText(/Leave empty if the venue has no Threads account/)).toBeTruthy();
    fireEvent.change(field('threads_handle'), { target: { value: 'https://www.threads.net/@Cafe.A?x=1' } });
    // Before blur the box keeps what is being typed; the link is already right.
    expect(field('threads_handle').value).toBe('https://www.threads.net/@Cafe.A?x=1');
    expect(screen.getByRole('link', { name: 'Open profile ↗' }).getAttribute('href')).toBe('https://www.threads.com/@cafe.a');
    fireEvent.blur(field('threads_handle'));
    expect(field('threads_handle').value).toBe('cafe.a');
    fireEvent.change(field('threads_handle'), { target: { value: 'bad handle!' } });
    expect(screen.getByText('Only lowercase letters, digits, dots and underscores.').className).toContain('warn');
    fireEvent.change(field('threads_handle'), { target: { value: '' } });
    fireEvent.blur(field('threads_handle'));
    // Empty is the same as it was, so nothing is dirty; the key saves anyway.
    expect(saveButton().disabled).toBe(true);
    fireEvent.keyDown(document.body, { key: 's' });
    await findToast();
    expect(api.savePlace).toHaveBeenCalledWith('cafe-a', expect.objectContaining({ threads_handle: null }));
  });

  it('the blurb source fills itself from a pasted permalink, and complains when the three disagree', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    expect(screen.getByText('Nothing to credit yet.')).toBeTruthy();
    fireEvent.change(field('reviewer_url'), { target: { value: 'https://www.threads.net/@Foodie.Vn/post/AbC123?x' } });
    fireEvent.blur(field('reviewer_url'));
    expect(field('reviewer_source').value).toBe('threads');
    expect(field('reviewer_name').value).toBe('foodie.vn');
    expect(field('reviewer_url').value).toBe('https://www.threads.com/@foodie.vn/post/AbC123');
    expect(screen.getByRole('link', { name: '@foodie.vn on Threads ↗' }).getAttribute('href')).toBe('https://www.threads.com/@foodie.vn/post/AbC123');
    expect(screen.getByText(/Leave empty when nobody recorded/)).toBeTruthy();
    // A link that is not a permalink is kept, trimmed, and the panel says so.
    fireEvent.change(field('reviewer_url'), { target: { value: '  https://example.com/x  ' } });
    fireEvent.blur(field('reviewer_url'));
    expect(field('reviewer_url').value).toBe('https://example.com/x');
    expect(screen.getByText(/Not a Threads post permalink/).className).toContain('warn');
    fireEvent.change(field('reviewer_url'), { target: { value: '   ' } });
    fireEvent.blur(field('reviewer_url'));
    expect(field('reviewer_url').value).toBe('');
    // The credit is normalised on blur too.
    fireEvent.change(field('reviewer_name'), { target: { value: '@Foodie.VN' } });
    fireEvent.blur(field('reviewer_name'));
    expect(field('reviewer_name').value).toBe('foodie.vn');
    // Google names no author; the desk credits nobody.
    fireEvent.change(field('reviewer_source'), { target: { value: 'google' } });
    expect(field('reviewer_name').disabled).toBe(true);
    expect(field('reviewer_name').getAttribute('placeholder')).toBe('Google names no author');
    expect(screen.getByText(/Google does not name the author/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Google ↗' }).getAttribute('href')).toContain('place_id:gp-a');
    fireEvent.change(field('reviewer_source'), { target: { value: 'editorial' } });
    expect(field('reviewer_name').getAttribute('placeholder')).toBe('the desk credits nobody');
    // Cleared source with a name left: pick one or clear it.
    fireEvent.change(field('reviewer_source'), { target: { value: '' } });
    expect(screen.getByText('Pick a source, or clear the name and link.')).toBeTruthy();
    // A credit with nowhere to go reads as plain text.
    fireEvent.change(field('reviewer_source'), { target: { value: 'threads' } });
    fireEvent.change(field('reviewer_name'), { target: { value: '' } });
    fireEvent.blur(field('reviewer_name'));
    expect(screen.getByText('Threads — no link to open.')).toBeTruthy();
    expect(screen.getByText('A Threads blurb needs the handle of whoever wrote it.')).toBeTruthy();
  });

  it('Save replays the staged photo edits in order, with a new cover named by its real id', async () => {
    api.uploadPhoto.mockResolvedValue({ id: 'real9' });
    api.deletePhoto.mockResolvedValue({ ok: true, left: ['cafe-a/p2.jpg'] });
    openEditor();
    await screen.findByDisplayValue('Café A');
    // Stage: hide p2 then delete it (a hide on a deleted photo is skipped),
    // upload one, make the upload the cover, hide p1, drag the upload to
    // the front.
    const cells = () => [...document.querySelectorAll('.pcell')];
    fireEvent.click(within(cells()[1]).getByRole('button', { name: 'Hide' }));
    fireEvent.click(within(cells()[1]).getByRole('button', { name: 'Del' }));
    const file = new File(['x'], 'front door.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [file] } });
    await screen.findByText('NEW');
    fireEvent.click(cells()[1]);
    expect(within(cells()[1]).getByText('COVER')).toBeTruthy();
    fireEvent.click(within(cells()[0]).getByRole('button', { name: 'Hide' }));
    expect(within(cells()[1]).getByText('COVER')).toBeTruthy();
    fireEvent.dragStart(cells()[1]);
    fireEvent.drop(cells()[0]);
    expect(saveButton().disabled).toBe(false);
    api.place.mockResolvedValue({ ...PLACE, place_photos: [photo('real9', { is_cover: true, source: 'upload' })] });
    fireEvent.click(saveButton());
    expect((await findToast()).textContent).toBe('Saved — 1 photo file could not be removed from Storage and is now orphaned');
    expect(api.uploadPhoto).toHaveBeenCalledWith('cafe-a', expect.any(Blob), 'front door');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(api.deletePhoto).toHaveBeenCalledWith('p2');
    expect(api.patchPhoto).toHaveBeenCalledTimes(2);
    expect(api.patchPhoto).toHaveBeenCalledWith('p1', { is_hidden: true });
    expect(api.patchPhoto).toHaveBeenCalledWith('real9', { is_cover: true });
    expect(api.reorderPhotos).toHaveBeenCalledWith('cafe-a', ['real9', 'p1']);
    const order = [api.savePlace, api.uploadPhoto, api.deletePhoto, api.patchPhoto, api.reorderPhotos]
      .map((fn) => fn.mock.invocationCallOrder[0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The baseline is the fresh row: one photo, nothing staged, nothing dirty.
    await waitFor(() => expect(cells()).toHaveLength(1));
    expect(screen.queryByText('NEW')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('a photo hidden and shown again is not written', async () => {
    openEditor();
    await screen.findByDisplayValue('Café A');
    const cell = document.querySelectorAll('.pcell')[1];
    fireEvent.click(within(cell).getByRole('button', { name: 'Hide' }));
    fireEvent.click(within(cell).getByRole('button', { name: 'Show' }));
    fireEvent.click(saveButton());
    await findToast();
    expect(api.patchPhoto).not.toHaveBeenCalled();
    expect(api.reorderPhotos).not.toHaveBeenCalled();
  });

  it('deleting the place asks, reports, and returns to the list it came from', async () => {
    api.deletePlace.mockResolvedValue({ ok: true, removed_uploads: 2, left: [] });
    const { router } = openEditor('/place/cafe-a?status=pending');
    await screen.findByDisplayValue('Café A');
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete place' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete “Café A” permanently?'));
    expect(api.deletePlace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete place' }));
    expect((await findToast()).textContent).toBe('Deleted Café A');
    expect(api.deletePlace).toHaveBeenCalledWith('cafe-a');
    await waitFor(() => expect(url(router)).toBe('/?status=pending'));
    expect(await screen.findByRole('heading', { name: 'Places' })).toBeTruthy();
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
  });

  it('a delete that fails says why and stays', async () => {
    api.deletePlace.mockRejectedValue(new Error('rls'));
    const { router } = openEditor();
    await screen.findByDisplayValue('Café A');
    fireEvent.click(screen.getByRole('button', { name: 'Delete place' }));
    expect((await findToast()).textContent).toBe('Delete failed: rls');
    expect(url(router)).toBe('/place/cafe-a');
  });

  it('a place that cannot be read says so and stays on the loading line', async () => {
    api.place.mockRejectedValue(new Error('not found'));
    renderDesk('/place/ghost');
    expect((await findToast()).textContent).toBe('not found');
    expect(screen.getByText('Loading ghost…')).toBeTruthy();
  });

  it('the fact-check map: no coordinates, no key, and a map with a marker that follows the row', async () => {
    const { unmount } = openEditor('/place/cafe-a', { ...PLACE, lat: null, lng: null });
    await screen.findByDisplayValue('Café A');
    expect(screen.getByText('No coordinates on this place yet.')).toBeTruthy();
    unmount();
    openEditor();
    await screen.findByDisplayValue('Café A');
    expect(await screen.findByText('Map unavailable — set VITE_GOOGLE_MAPS_KEY.')).toBeTruthy();
  });

  it('with a key, the map is built once and the marker moves with the row', async () => {
    const instances = [];
    const markers = [];
    const maps = {
      Map: vi.fn(function Map(el, opts) { this.opts = opts; this.setCenter = vi.fn(); instances.push(this); }),
      Marker: vi.fn(function Marker(opts) { this.opts = opts; this.setPosition = vi.fn(); this.setTitle = vi.fn(); markers.push(this); }),
      SymbolPath: { CIRCLE: 'circle' },
    };
    loadGoogleMaps.mockResolvedValue(maps);
    openEditor();
    await screen.findByDisplayValue('Café A');
    await waitFor(() => expect(maps.Map).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.mapframe')).toBeTruthy();
    expect(instances[0].opts).toMatchObject({ center: { lat: PLACE.lat, lng: PLACE.lng }, zoom: 16, colorScheme: 'DARK' });
    expect(markers[0].opts.icon.path).toBe('circle');
    expect(markers[0].setPosition).toHaveBeenCalledWith({ lat: PLACE.lat, lng: PLACE.lng });
    expect(markers[0].setTitle).toHaveBeenCalledWith('Café A');
    // A save that moved the pin re-centres the same map.
    api.place.mockResolvedValue({ ...PLACE, lat: 10.78, name_en: 'Café A moved' });
    fireEvent.keyDown(document.body, { key: 's' });
    await findToast();
    await waitFor(() => expect(instances[0].setCenter).toHaveBeenCalledWith({ lat: 10.78, lng: PLACE.lng }));
    expect(markers[0].setTitle).toHaveBeenLastCalledWith('Café A moved');
    expect(maps.Map).toHaveBeenCalledTimes(1);
  });
});

const url = (router) => router.state.location.pathname + router.state.location.search;
