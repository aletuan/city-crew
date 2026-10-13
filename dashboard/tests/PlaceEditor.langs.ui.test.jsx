// The acceptance test for `src/langs.js`: a fourth language is one row in
// that file. Nothing in this test touches the editor, the save whitelist
// or the stylesheet, and all three grow a Korean column.
//
// Its own file because the mock has to be in place before `PlaceEditor`
// is imported, and `vi.mock` is hoisted per file.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

vi.mock('../src/lib/googleMaps.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGoogleMaps: vi.fn(async () => null),
}));

vi.mock('../src/langs.js', async (importOriginal) => {
  const real = await importOriginal();
  const LANGS = [...real.LANGS, { code: 'ko', label: 'KO' }];
  return {
    ...real,
    LANGS,
    localizedColumns: (fields = real.LOCALIZED_FIELDS) =>
      fields.flatMap((field) => LANGS.map((l) => `${field}_${l.code}`)),
  };
});

const PLACE = {
  id: 'id-a', slug: 'cafe-a', name_en: 'Café A', name_vi: 'Quán A', desc_en: 'A blurb', desc_vi: null,
  neighborhood_en: 'District 1', neighborhood_vi: 'Quận 1', address: '12 Lê Lợi', category: 'food',
  categories: ['cafes'], is_featured: false, vibe_tags: [], emoji: null, price_display: null, price_vnd: null,
  duration_min: null, duration_max: null, website: null, phone: null, threads_handle: null,
  is_published: false, review_note: null, reviewer_source: null, reviewer_name: null, reviewer_url: null,
  review_status: 'pending', lat: 10.7731, lng: 106.7012, rating: 4.4, rating_count: 812,
  google_place_id: 'gp-a', opening_hours: [], place_photos: [],
};

describe('a fourth language', () => {
  it('is one row in langs.js: the editor shows it, and Save sends it', async () => {
    api.place.mockResolvedValue(PLACE);
    api.places.mockResolvedValue([]);
    api.saveCount.mockResolvedValue(0);
    renderDesk('/place/cafe-a');
    await screen.findByDisplayValue('Café A');
    for (const base of ['name', 'desc', 'neighborhood']) {
      expect(document.getElementById(`${base}_ko`)).toBeTruthy();
    }
    expect(screen.getByLabelText('NameKO')).toBe(document.getElementById('name_ko'));
    fireEvent.change(document.getElementById('name_ko'), { target: { value: '카페 A' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await findToast();
    expect(api.savePlace).toHaveBeenCalledWith('cafe-a', expect.objectContaining({ name_ko: '카페 A' }));
  });
});
