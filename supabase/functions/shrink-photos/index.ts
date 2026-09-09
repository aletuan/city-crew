// Bring the photos in Storage down to the size the app actually draws.
//
// ── why ──
//
// `rehost.ts` copied every Google photo at 1600px, which was what the
// import had always asked Google for, and Google's JPEGs at that width
// weigh half a megabyte; the PNGs among them nearly two. The whole
// catalog came to 1.3 GB, on a plan whose Storage allowance is 1 GB and
// whose egress is 5 GB a month — and every card the app draws now pulls
// its picture from here rather than from Google's CDN.
//
// The app never needs that much. Its widest picture is the detail hero,
// edge to edge on a 3x phone: about 1200 device pixels. So this walks
// the bucket and re-encodes each photo to fit 1200px on its longer side,
// JPEG at a quality the eye cannot tell from the original on a phone.
// PNGs become JPEGs — they were photographs all along, Google just served
// them in the wrong container — and the row is pointed at the new file.
//
// ── the shape of the run ──
//
// ImageMagick, compiled to WebAssembly, is the only image library the
// Edge runtime can load (no native code, so no sharp). It does one photo
// in a few hundred milliseconds of CPU, and a request is allowed two
// seconds of CPU — so a call takes a handful of rows, and the caller
// walks the table with `after`, exactly as `rehost-photos` does. A row
// already small enough is skipped without being decoded, which is what
// makes a second pass over the same rows cheap and the run safe to
// resume anywhere.
//
//   POST { limit?: 3, after?: "<uuid>" }      walk the table in id order
//   POST { ids: ["<uuid>", …] }               exactly these rows
//   → { done, skipped, failed, cursor, bytes_before, bytes_after,
//       rows: [{ id, ms, before, after }], errors: [{ id, error }] }
//
// The second form is the one the backfill used. The database can see
// every object in `storage.objects`, so a `pg_cron` minute picks the
// rows whose files are still big and names them, and nothing is
// downloaded only to be found small.
//
// ── once, and only once ──
//
// A photo this has re-encoded is written back with `shrunk` in its
// object metadata, and the database's selection skips objects that
// carry it. That mark is load-bearing: a JPEG can come out of this
// still above the size the selection uses, and without the mark it was
// picked again the next minute and re-encoded again, losing a little
// each time. Size says whether a file is big; only the mark says it
// has been here.
//
// Who may call it: an editor, or the database with the job's token —
// see `_shared/gate.ts`.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";
import { opsOrEditor } from "../_shared/gate.ts";
import { BUCKET } from "../_shared/rehost.ts";

const wasmBytes = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30")),
);
await initializeImageMagick(wasmBytes);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ops-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const TOKEN_NAME = "shrink-photos";
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 8;

/** Longest side, in pixels. The detail hero on a 3x phone, with a little
 *  to spare; `rehost.ts` asks Google for the same width from now on. */
const MAX_PX = 1200;
const JPEG_QUALITY = 74;
/** A JPEG this small is already what this would produce; leave it be. */
const SMALL_ENOUGH = 240 * 1024;

const extOf = (path: string) => path.slice(path.lastIndexOf(".") + 1).toLowerCase();

/** The photo, re-encoded: fit within MAX_PX, JPEG, metadata dropped once
 *  the orientation it carried has been applied. */
function shrink(bytes: Uint8Array): Uint8Array {
  return ImageMagick.read(bytes, (img) => {
    img.autoOrient();
    if (img.width > MAX_PX || img.height > MAX_PX) img.resize(MAX_PX, MAX_PX);
    img.strip();
    img.quality = JPEG_QUALITY;
    img.format = MagickFormat.Jpeg;
    return img.write((data) => new Uint8Array(data));
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await opsOrEditor(admin, req, TOKEN_NAME))) return json({ error: "not allowed" }, 403);

  let body: { limit?: number; after?: string; ids?: string[] } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || DEFAULT_LIMIT));

  let q = admin.from("place_photos")
    .select("id, storage_path")
    .not("storage_path", "is", null)
    .order("id");
  if (Array.isArray(body.ids)) q = q.in("id", body.ids.slice(0, MAX_LIMIT));
  else q = q.limit(limit);
  if (body.after) q = q.gt("id", body.after);
  const { data: photos, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const store = admin.storage.from(BUCKET);
  const rows: { id: string; ms: number; before: number; after: number }[] = [];
  const errors: { id: string; error: string }[] = [];
  let done = 0, skipped = 0, bytesBefore = 0, bytesAfter = 0;
  let cursor: string | null = null;

  for (const row of photos ?? []) {
    cursor = row.id;
    const path: string = row.storage_path;
    const t0 = performance.now();
    try {
      const { data: blob, error: dlErr } = await store.download(path);
      if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? "no body"}`);
      const original = new Uint8Array(await blob.arrayBuffer());
      const ext = extOf(path);
      bytesBefore += original.length;

      if (ext === "jpg" && original.length <= SMALL_ENOUGH) {
        bytesAfter += original.length;
        skipped++;
        continue;
      }

      const out = shrink(original);
      if (ext === "jpg" && out.length >= original.length) {
        // Already tighter than we would make it — a small photo at a
        // quality below ours. Not worth a write that makes it bigger.
        bytesAfter += original.length;
        skipped++;
        continue;
      }

      // Same file when it was a JPEG; a JPEG beside the old file, and
      // the row moved over, when it was not. The bytes at a public URL
      // change under the app either way, and it is fine: the CDN's
      // cache is an hour, a phone's is until the picture is evicted,
      // and both were showing the same photograph.
      const newPath = ext === "jpg" ? path : path.slice(0, -ext.length) + "jpg";
      const { error: upErr } = await store.upload(newPath, out, {
        contentType: "image/jpeg", upsert: true, metadata: { shrunk: "1" },
      });
      if (upErr) throw new Error(`upload: ${upErr.message}`);
      if (newPath !== path) {
        const { data: { publicUrl } } = store.getPublicUrl(newPath);
        const { error: dbErr } = await admin.from("place_photos")
          .update({ photo_uri: publicUrl, storage_path: newPath }).eq("id", row.id);
        if (dbErr) throw new Error(`place_photos: ${dbErr.message}`);
        await store.remove([path]);
      }
      bytesAfter += out.length;
      done++;
      rows.push({ id: row.id, ms: Math.round(performance.now() - t0), before: original.length, after: out.length });
    } catch (e) {
      errors.push({ id: row.id, error: String((e as Error).message ?? e).slice(0, 200) });
    }
  }

  return json({
    done, skipped, failed: errors.length, cursor,
    bytes_before: bytesBefore, bytes_after: bytesAfter, rows, errors,
  });
});
