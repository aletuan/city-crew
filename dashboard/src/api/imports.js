// Bringing places in: what is already here, Google search and import,
// a first-draft blurb, and the city scan — the Edge Functions that hold
// the keys.
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

export function importsApi({ db, invoke, supabase }) {
  return {
    // Keyed by google_place_id — global, not city-scoped, matching the
    // fetch-place import guard's own duplicate check. Lets "Add a place"
    // flag a search result that's already in the catalog before the editor
    // clicks Import and hits the 409.
    existingByPlaceIds: async (placeIds) => {
      if (!placeIds?.length) return {};
      const rows = db(await supabase.from('places')
        .select('google_place_id, slug, name_en, review_status')
        .in('google_place_id', placeIds));
      return Object.fromEntries(rows.map((r) => [r.google_place_id, r]));
    },

    searchPlaces: (query, city) => invoke('fetch-place', { action: 'search', query, city }),
    // A first draft of a blank blurb, for the editor to read before Save.
    // The function writes nothing; see `write-blurb/index.ts` for why.
    // `mode` names a language to draft for a blurb the row already has
    // (`'ja'`); without it the function drafts the blank pair.
    draftBlurb: (slug, mode) => invoke('write-blurb', mode ? { slug, mode } : { slug }),
    importPlace: (place_id, category, city) => invoke('fetch-place', { action: 'import', place_id, category, city }),

    scanCategories: () => invoke('scan-city', { action: 'categories' }),
    scanCity: (city, category_key) => invoke('scan-city', { action: 'scan', city, category_key }),
  };
}
