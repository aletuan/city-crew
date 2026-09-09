// A Google place photo, copied onto our own Storage.
//
// ── why the copy ──
//
// The import stored Google's `photoUri` — the `lh3.googleusercontent.com`
// link the Places API hands back with `skipHttpRedirect` — and the app
// loaded photographs straight from it. Those links are short-lived. The
// first seed's 350 photos, imported in the second week of August, were
// answering 403 by the second week of September, and the only phone that
// still showed them was the one whose image cache predated the expiry.
// A fresh install, TestFlight or App Store, showed a blank card.
//
// `photo_ref` is the durable name — `places/…/photos/…` — and it can be
// turned back into bytes at any time. So that is what this does: fetch
// the bytes once, put them in the `place-photos` bucket beside the
// dashboard's uploads, and point the row at the copy. The row keeps its
// `source`, its attribution and its place in the order; only where the
// picture lives changes. Idempotent by construction: a row with a
// `storage_path` is already done and is never fetched again.
//
// Called at import time for every new photo, and by `rehost-photos` for
// the ones that predate it.

export const BUCKET = "place-photos";

/**
 * The widest the app ever draws: the detail hero on a 3x phone. The
 * import used to ask for 1600, and the copies came out at half a
 * megabyte each — enough to overrun the Storage plan by the time the
 * catalog was rehosted. `shrink-photos` brought those down to this
 * width; asking Google for it in the first place keeps new photos from
 * needing the same treatment.
 */
const MAX_WIDTH_PX = 1200;

export type RehostRow = {
  id: string;
  photo_ref: string;
  /** The place's slug — the folder the dashboard's uploads already use. */
  slug: string;
};

/**
 * Copy one photo. Resolves to the storage path written; throws with
 * Google's or Storage's own message when either side refuses, leaving
 * the row exactly as it was for a later attempt.
 */
export async function rehostPhoto(
  admin: any,
  apiKey: string,
  { id, photo_ref, slug }: RehostRow,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  // Without `skipHttpRedirect` the media endpoint 302s to the bytes and
  // fetch follows it — one call, no short-lived link ever kept.
  const res = await fetchImpl(
    `https://places.googleapis.com/v1/${photo_ref}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${apiKey}`,
  );
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error("Google returned an empty body");

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${slug}/${id}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbErr } = await admin.from("place_photos")
    .update({ photo_uri: publicUrl, storage_path: path })
    .eq("id", id);
  if (dbErr) throw new Error(`place_photos: ${dbErr.message}`);
  return path;
}
