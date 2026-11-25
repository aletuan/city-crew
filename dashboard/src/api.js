// Data layer for the curation dashboard. Talks straight to Supabase with the
// anon key + the signed-in editor's session; Row Level Security (see
// supabase/migrations/) is what authorizes every write. Same interface the
// components used against the old localhost Express API.

import { supabase } from './lib/supabase.js';
import { moderationApi } from './api/moderation.js';
import { citiesApi } from './api/cities.js';
import { placesApi } from './api/places.js';
import { progressApi } from './api/progress.js';
import { importsApi } from './api/imports.js';
import { photosApi } from './api/photos.js';

const BUCKET = 'place-photos';

const db = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// functions.invoke wraps non-2xx in a generic message — surface the body.
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Every row a query matches, a thousand at a time.
 *
 * PostgREST answers at most `max_rows` rows a request — 1000 on this
 * project — and says nothing when it stops: the response is a clean 200
 * holding the first thousand. Any read here that wants a whole table was
 * right until the catalog passed that size and has been quietly short
 * since. It passed it on 17 Oct 2026 — 1011 places, and the desk's
 * header read "1000 places · 1000 approved".
 *
 * So the read asks again from where the last page ended, until a page
 * comes back short. `build` makes a fresh query each time — a builder is
 * spent once awaited — and must order the rows totally (end on a unique
 * column), or an offset can skip one row and repeat another between two
 * pages.
 */
const MAX_ROWS = 1000;
async function everyRow(build) {
  const out = [];
  for (let from = 0; ; from += MAX_ROWS) {
    const page = db(await build().range(from, from + MAX_ROWS - 1));
    out.push(...page);
    if (page.length < MAX_ROWS) return out;
  }
}

/**
 * Put a handle on the rows somebody added.
 *
 * Keyed on `added_by`, not `submitted_by`: the first is whoever performed
 * the import — an editor at the desk as much as a visitor on the phone —
 * and the second is the narrower "a visitor suggested this", which the
 * daily cap and the contributor read policy key off. The desk is asking
 * who did it, so it reads the column that answers that.
 *
 * A second query rather than an embed: `places.added_by` points at
 * `auth.users`, and `profiles.id` points at the same place, but there is
 * no foreign key *between the two* — which is what PostgREST needs before
 * it will join them for us. Adding one to satisfy a label would be the
 * schema bending to the dashboard.
 *
 * One round trip per page, only when a page actually holds an attributed
 * row, and the ids are deduplicated first: a person who added six places
 * is one lookup, not six. Failure is silent by design — a missing handle
 * costs a caption, and is not worth failing a page of work over.
 */
async function attachSubmitters(rows) {
  const ids = [...new Set(rows.map((r) => r.added_by).filter(Boolean))];
  if (!ids.length) return rows;
  const { data } = await supabase
    .from('profiles').select('id, handle, full_name').in('id', ids);
  const by = Object.fromEntries((data ?? []).map((p) => [p.id, p]));
  for (const r of rows) r.submitter = by[r.added_by] ?? null;
  return rows;
}

// What every part is handed: the client, and the plumbing above.
const parts = { supabase, db, invoke, everyRow, attachSubmitters, BUCKET };

/**
 * The desk's data layer, one object as the components have always used
 * it, put together from one file per aggregate under `api/` (25 Nov
 * 2026; until then all 800 lines were here). Spread in the order the
 * methods used to stand.
 */
export const api = {
  ...moderationApi(parts),
  ...citiesApi(parts),
  ...placesApi(parts),
  ...progressApi(parts),
  ...importsApi(parts),
  ...photosApi(parts),
};

// Client-side resize: longest edge ≤ 1200px, JPEG 0.8 — the size the app
// draws (the detail hero on a 3x phone) and the size `shrink-photos`
// brings every Google photo to, so an upload lands at the same weight as
// the rest of the catalog instead of being the heaviest file on the card.
export async function resizeImage(file, maxEdge = 1200) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}
