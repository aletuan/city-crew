// The catalog's reference rows: the search terms each category adds, and
// the cities with their hero columns.
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

export function citiesApi({ supabase, db }) {
  return {
    /**
     * Search synonyms, `category → terms`.
     *
     * The words a reader types that the catalog does not otherwise contain:
     * somebody looking for "cinema" finds nothing, because no field of a
     * multiplex says the word and its category is labelled "Fun".
     *
     * These only ever *add* to the list the app already ships, so a row
     * cleared here cannot break search — it falls back to the defaults in
     * app/src/lib/categories.ts. Not scoped to a city: what people call a
     * cinema does not change between Hanoi and Saigon.
     */
    categoryTerms: async () => {
      const rows = db(await supabase.from('category_terms').select('category, terms'));
      return Object.fromEntries((rows ?? []).map((r) => [r.category, r.terms ?? []]));
    },

    saveCategoryTerms: async (category, terms) => {
      // Trimmed and de-duplicated here rather than trusted from the box:
      // a stray blank line is the commonest thing to type into a list, and
      // the app's own guard drops terms under three characters silently —
      // this is where the desk still has a chance to see it.
      const clean = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
      db(await supabase
        .from('category_terms')
        .upsert({ category, terms: clean, updated_at: new Date().toISOString() })
        .select('category'));
      return clean;
    },

    cities: async () =>
      db(await supabase.from('cities').select('id, name_en, name_vi, short_en, short_vi').order('sort_order')),

    // The full row, hero columns included — for the City hero screen.
    city: async (id) => {
      const rows = db(await supabase.from('cities').select('*').eq('id', id).limit(1));
      if (!rows.length) throw new Error('not found');
      return rows[0];
    },

    saveCityHero: async (id, fields) => {
      const editable = new Set([
        'hero_title_en', 'hero_title_vi', 'hero_title_ja', 'hero_title_zh', 'hero_title_zh_hant',
        'hero_sub_en', 'hero_sub_vi', 'hero_sub_ja', 'hero_sub_zh', 'hero_sub_zh_hant',
        'hero_cta_en', 'hero_cta_vi', 'hero_cta_ja', 'hero_cta_zh', 'hero_cta_zh_hant', 'hero_place_slug',
        // The photo's URL and path are not here on purpose: they are written
        // by setCityHeroPhoto, which owns the file beside them. Only the
        // credit is typed by hand.
        'hero_photo_credit', 'hero_photo_credit_uri',
      ]);
      const patch = {};
      for (const [k, v] of Object.entries(fields)) {
        if (!editable.has(k)) throw new Error(`field not editable: ${k}`);
        // '' means "cleared" in the form; the app's fallbacks key off null.
        patch[k] = v === '' ? null : v;
      }
      const rows = db(await supabase.from('cities').update(patch).eq('id', id).select('id'));
      if (!rows.length) throw new Error('not found (or not an editor — check the editors table)');
      return { ok: true };
    },
  };
}
