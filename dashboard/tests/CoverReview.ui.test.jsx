// Cover review: what the page asks and what it does with the answer.
//
// Which places and which suggestion is pinned in coverReview.test.mjs.
// What is pinned here: the page asks for the desk's city; an answer is
// sent with the review it answers and takes the place off the page; the
// tally counts it; a refused answer leaves the place where it was.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const L = (kind, over = {}) => ({ kind, brand: false, wide: false, daylight: false, people: true, ...over });
const photo = (id, labels, over = {}) => ({ id, photo_uri: `https://x/${id}.jpg`, is_cover: false, is_hidden: false, sort_order: 0, labels, ...over });

const PLACES = [
  { id: 'p-menu', slug: 'menu-cafe', city_id: 'hcmc', name: 'Menu Café', categories: ['heritage'], photos: [
    photo('menu', L('text'), { is_cover: true }),
    photo('front', L('exterior', { wide: true, brand: true, daylight: true }), { sort_order: 1 }),
  ] },
  { id: 'p-corner', slug: 'corner', city_id: 'hanoi', name: 'Corner', categories: ['views'], photos: [
    photo('shelf', L('interior'), { is_cover: true }),
    photo('room', L('interior', { wide: true, people: false }), { sort_order: 1 }),
  ] },
  { id: 'p-fine', slug: 'fine', city_id: 'hcmc', name: 'Fine', categories: [], photos: [
    photo('ok', L('view', { wide: true }), { is_cover: true }),
  ] },
];

const card = (name) => screen.getByText(name).closest('section');

describe('Cover review', () => {
  it('says so when every cover shows its place', async () => {
    renderDesk('/covers', { city: 'hcmc' });
    // The desk's city arrives with the city list, after the first render.
    await waitFor(() => expect(api.coverPlaces).toHaveBeenCalledWith('hcmc'));
    expect(await screen.findByText('0 to look at')).toBeTruthy();
    expect(screen.getByText('Every cover here shows its place.')).toBeTruthy();
  });

  it('puts the cover beside the suggestion, with why and why not, for the whole catalog', async () => {
    api.coverPlaces.mockResolvedValue(PLACES);
    renderDesk('/covers', { city: 'all' });
    await screen.findByText('Menu Café');
    expect(api.coverPlaces).toHaveBeenCalledWith(null);
    expect(screen.getByText('2 to look at')).toBeTruthy();
    // Hanoi before Saigon, and each card names its city when the desk
    // is not on one.
    expect([...document.querySelectorAll('.cr-name')].map((a) => a.textContent)).toEqual(['Corner', 'Menu Café']);
    const menu = within(card('Menu Café'));
    expect(menu.getByText('hcmc')).toBeTruthy();
    expect(menu.getByAltText('Menu Café: the cover').getAttribute('src')).toBe('https://x/menu.jpg');
    expect(menu.getByAltText('Menu Café: the suggestion').getAttribute('src')).toBe('https://x/front.jpg');
    expect(menu.getByText(/Text$/)).toBeTruthy();
    expect(menu.getByText(/Whole place · Its sign · Daylight$/)).toBeTruthy();
    expect(within(card('Corner')).getByText(/Inside, but only part of it$/)).toBeTruthy();
    expect(menu.getByRole('link', { name: 'Menu Café' }).getAttribute('href')).toBe('/place/menu-cafe');
  });

  it('takes the suggestion: changes the cover, records it, and moves the place off the page', async () => {
    api.coverPlaces.mockResolvedValue(PLACES);
    renderDesk('/covers', { city: 'all' });
    fireEvent.click(within(await screen.findByText('Menu Café').then(() => card('Menu Café'))).getByText('Use the suggestion'));
    expect((await findToast()).textContent).toBe('Menu Café: cover changed');
    const [review, decision] = api.answerCover.mock.calls[0];
    expect(decision).toBe('changed');
    expect([review.place.id, review.cover.id, review.suggestion.id]).toEqual(['p-menu', 'menu', 'front']);
    await waitFor(() => expect(screen.queryByText('Menu Café')).toBeNull());
    expect(screen.getByText('1 to look at')).toBeTruthy();
    expect(screen.getByText('1 of 1 suggestions taken')).toBeTruthy();
  });

  it('keeps the cover: records it, and the tally counts it as not taken', async () => {
    api.coverPlaces.mockResolvedValue(PLACES);
    api.coverAnswers.mockResolvedValue([{ place_id: 'elsewhere', cover_photo_id: 'x', decision: 'changed' }]);
    renderDesk('/covers', { city: 'all' });
    await screen.findByText('Corner');
    expect(screen.getByText('1 of 1 suggestions taken')).toBeTruthy();
    fireEvent.click(within(card('Corner')).getByText('Keep the cover'));
    expect((await findToast()).textContent).toBe('Corner: cover kept');
    expect(api.answerCover.mock.calls[0][1]).toBe('kept');
    await waitFor(() => expect(screen.queryByText('Corner')).toBeNull());
    expect(screen.getByText('1 of 2 suggestions taken')).toBeTruthy();
  });

  it('a refused answer says why and leaves the place where it was', async () => {
    api.coverPlaces.mockResolvedValue(PLACES);
    api.answerCover.mockRejectedValue(new Error('not an editor'));
    renderDesk('/covers', { city: 'all' });
    await screen.findByText('Corner');
    fireEvent.click(within(card('Corner')).getByText('Keep the cover'));
    expect((await findToast()).textContent).toBe('not an editor');
    expect(screen.getByText('Corner')).toBeTruthy();
    expect(within(card('Corner')).getByText('Keep the cover').disabled).toBe(false);
  });

  it('a failed read says why, shows nothing to answer, and reads again on Refresh', async () => {
    api.coverPlaces.mockRejectedValueOnce(new Error('offline'));
    renderDesk('/covers', { city: 'hcmc' });
    expect((await findToast()).textContent).toBe('offline');
    expect(screen.getByText('Every cover here shows its place.')).toBeTruthy();
    api.coverPlaces.mockResolvedValue(PLACES);
    fireEvent.click(screen.getByText('Refresh'));
    expect(await screen.findByText('Menu Café')).toBeTruthy();
    // On one city, the cards do not repeat its name.
    expect(within(card('Menu Café')).queryByText('hcmc')).toBeNull();
  });
});
