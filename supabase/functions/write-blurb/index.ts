// A first draft of a place's blurb, for the desk to read before it saves.
//
// POST { slug } → { desc_vi, desc_en, sources: string[] }
//
// It writes nothing. The desk's Blurb fields are where the words land,
// and the desk's Save is the gate — the one this catalog already has for
// every sentence the app shows. A function that wrote `desc_vi` itself
// would put a model's claim about a park's lake in front of a reader
// before anyone had read it, which is the one thing this must not do.
//
// ── why it exists ──
//
// On 13 Oct 2026, 745 of the 925 live places had no blurb at all — 81%,
// and 87% of the cafés. The Threads skill fills the gap one post at a
// time and tops out at a few places a session; its last rung, when no
// human wrote anything usable, is to compose a short editorial note from
// what is known. This is that rung as a function: the same job, one
// place for its rules, callable from the desk's button and from the
// skill alike. The rungs above it — a person's words, credited — stay
// where they are; a model is never handed somebody's name.
//
// ── blanks only ──
//
// It refuses a place that already has a blurb (409). The job is filling
// 745 blanks, and for a blank "what changed" is always "nothing became
// this", which is why no draft column and no history table exist. A
// blurb worth replacing is replaced by a person who first clears it.
//
// ── what the model is given, and what it is not ──
//
// The row's own facts — names, district, city, kinds, hours, website —
// and, when one can be had, the lead of the place's Wikipedia article,
// in Vietnamese or English, with its URL returned as a source. A
// Wikipedia lead is accepted only when it names the city: "Lake Park"
// and "Park Square" have namesakes on three continents, and the summary
// endpoint returns the most famous one. Nothing from Google beyond what
// the row already holds — the import does not keep reviews, and the
// Places terms say why.
//
// The rules of the prose are the Threads skill's own for a synthesised
// blurb: concrete, every claim something a visitor could check, no
// adjective the facts do not back, no word about how anything tastes,
// no year or figure that is not in the material. The voice is learned
// from the desk's own blurbs, five of the same kinds, sent as examples.
//
// Secrets: ANTHROPIC_API_KEY. Callers: an editor's session, or the
// `write-blurb` ops token for a batch (`_shared/gate.ts`).

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.1";
import { opsOrEditor } from "../_shared/gate.ts";

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

/** Haiku, as `plan-assist` runs on since 11 Oct 2026: two short
 *  paragraphs from a page of facts is the size of job it was moved for. */
const MODEL = "claude-haiku-5-5";

/** Two sentences in two languages is under 200 tokens; the rest is room
 *  for the thinking the model does first. */
const MAX_TOKENS = 1200;

/** How many of the desk's own blurbs the model reads before writing. */
const EXAMPLES = 5;

/** How much of a Wikipedia lead to pass on: the first paragraph or two
 *  carries what a blurb can use; the rest is history the blurb must not. */
const EXTRACT_CHARS = 900;

/** Wikipedia, or nothing: a draft is worth less than a desk left waiting. */
const WIKI_TIMEOUT_MS = 4000;

const SYSTEM = `You write the two-line blurb City Crew shows under a place — "Why go" — for its editors to read, edit and save. Write in the voice of the examples: one or two sentences, 120–260 characters per language, plain and concrete, often a dash between the setting and the reason to go.

Rules, none of which bend:
- Every claim must come from the facts or the article extract given. No invented years, sizes, prices, opening hours or history. If the material is thin, write less.
- No adjective the material does not back. "Shaded" needs trees in the material; "peaceful" needs something that says so.
- Never say how food or drink tastes, and never mention the rating.
- No hashtags, no emoji, no second person ("you") unless the examples use it for the kind of place.
- desc_vi is Vietnamese; desc_en is English written for an English reader, saying the same things — not a word-for-word translation.
- Do not repeat the place's name in the blurb; the screen prints it above.`;

type Row = {
  slug: string;
  name_en: string; name_vi: string;
  city_id: string | null;
  address: string | null;
  neighborhood_en: string | null; neighborhood_vi: string | null;
  categories: string[] | null; vibe_tags: string[] | null;
  opening_hours: string[] | null;
  website: string | null; primary_type: string | null;
  desc_vi: string | null; desc_en: string | null;
};

type Example = { name_en: string; categories: string[] | null; desc_vi: string | null; desc_en: string | null };

const foldLite = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * The lead of the place's Wikipedia article, in one language, or null.
 *
 * Null for anything that is not a plain article about this place: a
 * missing page, a disambiguation page, a lead that never names the city.
 * The last is the one that matters — the endpoint answers "Lake Park"
 * with whichever Lake Park is best known, and a Milwaukee lawn under a
 * Đà Lạt lake would be a confident wrong blurb.
 */
async function wikiLead(lang: "vi" | "en", title: string, cityNames: string[]): Promise<{ text: string; url: string } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WIKI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { signal: ctl.signal, headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const page = await res.json();
    if (page?.type !== "standard" || typeof page.extract !== "string" || !page.extract.trim()) return null;
    const extract = foldLite(page.extract);
    if (!cityNames.some((c) => extract.includes(foldLite(c)))) return null;
    const url = page.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
    return { text: page.extract.trim().slice(0, EXTRACT_CHARS), url };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The desk's own blurbs of the same kinds, as the model's examples. */
function pickExamples(rows: Example[], kinds: string[]): Example[] {
  const same = rows.filter((r) => r.desc_vi && r.desc_en && (r.categories ?? []).some((c) => kinds.includes(c)));
  return same.slice(0, EXAMPLES);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!(await opsOrEditor(admin, req, "write-blurb"))) return json({ error: "editors only" }, 403);

  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    if (!slug) return json({ error: "slug required" }, 400);

    const { data: place } = await admin
      .from("places")
      .select("slug, name_en, name_vi, city_id, address, neighborhood_en, neighborhood_vi, categories, vibe_tags, opening_hours, website, primary_type, desc_vi, desc_en")
      .eq("slug", slug).maybeSingle();
    const row = place as Row | null;
    if (!row) return json({ error: `unknown place: ${slug}` }, 404);
    if (row.desc_vi?.trim() || row.desc_en?.trim()) return json({ error: "has_blurb" }, 409);

    const { data: city } = await admin
      .from("cities").select("name_en, name_vi, short_en, short_vi").eq("id", row.city_id).maybeSingle();
    const cityNames = [city?.name_en, city?.name_vi, city?.short_en, city?.short_vi].filter((s): s is string => !!s);

    // The desk's own voice, read fresh each time so a better blurb written
    // tomorrow is an example the day after. `overlaps` is not in the fake
    // the tests run on; forty rows and a filter here cost nothing.
    const { data: written } = await admin
      .from("places")
      .select("name_en, categories, desc_vi, desc_en")
      .eq("reviewer_source", "editorial").eq("is_published", true)
      .limit(40);
    const kinds = row.categories ?? [];
    const examples = pickExamples((written ?? []) as Example[], kinds);

    const lead = (await wikiLead("vi", row.name_vi, cityNames)) ?? (await wikiLead("en", row.name_en, cityNames));

    const facts = [
      `Name: ${row.name_vi} / ${row.name_en}`,
      `City: ${city?.name_vi ?? row.city_id ?? "?"} / ${city?.name_en ?? ""}`,
      `District: ${row.neighborhood_vi ?? row.neighborhood_en ?? "?"}`,
      `Address: ${row.address ?? "?"}`,
      `Kinds: ${kinds.join(", ") || "?"}`,
      `Vibes: ${(row.vibe_tags ?? []).join(", ") || "?"}`,
      `Google type: ${row.primary_type ?? "?"}`,
      `Hours: ${(row.opening_hours ?? []).join("; ") || "?"}`,
      `Website: ${row.website ?? "?"}`,
    ].join("\n");

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { desc_vi: { type: "string" }, desc_en: { type: "string" } },
            required: ["desc_vi", "desc_en"],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: "user",
        content: [
          "Examples of the voice, from the same kinds of place:",
          ...examples.map((e) => `- ${e.name_en}\n  vi: ${e.desc_vi}\n  en: ${e.desc_en}`),
          "",
          "The place:",
          facts,
          "",
          lead ? `Wikipedia lead (${lead.url}):\n${lead.text}` : "No article extract. Write only from the facts above, and write less rather than more.",
        ].join("\n"),
      }],
    });

    const text = message.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") return json({ error: "model gave no text" }, 502);
    const parsed = JSON.parse(text.text) as { desc_vi: string; desc_en: string };
    console.log("write-blurb", {
      slug, examples: examples.length, wiki: lead?.url ?? null,
      input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens,
    });
    return json({
      desc_vi: parsed.desc_vi.trim(),
      desc_en: parsed.desc_en.trim(),
      sources: lead ? [lead.url] : [],
    });
  } catch (err) {
    console.log("write-blurb failed", (err as Error).message);
    return json({ error: (err as Error).message }, 502);
  }
});
