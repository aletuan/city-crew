// The city's cover photograph — one per city, replaced rather than
// collected.
//
// This lives outside api.js on purpose. api.js is the desk's one large
// untested surface (its own test file says so: "until now it had zero
// automated coverage: everything in it ran for the first time in
// production"), and its tests re-import it once per case through a
// cache-busting specifier, so every instance counts separately and the
// file's coverage is an average over instances rather than a total.
// Adding a mechanism there costs coverage whether or not it is tested.
//
// Taking the client as an argument is what makes this testable at all:
// no module mocking, one instance, every branch reachable.

import { removeObjects } from './storage.js';

/** postgrest answers `{ data, error }`; this is api.js's own unwrapper. */
function db({ data, error }) {
  if (error) throw new Error(error.message ?? String(error));
  return data ?? [];
}

/**
 * The city's own cover — one photo, replaced rather than collected.
 *
 * Order: upload the new object, point the row at it, then delete the
 * object it replaced. Deliberately the reverse of `deletePlace`, and
 * for the same reason that rule exists: whichever step fails, the row
 * must never name a file that is not there. Here that means the old
 * file is the thing at risk, and an orphaned object costs storage
 * while a broken row costs the hero.
 *
 * A credit is required. Every photo in this catalog can say who took
 * it — Google's come with `attribution_name` filled in — and a picture
 * somebody handed us is the last one that should arrive anonymous.
 */
async function setCityHeroPhoto({ supabase, bucket }, cityId, blob, filename, { credit, creditUri } = {}) {
  const name = String(credit ?? '').trim();
  if (!name) throw new Error('a credit is required — who took this photo?');

  const rows = db(await supabase.from('cities').select('hero_photo_path').eq('id', cityId).limit(1));
  if (!rows.length) throw new Error('city not found');
  const oldPath = rows[0].hero_photo_path ?? null;

  const safeName = String(filename ?? 'cover').replace(/[^\w.-]/g, '_').slice(0, 60);
  const path = `cities/${cityId}/${Date.now()}-${safeName}.jpg`;

  // `shrunk` for the same reason uploadPhoto sets it: resizeImage has
  // already brought this to the size the hourly pass would.
  const { error: upErr } = await supabase.storage.from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', metadata: { shrunk: '1' } });
  if (upErr) throw new Error(upErr.message);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

  const saved = db(await supabase.from('cities').update({
    hero_photo_uri: publicUrl,
    hero_photo_path: path,
    hero_photo_credit: name,
    hero_photo_credit_uri: (creditUri ?? '').trim() || null,
  }).eq('id', cityId).select('id'));
  if (!saved.length) {
    // The row refused the write, so nothing points at the file we just
    // uploaded. Take it back out rather than leaving it to be found by
    // nobody.
    await removeObjects(supabase.storage.from(bucket), [path]);
    throw new Error('not saved (or not an editor — check the editors table)');
  }

  const files = oldPath && oldPath !== path
    ? await removeObjects(supabase.storage.from(bucket), [oldPath])
    : { removed: 0, left: [] };
  return { ok: true, uri: publicUrl, path, left: files.left };
}

/** Back to the place-based hero: clear the columns, then the file. */
async function clearCityHeroPhoto({ supabase, bucket }, cityId) {
  const rows = db(await supabase.from('cities').select('hero_photo_path').eq('id', cityId).limit(1));
  if (!rows.length) throw new Error('city not found');
  const path = rows[0].hero_photo_path ?? null;

  db(await supabase.from('cities').update({
    hero_photo_uri: null, hero_photo_path: null,
    hero_photo_credit: null, hero_photo_credit_uri: null,
  }).eq('id', cityId).select('id'));

  const files = path ? await removeObjects(supabase.storage.from(bucket), [path]) : { removed: 0, left: [] };
  return { ok: true, left: files.left };
}

/**
 * The two methods, bound to one client, ready to be spread into `api`.
 *
 * A factory rather than two exports so api.js gains no function
 * definitions of its own — `...cityHeroApi({ supabase, bucket })` is the
 * whole of the wiring there, and everything with a branch in it stays in
 * this file where it is reachable from a test.
 */
export const cityHeroApi = (deps) => ({
  setCityHeroPhoto: (cityId, blob, filename, credit) =>
    setCityHeroPhoto(deps, cityId, blob, filename, credit),
  clearCityHeroPhoto: (cityId) => clearCityHeroPhoto(deps, cityId),
});
