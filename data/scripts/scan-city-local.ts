// Run the scan-city import for a city from the laptop, sharing the exact
// logic the deployed edge function uses (supabase/functions/_shared).
// Same result as the dashboard's Scan city button: everything lands as
// pending, unpublished places for human review — nothing is published.
//
// Needs data/.env (SUPABASE_URL, SUPABASE_KEY service key) and the repo
// root .env (GOOGLE_MAPS_API_KEY).
//
// Usage: deno run --allow-net --allow-env --allow-read \
//          scripts/scan-city-local.ts <city-id> [category_key ...]

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  cityBias, importPlace, resolveCity, SCAN_CATEGORIES,
} from "../../supabase/functions/_shared/import-place.ts";

const cityId = Deno.args[0];
if (!cityId) {
  console.error("usage: scan-city-local.ts <city-id> [category_key ...]");
  Deno.exit(1);
}
const only = Deno.args.slice(1);
const cats = only.length ? SCAN_CATEGORIES.filter((c) => only.includes(c.key)) : SCAN_CATEGORIES;

const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_KEY");
if (!apiKey || !url || !key) throw new Error("missing GOOGLE_MAPS_API_KEY / SUPABASE_URL / SUPABASE_KEY");

const admin = createClient(url, key);
const gapi = async (u: string, init?: RequestInit) => {
  const res = await fetch(u, init);
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  return res.json();
};

const MAX_IMPORTS_PER_SCAN = 8;
const PHOTOS_PER_PLACE = 3;

const city = await resolveCity(admin, cityId);
console.log(`Scanning ${city.name_en} (${city.id}) — ${cats.length} categories\n`);

let totalImported = 0;
for (const cat of cats) {
  const query = cat.q.replace("{en}", city.name_en).replace("{vi}", city.name_vi);
  const data = await gapi("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      locationBias: cityBias(city),
    }),
  });
  const found = (data.places ?? []) as any[];

  const ids = found.map((p) => p.id);
  const { data: existing } = ids.length
    ? await admin.from("places").select("google_place_id").in("google_place_id", ids)
    : { data: [] };
  const known = new Set((existing ?? []).map((r: any) => r.google_place_id));
  const fresh = found.filter((p) => !known.has(p.id)).slice(0, MAX_IMPORTS_PER_SCAN);

  const names: string[] = [];
  const errors: string[] = [];
  for (const p of fresh) {
    try {
      const { slug } = await importPlace({
        admin, gapi, apiKey,
        placeId: p.id,
        category: cat.category,
        cityId: city.id,
        vibeTags: [...cat.vibes],
        maxPhotos: PHOTOS_PER_PLACE,
        // Same pipeline as the Edge Function, so the same word for it —
        // a place does not become a different kind of thing because the
        // scan was driven from a laptop.
        source: "scan",
      });
      names.push(slug);
    } catch (err) {
      errors.push(`${p.displayName?.text ?? p.id}: ${(err as Error).message}`);
    }
  }
  totalImported += names.length;
  console.log(`${cat.key.padEnd(18)} found=${found.length} known=${known.size} imported=${names.length}${errors.length ? ` errors=${errors.length}` : ""}`);
  if (names.length) console.log(`${" ".repeat(20)}${names.join(", ")}`);
  for (const e of errors) console.log(`${" ".repeat(20)}! ${e}`);
}

console.log(`\nDone: ${totalImported} new pending places in ${city.name_en} — review them in the dashboard.`);
