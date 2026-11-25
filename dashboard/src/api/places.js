// The places themselves: the paged list, one place, editing, deleting,
// approving and publishing.
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

import { localizedColumns, objectLangs } from '../langs.js';
import { removeObjects } from '../storage.js';

// Same whitelist the old server enforced — kept client-side so a typo'd field
// fails loudly here instead of silently bouncing off RLS.
const EDITABLE = new Set([
  ...localizedColumns(),
  // Every language past EN and VI, as one object — see `langs.js`.
  'i18n',
  'address', 'category', 'categories', 'is_featured', 'vibe_tags', 'emoji',
  'price_level', 'price_display', 'price_vnd', 'duration_min', 'duration_max',
  'opening_hours', 'website', 'phone', 'threads_handle', 'sort_order', 'is_published',
  'review_status', 'review_note',
  'reviewer_source', 'reviewer_name', 'reviewer_url',
]);

// `saved_count` used to sit in that list. It is a number an editor typed, it
// has never matched the saves people actually make, and nothing in the mobile
// app reads it — its one ranking use was reverted in 193d90f. The column stays
// (the pitch snapshot still exports it) but the desk no longer offers to
// overwrite it; `saveCount` below reads the real thing instead.

const PAGE_SIZE = 24;
const SORT_COLUMNS = { created_at: 'created_at', rating_count: 'rating_count', rating: 'rating' };

export function placesApi({ supabase, db, everyRow, attachSubmitters, BUCKET }) {
  return {
    // Paginated by default — {rows, total, pageSize} — for the list page.
    // PlaceEditor's prev/next needs every matching slug in order, not one
    // page of it, so it passes `all: true` for the plain, unpaginated array
    // this returned before pagination existed.
    places: async (params = {}) => {
      const sortColumn = SORT_COLUMNS[params.sort] ?? 'created_at';
      const ascending = params.dir === 'asc';
      // A function rather than one query, because `all` reads it a thousand
      // rows at a time — see `everyRow` — and a builder is spent once awaited.
      const build = () => {
        let query = supabase
          .from('places')
          .select(
            'slug, name_en, name_vi, category, categories, is_featured, vibe_tags, neighborhood_en, review_status, is_published, rating, rating_count, price_vnd, price_display, created_at, channel, added_by, submitted_by, place_photos(photo_uri, is_cover, is_hidden, sort_order)',
            { count: 'exact' },
          )
          .order(sortColumn, { ascending, nullsFirst: false })
          .order('slug') // stable tiebreaker
          // The photos come back ordered too, because the line below has to
          // pick one of them the way the app does. See the note there.
          .order('sort_order', { referencedTable: 'place_photos' });
        if (params.city) query = query.eq('city_id', params.city);
        if (params.status) query = query.eq('review_status', params.status);
        if (params.category) query = query.contains('categories', [params.category]);
        if (params.vibe) query = query.contains('vibe_tags', [params.vibe]);
        // The one filter the chip rows cannot express: a place with no tags at
        // all is absent from every chip's count, so the row meant to find
        // things is exactly where it does not appear. Generated in Postgres —
        // see the needs_classification migration.
        if (params.needs) query = query.eq('needs_classification', true);
        // Threads handles are filled in by hand, one at a time — `import-place.ts`
        // leaves the column null because Google Places does not return it. So the
        // useful half of this filter is `no`: it is the queue of venues nobody has
        // looked up yet. The chip rows above cannot express it, for the same
        // reason `needs_classification` exists — a null is not a tag, so a place
        // missing the field is absent from every chip that could find it.
        //
        // `is null` and not `= ''` because the two are the same state here and
        // only one of them can reach the table: `stamp_threads_handle` rewrites a
        // blank to null before the row lands. If that trigger is ever dropped,
        // this filter starts counting empty strings as filled — `countThreads`
        // already treats them as missing, and the two would disagree.
        if (params.threads === 'yes') query = query.not('threads_handle', 'is', null);
        if (params.threads === 'no') query = query.is('threads_handle', null);
        // A model's draft nobody has read, in one language: the `machine` flag
        // the fold sets beside the text in `i18n`. Read through PostgREST's
        // JSON path, so no column needs adding per language. The code goes
        // into that path, so only a code LANGS knows is allowed to.
        if (params.machine && objectLangs().some((l) => l.code === params.machine)) {
          query = query.eq(`i18n->${params.machine}->>machine`, 'true');
        }
        if (params.channel) query = query.eq('channel', params.channel);
        if (params.q) query = query.or(`name_en.ilike.%${params.q}%,name_vi.ilike.%${params.q}%`);
        return query;
      };
      let data;
      let count;
      if (params.all) {
        data = await everyRow(build);
      } else {
        const page = Math.max(1, Number(params.page) || 1);
        const res = await build().range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
        if (res.error) throw new Error(res.error.message);
        ({ data, count } = res);
      }
      const rows = data.map((r) => {
        // Cover first, and failing that the lowest `sort_order` — which is
        // `photosOf`'s rule in the app, and has to be this one too.
        //
        // The fallback half was missing. The embed used to come back in no
        // order, so `visible[0]` was whichever row PostgREST happened to
        // hand over, and a place with no cover showed the desk one
        // photograph and the reader another.
        //
        // That used to be rare. It is not any more: a reader's upload takes
        // the cover on the way in, and deleting it takes the flag with it,
        // so a moderated place routinely has no cover at all. The thumbnail
        // the desk judges by has to be the picture the reader sees.
        //
        // Ordered in the query rather than here, which is why this line did
        // not change: `place_photos` arrives sorted, so `visible[0]` is
        // already the lowest `sort_order`.
        const visible = r.place_photos.filter((p) => !p.is_hidden);
        const cover = visible.find((p) => p.is_cover) ?? visible[0];
        const { place_photos, ...rest } = r;
        return { ...rest, cover_url: cover?.photo_uri ?? null, photo_count: visible.length };
      });
      await attachSubmitters(rows);
      return params.all ? rows : { rows, total: count, pageSize: PAGE_SIZE };
    },

    place: async (slug) => {
      const rows = db(await supabase.from('places').select('*, place_photos(*)').eq('slug', slug).limit(1));
      if (!rows.length) throw new Error('not found');
      const place = rows[0];
      place.place_photos.sort((a, b) => a.sort_order - b.sort_order);
      return place;
    },

    // How many lists a place actually sits in. Counts rows rather than trusting
    // `places.saved_count`, which is hand-typed and drifts. Editors can read
    // `collection_places` outright — policy "editors manage collection members"
    // in 20260815120000_publish_collections.sql — so this needs no view.
    saveCount: async (placeId) => {
      const { count, error } = await supabase
        .from('collection_places')
        .select('*', { count: 'exact', head: true })
        .eq('place_id', placeId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    savePlace: async (slug, fields) => {
      const patch = {};
      for (const [k, v] of Object.entries(fields)) {
        if (!EDITABLE.has(k)) throw new Error(`field not editable: ${k}`);
        patch[k] = v;
      }
      if (!Object.keys(patch).length) throw new Error('no fields');
      if ('review_status' in patch) patch.reviewed_at = new Date().toISOString();
      // Approved means live (owner, 23 Oct 2026). A place shows in the app
      // only when it is approved *and* published, and approving used to
      // leave the second switch where it was — so a place the desk had said
      // yes to could still be hidden, and its submitter still read "Chờ
      // duyệt". The published box stays, for taking a place down by hand.
      if (patch.review_status === 'approved') patch.is_published = true;
      patch.updated_at = new Date().toISOString();
      const rows = db(await supabase.from('places').update(patch).eq('slug', slug).select('slug'));
      if (!rows.length) throw new Error('not found (or not an editor — check the editors table)');
      return { ok: true };
    },

    deletePlace: async (slug) => {
      const places = db(await supabase.from('places').select('id').eq('slug', slug).limit(1));
      if (!places.length) throw new Error('not found');
      const placeId = places[0].id;

      // Collect every stored object before the cascade wipes the photo rows:
      // the desk's uploads and the Google photos copied onto the bucket alike.
      // Only uploads used to be collected, so each deleted place left its
      // copied photos behind — see storage.js.
      const stored = db(await supabase.from('place_photos')
        .select('storage_path').eq('place_id', placeId).not('storage_path', 'is', null));

      db(await supabase.from('places').delete().eq('id', placeId).select('id'));

      const files = await removeObjects(supabase.storage.from(BUCKET), stored.map((u) => u.storage_path));
      return { ok: true, removed_uploads: files.removed, left: files.left };
    },

    // Same shape as deletePlace, batched — a bad scan-city run can bring in
    // a dozen duds at once, and deleting those one at a time (one confirm,
    // one round-trip each) is the thing this exists to avoid.
    deletePlaces: async (slugs) => {
      if (!slugs?.length) return { ok: true, deleted: 0, removed_uploads: 0 };
      const places = db(await supabase.from('places').select('id').in('slug', slugs));
      const ids = places.map((p) => p.id);
      if (!ids.length) return { ok: true, deleted: 0, removed_uploads: 0 };

      const stored = db(await supabase.from('place_photos')
        .select('storage_path').in('place_id', ids).not('storage_path', 'is', null));

      db(await supabase.from('places').delete().in('id', ids).select('id'));

      const files = await removeObjects(supabase.storage.from(BUCKET), stored.map((u) => u.storage_path));
      return { ok: true, deleted: ids.length, removed_uploads: files.removed, left: files.left };
    },

    // Approval, batched — the other half of the toolbar deletePlaces put on
    // the list: a good scan run is a dozen keepable rows, and stamping them
    // one editor screen at a time is the same chore in the other direction.
    //
    // Approving publishes, as it does for one place in savePlace (owner, 23
    // Oct 2026): a batch approved here is live in the app at once. Until then
    // approval shipped nothing and publish was a second switch; the owner
    // chose one step over a staging gap nobody was using — every city was
    // active and no approved place was unpublished that day.
    //
    // The filter skips rows already approved *and* live, so the returned
    // count is the honest number of rows that changed — an approved place
    // taken down by hand is put back up by approving it again.
    approvePlaces: async (slugs) => {
      if (!slugs?.length) return { ok: true, approved: 0 };
      const now = new Date().toISOString();
      const rows = db(await supabase.from('places')
        .update({ review_status: 'approved', is_published: true, reviewed_at: now, updated_at: now })
        .in('slug', slugs)
        .or('review_status.neq.approved,is_published.eq.false')
        .select('slug'));
      return { ok: true, approved: rows.length };
    },

    /** Flip every approved-but-unpublished place live, scoped to a city.
     *  Approve and publish are separate switches; this closes the gap in one tap. */
    publishApproved: async (city) => {
      let query = supabase.from('places')
        .update({ is_published: true, updated_at: new Date().toISOString() })
        .eq('review_status', 'approved')
        .eq('is_published', false);
      if (city) query = query.eq('city_id', city);
      const rows = db(await query.select('slug'));
      return { published: rows.length };
    },
  };
}
