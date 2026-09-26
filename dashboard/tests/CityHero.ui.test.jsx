// City hero: the Explore cover, one city at a time.
//
// Pinned here: the preview shows what the app will show — the same
// fallbacks, language by language, and the same photo pick — and the one
// rule the API also enforces is enforced before a file is chosen: no
// cover without a credit.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { api, resizeImage } from '../src/api.js';
import { CITIES } from './_ui/setup.jsx';
import { findToast, renderDesk } from './_ui/desk.jsx';

const cityRow = (id, extra = {}) => ({
  ...CITIES.find((c) => c.id === id),
  hero_title_en: null, hero_title_vi: null, hero_title_ja: null,
  hero_sub_en: null, hero_sub_vi: null, hero_sub_ja: null,
  hero_cta_en: null, hero_cta_vi: null, hero_cta_ja: null,
  hero_place_slug: null, hero_photo_credit: null, hero_photo_credit_uri: null,
  hero_photo_uri: null, hero_photo_path: null,
  ...extra,
});

const PLACES = [
  { slug: 'plain', name_en: 'Plain Café', cover_url: 'https://x/plain.jpg', is_published: true, is_featured: false, vibe_tags: [] },
  { slug: 'feat', name_en: 'Featured Bar', cover_url: 'https://x/feat.jpg', is_published: true, is_featured: true, vibe_tags: ['cozy'] },
  { slug: 'roof', name_en: 'Rooftop', cover_url: 'https://x/roof.jpg', is_published: true, is_featured: true, vibe_tags: ['views'] },
  { slug: 'draft', name_en: 'Draft Place', cover_url: 'https://x/draft.jpg', is_published: false, is_featured: true, vibe_tags: ['views'] },
];

const heroImg = () => document.querySelector('.heropreview img');
const previewTitle = () => document.querySelector('.heropreview-title').textContent;
const previewSub = () => document.querySelector('.heropreview-sub').textContent;
const previewCta = () => document.querySelector('.heropreview-cta').textContent;

describe('CityHero', () => {
  it('asks for a city first when the desk is on all cities', async () => {
    renderDesk('/city', { city: 'all' });
    expect(await screen.findByText('One city at a time')).toBeTruthy();
  });

  it('opens on the workspace city and previews the app defaults, language by language', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    api.places.mockResolvedValue(PLACES);
    renderDesk('/city', { city: 'hcmc' });
    expect(await screen.findByRole('heading', { name: 'City hero — Ho Chi Minh City' })).toBeTruthy();
    expect(api.places).toHaveBeenCalledWith({ city: 'hcmc', all: true });
    expect(previewTitle()).toBe('Ideas for a night in Saigon');
    expect(previewSub()).toBe('Browse public collections and places — no account needed.');
    expect(previewCta()).toBe("Let's go →");
    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    expect(previewTitle()).toBe('Gợi ý cho một đêm ở Sài Gòn');
    expect(previewCta()).toBe('Khám phá →');
    fireEvent.click(screen.getByRole('button', { name: 'JA' }));
    expect(previewTitle()).toBe('Saigon、夜のアイデア');
    expect(previewCta()).toBe('はじめる →');
    // The chip for this city is on; the pinned-place menu lists every
    // place with a photo and says which are not published.
    expect(screen.getByRole('button', { name: 'TP.HCM' }).className).toContain('on');
    expect(screen.getByRole('option', { name: 'Draft Place (not published)' })).toBeTruthy();
  });

  it('picks the photo the app would: pinned, then featured with a view, then featured, then any', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    api.places.mockResolvedValue(PLACES);
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    expect(heroImg().getAttribute('src')).toBe('https://x/roof.jpg');
    expect(screen.getByText('photo: Rooftop (automatic)')).toBeTruthy();
    // Pin the plain one and it wins.
    fireEvent.change(screen.getByLabelText('Pinned place'), { target: { value: 'plain' } });
    expect(heroImg().getAttribute('src')).toBe('https://x/plain.jpg');
    expect(screen.getByText('photo: Plain Café (pinned)')).toBeTruthy();
    // Pin an unpublished one and the app cannot follow — say so.
    fireEvent.change(screen.getByLabelText('Pinned place'), { target: { value: 'draft' } });
    expect(screen.getByText(/This place isn't published yet/)).toBeTruthy();
    expect(heroImg().getAttribute('src')).toBe('https://x/roof.jpg');
  });

  it('falls back through featured, then any published photo, then nothing', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    api.places.mockResolvedValue([PLACES[0], PLACES[1]]);
    const { unmount } = renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    expect(heroImg().getAttribute('src')).toBe('https://x/feat.jpg');
    unmount();
    api.places.mockResolvedValue([PLACES[0]]);
    const second = renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    expect(heroImg().getAttribute('src')).toBe('https://x/plain.jpg');
    second.unmount();
    api.places.mockResolvedValue([PLACES[3]]);
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    expect(screen.getByText('No published place with a photo yet')).toBeTruthy();
  });

  it('a stored title stands in for a missing translation, and the city\'s own cover wins', async () => {
    api.city.mockImplementation(async (id) => cityRow(id, {
      hero_title_en: 'Saigon after dark', hero_sub_vi: 'Chỉ dành cho đêm', hero_cta_ja: 'いこう',
      hero_photo_uri: 'https://x/own.jpg', hero_photo_credit: '@leica',
    }));
    api.places.mockResolvedValue(PLACES);
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    expect(heroImg().getAttribute('src')).toBe('https://x/own.jpg');
    expect(screen.getByText('photo: this city’s own cover — @leica')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    expect(previewTitle()).toBe('Saigon after dark');
    expect(previewSub()).toBe('Chỉ dành cho đêm');
    expect(previewCta()).toBe('Khám phá →');
    fireEvent.click(screen.getByRole('button', { name: 'JA' }));
    expect(previewCta()).toBe('いこう →');
    expect(previewSub()).toBe('コレクションとスポットを自由に閲覧 — アカウント不要。');
  });

  it('edits light up Save, Discard puts them back, and Save writes then re-reads', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    const save = screen.getByRole('button', { name: 'Save hero' });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Title\s*VI/), { target: { value: 'Đêm Sài Gòn' } });
    expect(previewTitle()).toBe('Ideas for a night in Saigon');
    fireEvent.click(screen.getByRole('button', { name: 'VI' }));
    expect(previewTitle()).toBe('Đêm Sài Gòn');
    expect(save.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(save.disabled).toBe(true);
    expect(previewTitle()).toBe('Gợi ý cho một đêm ở Sài Gòn');
    fireEvent.change(screen.getByLabelText(/^Button\s*EN/), { target: { value: 'Go out' } });
    api.city.mockImplementation(async (id) => cityRow(id, { hero_cta_en: 'Go out' }));
    fireEvent.click(save);
    expect((await findToast()).textContent).toBe("Saved Ho Chi Minh City's hero");
    expect(api.saveCityHero).toHaveBeenCalledWith('hcmc', expect.objectContaining({ hero_cta_en: 'Go out', hero_title_en: '' }));
    expect(screen.getByRole('button', { name: 'Save hero' }).disabled).toBe(true);
  });

  it('says why a save failed and keeps the edit', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    api.saveCityHero.mockRejectedValue(new Error('not an editor'));
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    fireEvent.change(screen.getByLabelText(/^Title\s*EN/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save hero' }));
    expect((await findToast()).textContent).toBe('Save failed: not an editor');
    expect(screen.getByLabelText(/^Title\s*EN/).value).toBe('x');
  });

  it('switching city with unsaved edits asks first', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    renderDesk('/city');
    await screen.findByRole('heading', { name: 'City hero — Ho Chi Minh City' });
    fireEvent.change(screen.getByLabelText(/^Title\s*EN/), { target: { value: 'x' } });
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
    expect(screen.getByRole('heading', { name: 'City hero — Ho Chi Minh City' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
    expect(await screen.findByRole('heading', { name: 'City hero — Hanoi' })).toBeTruthy();
    expect(api.city).toHaveBeenLastCalledWith('hanoi');
    // The chip already on is a no-op, and a clean form asks nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đà Nẵng' }));
    expect(await screen.findByRole('heading', { name: 'City hero — Da Nang' })).toBeTruthy();
    expect(window.confirm).toHaveBeenCalledTimes(2);
  });

  it('refuses a cover without a credit, and takes one with', async () => {
    api.city.mockImplementation(async (id) => cityRow(id));
    api.setCityHeroPhoto.mockResolvedValue({ ok: true, left: [] });
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    const zone = screen.getByText(/Fill in “Photo by” above/).closest('button');
    expect(zone.disabled).toBe(true);
    fireEvent.dragOver(zone);
    expect(zone.className).not.toContain('dragover');
    fireEvent.change(screen.getByLabelText(/^Photo by/), { target: { value: '  @leica ' } });
    fireEvent.change(screen.getByLabelText(/^Credit links to/), { target: { value: 'https://leica.example' } });
    expect(zone.disabled).toBe(false);
    expect(zone.textContent).toContain('Drop a photo here');
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('dragover');
    fireEvent.dragLeave(zone);
    const file = new File(['x'], 'skyline.jpg', { type: 'image/jpeg' });
    api.city.mockImplementation(async (id) => cityRow(id, { hero_photo_uri: 'https://x/own.jpg', hero_photo_credit: '@leica' }));
    fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [file] } });
    expect((await findToast()).textContent).toBe('Cover replaced for Ho Chi Minh City');
    expect(resizeImage).toHaveBeenCalledWith(file);
    expect(api.setCityHeroPhoto).toHaveBeenCalledWith('hcmc', expect.any(Blob), 'skyline.jpg', {
      credit: '@leica', creditUri: 'https://leica.example',
    });
    expect(heroImg().getAttribute('src')).toBe('https://x/own.jpg');
    expect(screen.getByRole('button', { name: 'Remove cover' })).toBeTruthy();
  });

  it('a drop uploads too, and reports a file the bucket would not give up', async () => {
    api.city.mockImplementation(async (id) => cityRow(id, { hero_photo_credit: 'Studio' }));
    api.setCityHeroPhoto.mockResolvedValue({ ok: true, left: ['cities/hcmc/old.jpg'] });
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    const zone = screen.getByText(/Drop a photo here/).closest('button');
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] } });
    expect((await findToast()).textContent).toBe('Cover replaced — 1 old file could not be deleted');
    // An empty drop is nothing.
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(api.setCityHeroPhoto).toHaveBeenCalledTimes(1);
  });

  it('says why an upload failed', async () => {
    api.city.mockImplementation(async (id) => cityRow(id, { hero_photo_credit: 'Studio' }));
    api.setCityHeroPhoto.mockRejectedValue(new Error('bucket full'));
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    fireEvent.change(document.querySelector('input[type=file]'), {
      target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] },
    });
    expect((await findToast()).textContent).toBe('Upload failed: bucket full');
  });

  it('removes the cover only when told to', async () => {
    api.city.mockImplementation(async (id) => cityRow(id, { hero_photo_uri: 'https://x/own.jpg', hero_photo_credit: '@leica' }));
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }));
    expect(api.clearCityHeroPhoto).not.toHaveBeenCalled();
    api.city.mockImplementation(async (id) => cityRow(id));
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }));
    expect((await findToast()).textContent).toBe('Cover removed');
    expect(api.clearCityHeroPhoto).toHaveBeenCalledWith('hcmc');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove cover' })).toBeNull());
  });

  it('says why a remove failed', async () => {
    api.city.mockImplementation(async (id) => cityRow(id, { hero_photo_uri: 'https://x/own.jpg', hero_photo_credit: '@leica' }));
    api.clearCityHeroPhoto.mockRejectedValue(new Error('locked'));
    renderDesk('/city');
    await screen.findByRole('heading', { name: /City hero/ });
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }));
    expect((await findToast()).textContent).toBe("Couldn't remove: locked");
  });

  it('says so when the city cannot be read, and tolerates a places read that fails', async () => {
    api.city.mockRejectedValue(new Error('gone'));
    api.places.mockRejectedValue(new Error('gone too'));
    renderDesk('/city');
    expect((await findToast()).textContent).toBe("Couldn't load city: gone");
    expect(screen.getByText('Loading Ho Chi Minh City…')).toBeTruthy();
  });
});
