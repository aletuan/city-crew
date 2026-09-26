// Add a place: search Google by name, import the match.
//
// What is pinned here is the row's three states — new, importing, already
// in the catalog — and that an import stays on this page. Importing a
// batch of search results one after another is the whole reason the
// screen does not jump to the editor, and a regression there would make
// the desk re-search after every one.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const CANDIDATES = [
  { place_id: 'g1', name: 'The Workshop Coffee', address: '27 Ngô Đức Kế', rating: 4.6, rating_count: 2100 },
  { place_id: 'g2', name: 'Workshop Annex', address: 'District 3', rating: null },
];

const search = async (q = 'workshop') => {
  fireEvent.change(await screen.findByLabelText('Place name'), { target: { value: q } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
};

describe('AddPlace', () => {
  it('asks for a city first when the desk is on all cities', async () => {
    renderDesk('/add', { city: 'all' });
    expect(await screen.findByText('One city at a time')).toBeTruthy();
    // Choosing one opens the screen, in that city.
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'hanoi' } });
    expect(await screen.findByText(/Search Google Places for a spot in Hanoi/)).toBeTruthy();
  });

  it('will not search an empty box', async () => {
    renderDesk('/add');
    const button = await screen.findByRole('button', { name: 'Search' });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: '   ' } });
    expect(button.disabled).toBe(true);
    expect(api.searchPlaces).not.toHaveBeenCalled();
  });

  it('searches in the workspace city and says when nothing matched', async () => {
    renderDesk('/add', { city: 'hanoi' });
    await search('nowhere');
    expect(await screen.findByText(/No matches/)).toBeTruthy();
    expect(api.searchPlaces).toHaveBeenCalledWith('nowhere', 'hanoi');
    expect(api.existingByPlaceIds).not.toHaveBeenCalled();
  });

  it('lists the candidates with their rating, and checks which already exist', async () => {
    api.searchPlaces.mockResolvedValue({ candidates: CANDIDATES });
    api.existingByPlaceIds.mockResolvedValue({ g2: { slug: 'workshop-annex', review_status: 'approved' } });
    renderDesk('/add');
    await search();
    expect(await screen.findByText('The Workshop Coffee')).toBeTruthy();
    expect(screen.getByText('27 Ngô Đức Kế · 4.6★ (2100)')).toBeTruthy();
    expect(screen.getByText('District 3')).toBeTruthy();
    expect(api.existingByPlaceIds).toHaveBeenCalledWith(['g1', 'g2']);
    // The known one gets a stamp and a door to the editor, not an Import button.
    const existing = await screen.findByRole('link', { name: 'View existing' });
    expect(existing.getAttribute('href')).toBe('/place/workshop-annex');
    expect(screen.getByText('approved').className).toContain('stamp');
    expect(screen.getAllByRole('button', { name: 'Import' })).toHaveLength(1);
  });

  it('a failed duplicate check leaves every row looking new', async () => {
    api.searchPlaces.mockResolvedValue({ candidates: CANDIDATES });
    api.existingByPlaceIds.mockRejectedValue(new Error('rls'));
    renderDesk('/add');
    await search();
    expect(await screen.findAllByRole('button', { name: 'Import' })).toHaveLength(2);
  });

  it('imports under the chosen category, stays on the page, and marks the row', async () => {
    api.searchPlaces.mockResolvedValue({ candidates: CANDIDATES });
    let finish;
    api.importPlace.mockReturnValue(new Promise((r) => { finish = r; }));
    renderDesk('/add', { city: 'hcmc' });
    fireEvent.click(await screen.findByRole('button', { name: 'Outdoors & culture' }));
    await search();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Import' }))[0]);
    expect(api.importPlace).toHaveBeenCalledWith('g1', 'out', 'hcmc');
    // Mid-flight the button says so and refuses a second press.
    const busy = await screen.findByRole('button', { name: 'Importing…' });
    expect(busy.disabled).toBe(true);
    finish({ slug: 'the-workshop-coffee', photos: 3 });
    const link = await screen.findByRole('link', { name: 'Imported ✓' });
    expect(link.getAttribute('href')).toBe('/place/the-workshop-coffee');
    expect((await findToast()).textContent).toBe('Imported The Workshop Coffee (3 photos)');
    // The counts in the page head are stale the moment a place lands.
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
    // The other row is untouched, and still on this screen.
    expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Add a place' })).toBeTruthy();
  });

  it('says why an import failed and leaves the button pressable', async () => {
    api.searchPlaces.mockResolvedValue({ candidates: [CANDIDATES[0]] });
    api.importPlace.mockRejectedValue(new Error('409 already imported'));
    renderDesk('/add');
    await search();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect((await findToast()).textContent).toBe('Import failed: 409 already imported');
    expect(screen.getByRole('button', { name: 'Import' }).disabled).toBe(false);
  });

  it('says why a search failed', async () => {
    api.searchPlaces.mockRejectedValue(new Error('function down'));
    renderDesk('/add');
    await search();
    expect((await findToast()).textContent).toBe('Search failed: function down');
  });
});
