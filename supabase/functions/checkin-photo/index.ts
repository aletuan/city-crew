// Add a photo to one of your check-ins, or take one away (K2 of
// `docs/checkin-photos-plan.md`, owner, 24 Nov 2026).
//
// The only way a file reaches the `checkin-photos` bucket: no client has
// a write policy on it (`20261124230000_checkin_photos.sql`). So every
// rule the plan sets for an upload is here or in the database, and none
// is in the app, which is not the only thing that can call this.
//
//   POST { checkin: "<uuid>", image: "<base64 JPEG>" }
//   → { id, path, position, width, height }
//
//   POST { remove: "<photo uuid>" }
//   → { removed: true }
//
// ── an upload, in order ──
//
//   1. Who: the token's account, never one named in the body.
//   2. How big, before anything is decoded: the base64 of 1 MB at most.
//   3. What: the bytes must be a JPEG (`_shared/jpeg.ts`), at most 1600px
//      on an edge, and they are stored without their metadata — the GPS
//      position a phone writes into EXIF goes here and never reaches the
//      bucket.
//   4. Where: `checkin_photo_slot` says which of the visit's three places
//      is free, or why none may be had — not your visit, full, fifteen
//      today, three hundred in all.
//   5. The file, then the row; if the row is refused, the file is taken
//      back, so nothing is left that no row names.
//
// The path is the owner, the visit and the row's own id, which the
// table's check holds as well; nothing the caller sends goes into it but
// the visit, and that only after step 4 has said the visit is theirs.
//
// ── a removal ──
//
// The caller's own photo only — the service role reads past RLS, so the
// owner is part of the question. The row goes first, so the photo stops
// being readable the moment the request is answered; the file after it.
// A file whose removal fails is an orphan, and `prune-checkin-photos`
// takes those.

import { createClient } from "npm:@supabase/supabase-js@2";
import { http } from "../_shared/http.ts";
import { cleanJpeg } from "../_shared/jpeg.ts";

const { CORS, json } = http();

const BUCKET = "checkin-photos";
/** The bucket's limit (`checkin_photos.sql`): 4,433 local-guide uploads
 *  shrunk the same way average 157 KB and peak at 452 KB. */
export const MAX_BYTES = 1048576;
/** The longest edge the table takes; the app shrinks to 1200. */
export const MAX_EDGE = 1600;
/** The base64 of `MAX_BYTES`, padded: anything longer is refused unread. */
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What `checkin_photo_slot` raises, as the status a caller can act on. */
const REFUSED: Record<string, number> = {
  "photo:not_yours": 403,
  "photo:full": 409,
  "photo:day": 429,
  "photo:account": 429,
};

function bytesOf(b64: string): Uint8Array | null {
  try {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const uid: string | undefined = userData?.user?.id;
  if (!uid) return json({ error: "not signed in" }, 401);

  let body: { checkin?: unknown; image?: unknown; remove?: unknown } = {};
  try { body = await req.json(); } catch (_) { return json({ error: "a JSON body" }, 400); }

  // ── a removal ──
  if (body.remove !== undefined) {
    if (typeof body.remove !== "string" || !UUID.test(body.remove)) return json({ error: "remove: a photo id" }, 400);
    const { data: row, error: readErr } = await admin.from("checkin_photos")
      .select("id, path").eq("id", body.remove).eq("user_id", uid).maybeSingle();
    if (readErr) return json({ error: readErr.message }, 500);
    if (!row) return json({ error: "no such photo" }, 404);
    const { error: delErr } = await admin.from("checkin_photos").delete().eq("id", row.id).eq("user_id", uid);
    if (delErr) return json({ error: delErr.message }, 500);
    await admin.storage.from(BUCKET).remove([row.path]).catch(() => {});
    return json({ removed: true });
  }

  // ── an upload ──
  if (typeof body.checkin !== "string" || !UUID.test(body.checkin)) return json({ error: "checkin: a visit id" }, 400);
  if (typeof body.image !== "string" || body.image.length === 0) return json({ error: "image: base64 JPEG" }, 400);
  if (body.image.length > MAX_BASE64) return json({ error: "too_big" }, 413);
  const raw = bytesOf(body.image);
  if (!raw) return json({ error: "image: base64 JPEG" }, 400);

  const jpeg = cleanJpeg(raw);
  if (!jpeg.ok) return json({ error: jpeg.why }, 415);
  if (jpeg.width > MAX_EDGE || jpeg.height > MAX_EDGE) return json({ error: "too_large" }, 422);

  const { data: position, error: slotErr } = await admin.rpc("checkin_photo_slot", { p_user: uid, p_checkin: body.checkin });
  if (slotErr) {
    const status = REFUSED[slotErr.message];
    return status ? json({ error: slotErr.message }, status) : json({ error: slotErr.message }, 500);
  }

  const id = crypto.randomUUID();
  const path = `${uid}/${body.checkin}/${id}.jpg`;
  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, jpeg.bytes, { contentType: "image/jpeg", upsert: false });
  if (upErr) return json({ error: upErr.message }, 500);

  const row = { id, checkin_id: body.checkin, user_id: uid, position, path, width: jpeg.width, height: jpeg.height, bytes: jpeg.bytes.length };
  const { error: rowErr } = await admin.from("checkin_photos").insert(row);
  if (rowErr) {
    // The file goes back, so nothing is left that no row names. Two
    // uploads racing for one place on a visit end here, one of them.
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: rowErr.message }, 409);
  }

  return json({ id, path, position, width: jpeg.width, height: jpeg.height });
});
