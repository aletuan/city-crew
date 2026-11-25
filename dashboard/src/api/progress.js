// What the desk measures: counts per city, the progress board, who
// added what, the local guides, and coverage.
//
// Out of `api.js` on 25 Nov 2026, the desk's one data file split by
// aggregate as the app's `lib/data/` is; the reasoning moved with the
// code. A factory that is handed the client, as `cityHero.js` is: the
// tests load `api.js` afresh for every case with a new fake client, and
// a module that imported the client itself would keep the first case's.

import { countMachine } from '../langs.js';
import { countThreads } from '../lib/threads.js';

export function progressApi({ supabase, db, everyRow }) {
  return {
    /**
     * How many places each city holds, across the whole catalog.
     *
     * Apart from `progress`, which takes a city and is therefore the wrong
     * shape for this: the rail's City group has to show every city's count
     * while one of them is selected, and a query scoped to the selection can
     * only ever report the selection.
     *
     * Scoped by nothing else either, which matches what the other groups in
     * the rail do — their counts come from `progress(city)` and ignore the
     * sibling filters. A count that moved as you ticked other boxes would be
     * a different promise from the one the rest of the column makes.
     */
    cityCounts: async () => {
      const rows = await everyRow(() => supabase.from('places').select('city_id').order('slug'));
      return rows.reduce((acc, r) => ((acc[r.city_id] = (acc[r.city_id] ?? 0) + 1), acc), {});
    },

    progress: async (city) => {
      const rows = await everyRow(() => {
        let query = supabase.from('places')
          .select('slug, name_en, review_status, reviewed_at, is_published, category, categories, vibe_tags, needs_classification, threads_handle, i18n')
          .order('slug');
        if (city) query = query.eq('city_id', city);
        return query;
      });
      const by = (key) => rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});
      // Counts for the multi-valued columns: one place can add to several keys.
      const byTag = (key) => rows.reduce((acc, r) => {
        for (const v of r[key] ?? []) acc[v] = (acc[v] ?? 0) + 1;
        return acc;
      }, {});
      return {
        total: rows.length,
        by_status: by('review_status'),
        // Approved and still invisible. Two independent flags decide whether
        // anyone can see a place, and only one of them was ever counted here
        // — so a city could read "26/26 approved" with three places nobody
        // could open. This is the number the publish button acts on, and the
        // number that makes it worth showing at all.
        unpublished: rows.filter((r) => r.review_status === 'approved' && !r.is_published).length,
        // When the longest-flagged place was flagged. A flag hides a place
        // from the app until it is approved again — the Threads skill flags
        // every place it enriches, so the desk's re-review is the time the
        // place is gone from every list holding it. The overview says how
        // long the oldest has waited (owner, 23 Oct 2026). `reviewed_at` is
        // stamped by the flag itself (savePlace).
        oldest_flagged: rows
          .filter((r) => r.review_status === 'flagged' && r.reviewed_at)
          .reduce((min, r) => (min === null || r.reviewed_at < min ? r.reviewed_at : min), null),
        // Filed by nobody yet — the places themselves, not a number.
        //
        // A count could only ever send the editor to a filtered list to find
        // out which ones; naming them means the answer and the way to fix it
        // arrive together. Which half is missing rides along for the same
        // reason: "no vibe" and "no category" are different jobs, and one
        // word for the pair sends people to the wrong field.
        //
        // Off the rows this already fetched, so it costs no round trip.
        // Capped, because a panel is not a list view: past the cap it says
        // how many more and hands over to the filter.
        unclassified: rows
          .filter((r) => r.needs_classification)
          .map((r) => ({
            slug: r.slug,
            name: r.name_en,
            status: r.review_status,
            no_category: !r.categories?.length,
            no_vibe: !r.vibe_tags?.length,
          })),
        by_category: by('category'),
        by_category_tag: byTag('categories'),
        by_vibe: byTag('vibe_tags'),
        // Both sides, not just the filled one: the empty half is the
        // worklist, and a chip that cannot show its own size is a chip
        // nobody presses first.
        by_threads: countThreads(rows),
        // The machine drafts per language: the review queue the flag is.
        by_machine: countMachine(rows),
      };
    },

    /**
     * The rows behind the Contributors screen: places added from the app that
     * made it all the way through — approved *and* published, because either
     * flag alone is a place nobody can see. Bounded to the window here rather
     * than filtered client-side, so the payload stays a few columns times a
     * month, whatever the catalog grows to.
     *
     * Handles ride along the same way attachSubmitters gets them (no foreign
     * key between places.added_by and profiles.id, so no embed), deduplicated
     * and fetched once for the whole window. A missing profile is tolerated:
     * the screen falls back to a truncated id rather than dropping the rows.
     */
    contributors: async (days = 30) => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (days - 1));
      const rows = await everyRow(() => supabase.from('places')
        .select('added_by, city_id, created_at')
        .eq('channel', 'mobile')
        .eq('review_status', 'approved')
        .eq('is_published', true)
        .not('added_by', 'is', null)
        .gte('created_at', since.toISOString())
        .order('slug'));
      const ids = [...new Set(rows.map((r) => r.added_by))];
      let profiles = {};
      if (ids.length) {
        const { data } = await supabase
          .from('profiles').select('id, handle, full_name').in('id', ids);
        profiles = Object.fromEntries((data ?? []).map((p) => [p.id, p]));
      }
      return { rows, profiles };
    },

    /**
     * Which accounts the desk has made local guides, and where.
     *
     * A Map of user id to a Set of city ids, in which `null` is a member
     * meaning every city — the shape the table uses, kept rather than
     * flattened to a boolean so the board can tell a guide of one city from
     * a guide of all of them. It was a Set of ids while the grant was
     * global; see `20260922100000_local_guides_per_city.sql`.
     *
     * Read whole rather than per row, because the board draws ten at a time
     * and ten round trips to answer ten questions is ten times the wrong
     * shape.
     *
     * `editors manage local guides` is what lets the desk see all of them;
     * an app account reading this same table sees only its own row.
     */
    localGuides: async () => {
      const rows = db(await supabase.from('local_guides').select('user_id, city_id'));
      const byUser = new Map();
      for (const r of rows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set());
        byUser.get(r.user_id).add(r.city_id);
      }
      return byUser;
    },

    /**
     * Grant or take back the role, for one city or for all of them.
     *
     * `cityId` null is the all-cities grant — one row with a null `city_id`,
     * which covers every city including ones added later.
     *
     * Granting deletes the row it is about to write rather than upserting
     * it. The two shapes of uniqueness are partial indexes ("one everywhere
     * row per person", "one row per person per city") and a partial index
     * cannot be named as an ON CONFLICT target, so there is no upsert to
     * write; deleting first is what keeps a second click harmless.
     *
     * Revoking with no city in hand takes every row for that person, city
     * grants included — the box was ticked because they are a guide, and it
     * has just been unticked.
     *
     * Nothing is passed for `added_by`: the column defaults to `auth.uid()`,
     * so the database records which editor did this from the request's own
     * credentials. See `20260919180000_local_guide_granted_by.sql`.
     */
    setLocalGuide: async (userId, on, cityId = null) => {
      const scoped = (q) => (cityId == null ? q.is('city_id', null) : q.eq('city_id', cityId));
      if (on) {
        db(await scoped(supabase.from('local_guides').delete().eq('user_id', userId)));
        db(await supabase.from('local_guides').insert({ user_id: userId, city_id: cityId }));
      } else if (cityId == null) {
        db(await supabase.from('local_guides').delete().eq('user_id', userId));
      } else {
        db(await scoped(supabase.from('local_guides').delete().eq('user_id', userId)));
      }
      return on;
    },

    /** The rows behind the Coverage screen: every published place, all cities
     *  in one round trip — the screen re-cuts per city without refetching.
     *  Published only, because coverage measures what a user can actually
     *  open, not what the desk is still deciding about. */
    coverage: async () => everyRow(() => supabase.from('places')
      .select('slug, name_en, address, neighborhood_en, lat, lng, city_id')
      .eq('is_published', true)
      .order('slug')),
  };
}
