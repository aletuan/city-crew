// Photos on the reader's own visits: read, signed, sent, taken away
// (K3 of `docs/checkin-photos-plan.md`).
//
// Reading is the table, which a client may read for its own rows only
// (`20261124230000_checkin_photos.sql`). Signing is Storage, which signs
// only what the bucket's read policy lets the caller see. Sending and
// taking away are the `checkin-photo` Edge Function, the one door into
// the bucket: no client may write it.

import type { CheckinPhoto } from '../checkin';
import { PhotoError, photoRefusalOf } from '../checkin';
import { supabase } from '../supabase';

const BUCKET = 'checkin-photos';
/**
 * How long a link lives: an hour. Long enough for a sheet or a page to be
 * looked at; short enough that a link copied out of the app stops working
 * the same afternoon — which is the point of a private bucket.
 */
export const SIGNED_FOR_S = 3600;

/** A visit's photos, in order, the hidden among them marked. */
export async function fetchCheckinPhotos(checkinId: string): Promise<CheckinPhoto[]> {
  const { data, error } = await supabase
    .from('checkin_photos')
    .select('id, path, width, height, hidden_at')
    .eq('checkin_id', checkinId)
    .order('position');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, path: r.path, width: r.width, height: r.height, hidden: r.hidden_at != null,
  }));
}

/**
 * Links for the given paths, by path. A path the bucket would not sign —
 * hidden, or not the caller's to see — is simply missing from the answer:
 * a tile without its picture, not an error over the whole sheet.
 */
export async function signCheckinPhotos(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls([...paths], SIGNED_FOR_S);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { path: string | null; signedUrl: string | null; error: string | null }[]) {
    if (r.path && r.signedUrl && !r.error) out[r.path] = r.signedUrl;
  }
  return out;
}

/**
 * The refusal in a failed call: its status and the function's `error`
 * code. The body is a `Response` on some supabase-js versions and parsed
 * already on others (`lib/suggest`'s `bodyOf` reads both the same way;
 * not imported, because `lib/suggest` imports from `lib/data` and the
 * other way round would be a cycle).
 */
async function refusal(error: unknown): Promise<PhotoError> {
  const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown>; body?: unknown } }).context;
  let body: unknown = ctx?.body;
  if (typeof ctx?.json === 'function') {
    try { body = await ctx.json(); } catch { /* not JSON, or read already */ }
  }
  const code = (body as { error?: unknown } | undefined)?.error;
  return new PhotoError(photoRefusalOf(ctx?.status, typeof code === 'string' ? code : undefined));
}

/** Send one photo, a base64 JPEG, to a visit of the reader's. */
export async function uploadCheckinPhoto(checkinId: string, image: string): Promise<CheckinPhoto> {
  const { data, error } = await supabase.functions.invoke('checkin-photo', { body: { checkin: checkinId, image } });
  if (error) throw await refusal(error);
  const r = data as { id: string; path: string; width: number; height: number };
  return { id: r.id, path: r.path, width: r.width, height: r.height };
}

/** Take one of the reader's photos away. */
export async function removeCheckinPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('checkin-photo', { body: { remove: photoId } });
  if (error) throw await refusal(error);
}
