// The photographs: cover and hidden, the cover review, order, upload
// and delete, and the city's own cover (`cityHero.js`).
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

import { removeObjects } from '../storage.js';
import { cityHeroApi } from '../cityHero.js';

export function photosApi({ supabase, db, everyRow, BUCKET }) {
  const photos = {
    patchPhoto: async (id, { is_cover, is_hidden }) => {
      if (is_cover === true) {
        const rows = db(await supabase.from('place_photos').select('place_id').eq('id', id).limit(1));
        if (!rows.length) throw new Error('not found');
        db(await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', rows[0].place_id).select('id'));
        db(await supabase.from('place_photos').update({ is_cover: true, is_hidden: false }).eq('id', id).select('id'));
      }
      if (typeof is_hidden === 'boolean') {
        db(await supabase.from('place_photos').update({ is_hidden }).eq('id', id).select('id'));
      }
      return { ok: true };
    },

    /**
     * Every place with its photographs and their labels, for the cover
     * review (`coverReview.js`). Only the `claude-labels` row of each
     * photograph comes back — Apple Vision's would be a second row in the
     * same embed — and its `signals` are the labels. All of a city's places
     * at once, or the catalog's: the review is a filter over the whole
     * gallery of each place, not a page of them.
     */
    coverPlaces: async (city) => {
      const rows = await everyRow(() => {
        let q = supabase.from('places')
          .select('id, slug, city_id, name_en, name_vi, categories, '
            + 'place_photos(id, photo_uri, is_cover, is_hidden, sort_order, photo_scores(scorer, signals))')
          .eq('place_photos.photo_scores.scorer', 'claude-labels');
        if (city) q = q.eq('city_id', city);
        return q.order('id');
      });
      return rows.map(({ place_photos: photos, name_en: en, name_vi: vi, ...p }) => ({
        ...p,
        name: en || vi || p.slug,
        photos: (photos ?? []).map(({ photo_scores: scores, ...ph }) => ({ ...ph, labels: scores?.[0]?.signals ?? null })),
      }));
    },

    /** The desk's answers so far, one per place (`cover_reviews`). */
    coverAnswers: async () => everyRow(() => supabase.from('cover_reviews')
      .select('place_id, cover_photo_id, suggested_photo_id, decision')
      .order('place_id')),

    /**
     * Answer one review: `changed` makes the suggestion the cover first,
     * then records the answer, so a failed cover change never leaves an
     * answer saying it happened. Who answered, and when, the database
     * stamps.
     */
    answerCover: async (review, decision) => {
      if (decision === 'changed') await photos.patchPhoto(review.suggestion.id, { is_cover: true });
      db(await supabase.from('cover_reviews').upsert({
        place_id: review.place.id,
        cover_photo_id: review.cover.id,
        suggested_photo_id: review.suggestion.id,
        decision,
      }, { onConflict: 'place_id' }).select('place_id'));
      return { ok: true };
    },

    /** Where each photograph is, by id: the photo-type round shows them
     *  in its own order, and a photograph deleted since is simply absent. */
    photoUris: async (ids) => {
      const rows = db(await supabase.from('place_photos').select('id, photo_uri').in('id', ids));
      return Object.fromEntries(rows.map((r) => [r.id, r.photo_uri]));
    },

    reorderPhotos: async (slug, ids) => {
      for (const [i, id] of ids.entries()) {
        db(await supabase.from('place_photos').update({ sort_order: i }).eq('id', id).select('id'));
      }
      return { ok: true };
    },

    // The city cover lives in its own module: api.js is the desk's one
    // untested surface, and a new mechanism should not be added to it.
    // Spread rather than wrapped, so nothing with a branch in it lands here.
    ...cityHeroApi({ supabase, bucket: BUCKET }),

    uploadPhoto: async (slug, blob, filename) => {
      const places = db(await supabase.from('places').select('id').eq('slug', slug).limit(1));
      if (!places.length) throw new Error('place not found');
      const placeId = places[0].id;

      const safeName = String(filename ?? 'photo').replace(/[^\w.-]/g, '_').slice(0, 60);
      const path = `${slug}/${Date.now()}-${safeName}.jpg`;

      // `shrunk` is the mark `shrink-photos` leaves on a file it has
      // re-encoded, and the hourly pass skips files that carry it. An
      // upload is already the size that pass would make (see resizeImage),
      // so it is marked on the way in rather than encoded a second time.
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', metadata: { shrunk: '1' } });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const existing = db(await supabase.from('place_photos').select('sort_order').eq('place_id', placeId));
      const rows = db(await supabase.from('place_photos').insert({
        place_id: placeId,
        photo_ref: null,
        photo_uri: publicUrl,
        storage_path: path,
        source: 'upload',
        attribution_name: null,
        attribution_uri: null,
        sort_order: Math.max(-1, ...existing.map((r) => r.sort_order)) + 1,
        is_cover: false,
      }).select('*'));
      return rows[0];
    },

    deletePhoto: async (id) => {
      const rows = db(await supabase.from('place_photos').select('*').eq('id', id).limit(1));
      if (!rows.length) throw new Error('not found');
      const photo = rows[0];
      db(await supabase.from('collections').update({ cover_photo_id: null }).eq('cover_photo_id', photo.id).select('id'));
      db(await supabase.from('place_photos').delete().eq('id', photo.id).select('id'));
      // Any row with a path owns an object: the desk's uploads, and the
      // Google photos the import now copies onto the same bucket.
      const files = await removeObjects(supabase.storage.from(BUCKET), [photo.storage_path]);
      // keep a cover: promote the first visible photo if the cover was deleted
      if (photo.is_cover) {
        const rest = db(await supabase.from('place_photos')
          .select('id').eq('place_id', photo.place_id).eq('is_hidden', false)
          .order('sort_order').limit(1));
        if (rest.length) db(await supabase.from('place_photos').update({ is_cover: true }).eq('id', rest[0].id).select('id'));
      }
      return { ok: true, left: files.left };
    },
  };
  // `answerCover` changes the cover through `patchPhoto`, its neighbour here.
  return photos;
}
