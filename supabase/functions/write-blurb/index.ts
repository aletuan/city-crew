// A first draft of a place's blurb, for the desk to read before it saves.
//
// POST { slug }             → { desc_vi, desc_en, desc_ja, sources: string[], photos: number }
// POST { slug, mode: 'ja' } → { desc_ja }
// POST { slug, mode: 'zh' } → { desc_zh }
// POST { slug, mode: 'zh-Hant' } → { 'desc_zh-Hant' }
//   …and, when the Chinese wrote a name against the rule twice over, `names_lost`.
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
// every photograph the catalog holds of the place, and, when one can be
// had, the lead of the place's Wikipedia article, in Vietnamese or
// English, with its URL returned as a source. A Wikipedia lead is
// accepted only when it names the city: "Lake Park" and "Park Square"
// have namesakes on three continents, and the summary endpoint returns
// the most famous one. Nothing from Google beyond what the row already
// holds — the import does not keep reviews, and the Places terms say why.
//
// The photographs are the material that matters, and the first cut
// (13 Oct 2026) did without them. Run on two parks, with no Wikipedia
// article for either, it wrote what it had — the district, "open 24
// hours", the vibe tags — and both drafts read as any park anywhere.
// Thương Bạc's riverbank and APEC's sculpture garden were in the
// catalog's photographs the whole time. The Threads skill's own rule for
// a synthesised blurb is written around photographs: "no adjective you
// cannot point at in a frame". So the model is shown the frames.
//
// The rules of the prose are that skill's: concrete, every claim
// something a visitor could check, no adjective the facts or the
// photographs do not back, no word about how anything tastes, no year
// or figure that is not in the material. The voice is learned from the
// desk's own blurbs, five of the same kinds, sent as examples — picked
// by the database, not by the function: the first cut read forty
// editorial rows in whatever order Postgres returned them and filtered
// here, and with 111 such rows (13 Oct 2026) the three bookshops in one
// batch got no example at all while every café got five. A Japanese
// example is one a person wrote: a `machine` draft teaching the next
// draft its register is a loop that converges on nothing.
//
// ── three languages, since 13 Oct 2026 ──
//
// The first cut wrote Vietnamese and English, and the desk could not
// even show the Japanese field (it listed EN and VI by hand until #918).
// 837 of 940 live places had no Japanese blurb, and every draft this
// wrote added one more. So the model writes all three in one call: the
// third language costs a few hundred output tokens on a request that
// already carries the photographs, against a backlog that would
// otherwise grow in a language nobody was writing. The Japanese is
// written for a Japanese reader from the same material, not translated
// from the English — the examples the desk wrote are the model for that
// too, where they have a JA slot. It is machine prose by construction;
// the desk reads it before Save like the other two, and marking it as
// machine for a later review pass is the content-schema work's to add.
//
// ── the ja mode (13 Oct 2026) ──
//
// 110 live places carry an English blurb and no Japanese one, written
// before the third language was asked for. They are not blanks — the
// mode above refuses them, rightly — and they are not translation jobs
// for a person: 48 of them are the desk's own words or Google's. So
// `mode: 'ja'` is the mirror image: it requires a blurb and refuses a
// row that already has Japanese (column or object), takes no Wikipedia
// lead, reads only the examples that carry a JA line a person wrote,
// and asks for the one field. The 42 credited Threads quotations are
// left out of the batch by the caller, not here: a translation under
// somebody's handle is theirs to decline, and the function cannot know
// who is calling.
//
// The blurb is the only material, and the English blurb when there is
// one. The first cut sent the photographs too, "so a word the blurb
// uses can be checked against what it names", and the full block of
// facts, under the same system prompt as the full mode — which says the
// photographs are the best material and every claim may come from the
// facts. The model did as told: of the first 80 drafts, three grew sofas
// and brass lamps off the frames, ten put the opening hours into a blurb
// whose English never mentions them. So this mode has a system prompt of
// its own, sees no frame, no hours and no address, and is handed one
// language: the English, because that is what a Japanese reader is shown
// when there is no Japanese (`spokenIn` falls ja → en → vi), so the
// translation must be of that and not a union of the two — the first
// drafts merged a Vietnamese sentence and an English one into a third
// blurb longer than either. Vietnamese only when the English is blank.
//
// ── the zh mode (21 Oct 2026) ──
//
// The same translation into Simplified Chinese, for the fourth language
// (#1104–#1110). One table below (`TRANSLATE`) holds what differs — the
// instructions and the reader they name — so a fifth language is a row.
// Its own rule for names, the owner's, and the checks below hold it: a
// city or a landmark with a Chinese name of its own takes it (河内,
// 还剑湖), and every other name keeps the blurb's Latin (Nguyễn Huệ, not
// 阮惠街). `_shared/latinNames.ts` says why, and lists them. No Chinese a person wrote
// exists yet to show as an example, so the first drafts are made from
// the rules alone; the examples join as the desk writes them.
//
// ── the zh-Hant mode (21 Oct 2026) ──
//
// Traditional Chinese, for a reader in Taiwan (#1113): the fifth row.
// Translated from the English as the others are, not converted from the
// Simplified draft — that is a machine draft of a machine draft, and the
// converter the interface uses knows words, not a sentence's register.
// The instructions name Taiwan's vocabulary because a model asked for
// "Traditional Chinese" alone writes the mainland's words in Traditional
// characters (視頻, 信息), which is the mistake the interface's
// converter exists to avoid. The key is the app's, `zh-Hant`, hyphen and
// all: it is the `i18n` key the desk folds it into.
//
// ── the names, checked (21 Oct 2026) ──
//
// The rule was in both Chinese instructions, and the model kept breaking
// it: 68 of the 257 Simplified blurbs written that morning had lost a
// name the English carried (Nguyễn Huệ as 阮惠街), and the first
// Traditional drafts made Long Hai 長海. Asked once more, told which, it
// kept them. So a Chinese draft is read back against the blurb
// (`_shared/latinNames.ts` says what a name is and how each is written),
// and one that wrote a name against the rule is asked for once more.
// A second miss is returned all the same, with the names as they should
// read listed in `names_lost`: the desk shows them, and a batch keeps
// what it had.
//
// The rule's first form was Latin for every name, a city included. Its
// second, the same evening, gave cities and landmarks their Chinese
// names, and the instructions could not have said which landmark has one
// without a list — a model asked to judge would write 阮惠街 again, since
// that is a Chinese name too. So the request lists each name in the blurb
// with the form to write, and the check reads the same list.
//
// ── the names in Japanese (21 Oct 2026) ──
//
// Japanese writes a place the way its guides and travel sites do, in
// katakana: ハノイ, ホアンキエム湖, グエンフエ通り; a venue keeps the name
// on its sign. The instructions said Latin until the owner ruled, and the
// model had mostly ignored them: of the 435 Japanese blurbs that day, 28
// wrote a street, a district or a city in Latin ("Pasteur通り", "Da Lat
// 中心部") and the rest wrote theirs in katakana. The Latin is not lost
// to anyone: the address prints beneath the blurb in Latin, which is what
// a map and a driver need, and search reads every language's fields at
// once, so "Pasteur" still finds the bar.
//
// Not checked like the Chinese. A katakana form cannot be read back to
// the Latin it stands for without a table of every street, and the check
// that would stand in — no Vietnamese letters left — would flag the
// venues and the menus, which keep theirs.
//
// Secrets: ANTHROPIC_API_KEY. Callers: an editor's session, or the
// `write-blurb` ops token for a batch (`_shared/gate.ts`).

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.1";
import { opsOrEditor } from "../_shared/gate.ts";
import { type Chinese, chineseNames, namesLost } from "../_shared/latinNames.ts";

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

/**
 * The answer is small — three languages of two sentences is under 300
 * tokens, one language under 200 — and the rest is the thinking the model
 * does first, which this limit also caps. At 1200 the 13 Oct 2026 batch of
 * 80 ja calls lost twelve: thinking ran 60–1191 tokens on the calls that
 * came back, and the ones that did not had spent the whole budget on it,
 * arriving as no text block or a JSON string cut mid-word. Two rows did
 * that four times each. Three times the longest run seen; a token is
 * billed only when used, so the room costs nothing on the short calls.
 */
const MAX_TOKENS = 4000;

/** How many of the desk's own blurbs the model reads before writing. */
const EXAMPLES = 5;

/** How much of a Wikipedia lead to pass on: the first paragraph or two
 *  carries what a blurb can use; the rest is history the blurb must not. */
const EXTRACT_CHARS = 900;

/** Wikipedia, or nothing: a draft is worth less than a desk left waiting. */
const WIKI_TIMEOUT_MS = 4000;

/**
 * Every photograph the place has, up to this. The catalog's largest
 * gallery held 18 on 13 Oct 2026 and the median 6, so this is "all of
 * them" with room, and a bound on what one request can cost: at Haiku's
 * rate eighteen frames are about three tenths of a cent.
 *
 * Only frames in the catalog's own Storage. A row whose copy failed
 * still points at Google's short-lived link (`storage_path` null, three
 * such photos today), and a link that has since died would fail the
 * whole call rather than one frame.
 */
const PHOTOS = 20;

const SYSTEM = `You write the two-line blurb City Crew shows under a place — "Why go" — for its editors to read, edit and save. Write in the voice of the examples: one or two sentences, 120–260 characters per language, plain and concrete, often a dash between the setting and the reason to go.

Rules, none of which bend:
- Every claim must come from the photographs, the facts or the article extract given. No invented years, sizes, prices, opening hours or history. If the material is thin, write less.
- The photographs are the best material you have. Say what they show — the water, the trees, the paving, the building, the light, how people use the place — and nothing they do not.
- No adjective the material does not back. "Shaded" needs trees in the material; "peaceful" needs something that says so.
- Never say how food or drink tastes, and never mention the rating.
- No hashtags, no emoji, no second person ("you") unless the examples use it for the kind of place.
- desc_vi is Vietnamese; desc_en is English written for an English reader, saying the same things — not a word-for-word translation.
- desc_ja is Japanese written for a Japanese reader from the same material, in the register of the examples' Japanese where they have it: plain, です・ます. Places as a Japanese guide writes them, in katakana: a city, a district, a street, a landmark — ハノイ, ホアンキエム湖, グエンフエ通り. A venue's own name, and any word on its sign, as the sign spells it.
- Do not repeat the place's name in the blurb; the screen prints it above.`;

/** The ja mode's instructions: a translation, with nothing to draw on
 *  but the sentence in front of it. Separate from SYSTEM because that
 *  one licenses the facts and the frames, and under it the model used
 *  them (see the header). */
const SYSTEM_JA = `You translate the two-line blurb City Crew shows under a place — "Why go" — into Japanese, for its editors to read, edit and save.

Rules, none of which bend:
- The blurb you are given is the only material. Say what it says and no more: no detail, fact, figure or adjective it does not carry, even one you know to be true of the place.
- Keep its length and its shape: one or two sentences, a dash where it has one.
- Japanese for a Japanese reader, in the register of the examples: plain, です・ます. Places as a Japanese guide writes them, in katakana: a city, a district, a street, a landmark — ハノイ, ホアンキエム湖, グエンフエ通り. A venue's own name, and any word on its sign, as the sign spells it.
- No hashtags, no emoji. Do not repeat the place's name; the screen prints it above.`;

/** The zh mode's instructions: the ja mode's, for a Chinese reader. */
const SYSTEM_ZH = `You translate the two-line blurb City Crew shows under a place — "Why go" — into Simplified Chinese, for its editors to read, edit and save.

Rules, none of which bend:
- The blurb you are given is the only material. Say what it says and no more: no detail, fact, figure or adjective it does not carry, even one you know to be true of the place.
- Keep its length and its shape: one or two sentences, a dash where it has one.
- Simplified Chinese for a reader from mainland China: plain and concrete, Chinese punctuation, a space between Chinese and Latin letters.
- Names follow one rule. A city, and a landmark with a Chinese name of its own, takes that name: 河内, 胡志明市, 还剑湖, 墨尔本. Every other name — a street, a district, a building, a venue — stays exactly as the blurb spells it, in the Latin alphabet: Nguyễn Huệ, never 阮惠街. An address keeps its street as written; only its number may move. The request lists the blurb's names and how each is written: write them so.
- No hashtags, no emoji. Do not repeat the place's name; the screen prints it above.`;

/** The zh-Hant mode's instructions: the zh mode's, for a reader in
 *  Taiwan, in Taiwan's words. */
const SYSTEM_HANT = `You translate the two-line blurb City Crew shows under a place — "Why go" — into Traditional Chinese as written in Taiwan, for its editors to read, edit and save.

Rules, none of which bend:
- The blurb you are given is the only material. Say what it says and no more: no detail, fact, figure or adjective it does not carry, even one you know to be true of the place.
- Keep its length and its shape: one or two sentences, a dash where it has one.
- Traditional Chinese for a reader from Taiwan, in Taiwan's vocabulary and not the mainland's in Traditional characters: 影片 not 視頻, 資訊 not 信息, 品質 not 質量, 計畫 not 計劃, 捷運 for a metro. Plain and concrete, full-width punctuation, 「」 for quotation marks, a space between Chinese and Latin letters.
- Names follow one rule. A city, and a landmark with a Chinese name of its own, takes that name as Taiwan writes it: 河內, 胡志明市, 還劍湖, 墨爾本. Every other name — a street, a district, a building, a venue — stays exactly as the blurb spells it, in the Latin alphabet: Nguyễn Huệ, never 阮惠街. An address keeps its street as written; only its number may move. The request lists the blurb's names and how each is written: write them so.
- No hashtags, no emoji. Do not repeat the place's name; the screen prints it above.`;

/** The languages a blurb is translated into: each one's instructions,
 *  and the reader the request names. */
const TRANSLATE = {
  ja: { system: SYSTEM_JA, reader: "a Japanese reader" },
  zh: { system: SYSTEM_ZH, reader: "a Chinese reader" },
  "zh-Hant": { system: SYSTEM_HANT, reader: "a reader in Taiwan" },
} as const;
type Lang = keyof typeof TRANSLATE;
/** The languages whose drafts are read back for the names. */
const checked = (l: Lang): l is Chinese => l === "zh" || l === "zh-Hant";
const isLang = (m: unknown): m is Lang => typeof m === "string" && Object.hasOwn(TRANSLATE, m);

type Row = {
  id: string;
  slug: string;
  name_en: string; name_vi: string;
  city_id: string | null;
  address: string | null;
  neighborhood_en: string | null; neighborhood_vi: string | null;
  categories: string[] | null; vibe_tags: string[] | null;
  opening_hours: string[] | null;
  website: string | null; primary_type: string | null;
  desc_vi: string | null; desc_en: string | null;
  desc_ja: string | null;
  i18n: Partial<Record<Lang, { desc?: string | null } | null>> | null;
};

type Example = {
  name_en: string; categories: string[] | null;
  desc_vi: string | null; desc_en: string | null;
  i18n: Partial<Record<Lang, { desc?: string | null; machine?: boolean } | null>> | null;
};

/** The example's blurb in one language, when a person wrote it: the
 *  object's entry, never the mirrored column (gone with the trigger one
 *  day), and not a `machine` draft nobody has read. */
const exampleIn = (e: Example, lang: Lang): string | null => {
  const entry = e.i18n?.[lang];
  return entry && !entry.machine && entry.desc?.trim() ? entry.desc.trim() : null;
};

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

/** The desk's own blurbs of the same kinds, as the model's examples.
 *  The query already narrows to the kinds (`overlaps`); the check here
 *  is what a test can see, and costs nothing on forty rows. */
function pickExamples(rows: Example[], kinds: string[], lang: Lang | null = null): Example[] {
  const same = rows.filter((r) => r.desc_vi && r.desc_en && (!lang || exampleIn(r, lang))
    && (r.categories ?? []).some((c) => kinds.includes(c)));
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
    if (body.mode != null && !isLang(body.mode)) return json({ error: "unknown mode" }, 400);
    // The language asked for, or null for a full draft from the material.
    const lang: Lang | null = isLang(body.mode) ? body.mode : null;
    const mode = lang ?? "full";

    const { data: place } = await admin
      .from("places")
      .select("id, slug, name_en, name_vi, city_id, address, neighborhood_en, neighborhood_vi, categories, vibe_tags, opening_hours, website, primary_type, desc_vi, desc_en, desc_ja, i18n")
      .eq("slug", slug).maybeSingle();
    const row = place as Row | null;
    if (!row) return json({ error: `unknown place: ${slug}` }, 404);
    const hasBlurb = !!(row.desc_vi?.trim() || row.desc_en?.trim());
    // Japanese through either door: the object, or the column the trigger
    // still mirrors it into. Every later language has the object alone.
    const hasLang = lang && !!(row.i18n?.[lang]?.desc?.trim() || (lang === "ja" && row.desc_ja?.trim()));
    if (!lang && hasBlurb) return json({ error: "has_blurb" }, 409);
    if (lang && !hasBlurb) return json({ error: "no_blurb" }, 409);
    if (hasLang) return json({ error: `has_${lang}` }, 409);

    const { data: city } = await admin
      .from("cities").select("name_en, name_vi, short_en, short_vi").eq("id", row.city_id).maybeSingle();
    const cityNames = [city?.name_en, city?.name_vi, city?.short_en, city?.short_vi].filter((s): s is string => !!s);

    // The desk's own voice, read fresh each time so a better blurb written
    // tomorrow is an example the day after. Narrowed to the kinds by the
    // database, so forty rows are forty of the right kind. Ordered by
    // slug, not by date: a nightly job touches `updated_at` on every row,
    // so "newest" means nothing, and a stable order means the same place
    // drafts the same way twice.
    const kinds = row.categories ?? [];
    const { data: written } = await admin
      .from("places")
      .select("name_en, categories, desc_vi, desc_en, i18n")
      .eq("reviewer_source", "editorial").eq("is_published", true)
      .overlaps("categories", kinds)
      .order("slug")
      .limit(40);
    const examples = pickExamples((written ?? []) as Example[], kinds, lang);

    // Cover first, then the gallery's own order, so the frame the app
    // leads with is the one the model reads first.
    const { data: shots } = lang ? { data: [] } : await admin
      .from("place_photos")
      .select("photo_uri, storage_path")
      .eq("place_id", row.id).eq("is_hidden", false)
      .order("is_cover", { ascending: false }).order("sort_order")
      .limit(PHOTOS);
    const photos = ((shots ?? []) as { photo_uri: string; storage_path: string | null }[])
      .filter((ph) => ph.storage_path && ph.photo_uri)
      .map((ph) => ph.photo_uri);

    // The blurb is the material when translating; an article would be a
    // second source the translation could drift towards and the blurb never had.
    const lead = lang
      ? null
      : (await wikiLead("vi", row.name_vi, cityNames)) ?? (await wikiLead("en", row.name_en, cityNames));

    // In the ja mode the row's facts stop at the name and the city — what
    // the names rule and the register need. The first batch had
    // the full block, and 10 of 66 drafts worked the opening hours into a
    // blurb that in English never mentions them: hours go stale and a
    // blurb is not re-synced, which is why the desk's own blurbs leave
    // them out. The same door the photographs went out of (#925).
    const facts = [
      `Name: ${row.name_vi} / ${row.name_en}`,
      `City: ${city?.name_vi ?? row.city_id ?? "?"} / ${city?.name_en ?? ""}`,
      ...(lang ? [] : [
      `District: ${row.neighborhood_vi ?? row.neighborhood_en ?? "?"}`,
      `Address: ${row.address ?? "?"}`,
      `Kinds: ${kinds.join(", ") || "?"}`,
      `Vibes: ${(row.vibe_tags ?? []).join(", ") || "?"}`,
      `Google type: ${row.primary_type ?? "?"}`,
      `Hours: ${(row.opening_hours ?? []).join("; ") || "?"}`,
      `Website: ${row.website ?? "?"}`,
      ]),
    ].join("\n");

    // What a translation is of: the English, or the Vietnamese when there
    // is none. In Chinese, its names too, each with the form to write.
    const source = row.desc_en?.trim() || row.desc_vi?.trim() || "";
    const own = [row.name_en, row.name_vi];
    const names = lang && checked(lang) ? chineseNames(source, lang, own) : [];

    const anthropic = new Anthropic({ apiKey });
    const request = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: lang ? TRANSLATE[lang].system : SYSTEM,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: lang
            ? {
              type: "object",
              properties: { [`desc_${lang}`]: { type: "string" } },
              required: [`desc_${lang}`],
              additionalProperties: false,
            }
            : {
              type: "object",
              properties: { desc_vi: { type: "string" }, desc_en: { type: "string" }, desc_ja: { type: "string" } },
              required: ["desc_vi", "desc_en", "desc_ja"],
              additionalProperties: false,
            },
        },
      },
      messages: [{
        role: "user",
        content: [
          ...(photos.length
            ? [{ type: "text" as const, text: `${photos.length} photograph(s) of the place, the cover first:` }]
            : []),
          ...photos.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
          {
            type: "text" as const,
            text: [
              // No heading over nothing: Chinese has no example a person
              // wrote yet, and an empty list would read as a cue.
              ...(examples.length ? ["Examples of the voice, from the same kinds of place:"] : []),
              ...examples.map((e) => lang
                ? `- ${e.name_en}\n  en: ${e.desc_en}\n  ${lang}: ${exampleIn(e, lang)}`
                : `- ${e.name_en}\n  vi: ${e.desc_vi}\n  en: ${e.desc_en}${exampleIn(e, "ja") ? `\n  ja: ${exampleIn(e, "ja")}` : ""}`),
              ...(examples.length ? [""] : []),
              "The place:",
              facts,
              "",
              ...(lang
                ? [
                  "The blurb, as the desk wrote it:",
                  `${row.desc_en?.trim() ? "en" : "vi"}: ${source}`,
                  "",
                  ...(names.length
                    ? ["Its names, each as you write it:", ...names.map((n) => `- ${n.name} → ${n.forms[0]}`), ""]
                    : []),
                  `Write desc_${lang}: this blurb for ${TRANSLATE[lang].reader} — what it says and no more.`,
                ]
                : [
                  lead ? `Wikipedia lead (${lead.url}):\n${lead.text}` : "No article extract.",
                  photos.length ? "" : "No photographs either. Write only from the facts above, and write less rather than more.",
                ]),
            ].join("\n"),
          },
        ],
      }],
    };
    const message = await anthropic.messages.create(request);

    // The stop reason is the one word that says which way a reply went
    // wrong — `max_tokens` is the budget, `refusal` is the material — and
    // without it twelve failures in one batch read as one.
    const text = message.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") {
      console.log("write-blurb no text", { slug, mode, stop_reason: message.stop_reason, output_tokens: message.usage.output_tokens });
      return json({ error: `model gave no text (${message.stop_reason})` }, 502);
    }
    let parsed: { desc_vi?: string; desc_en?: string; desc_ja?: string } & Partial<Record<`desc_${Lang}`, string>>;
    try {
      parsed = JSON.parse(text.text);
    } catch (e) {
      console.log("write-blurb bad json", { slug, mode, stop_reason: message.stop_reason, output_tokens: message.usage.output_tokens });
      return json({ error: `${(e as Error).message} (${message.stop_reason})` }, 502);
    }
    console.log("write-blurb", {
      slug, mode, examples: examples.length, photos: photos.length, wiki: lead?.url ?? null,
      input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens,
    });
    const field = `desc_${lang}` as const;
    if (lang && checked(lang)) {
      const first = (parsed[field] ?? "").trim();
      const lost = namesLost(source, first, lang, own);
      if (!lost.length) return json({ [field]: first });
      const again = await anthropic.messages.create({
        ...request,
        messages: [
          ...request.messages,
          { role: "assistant" as const, content: text.text },
          {
            role: "user" as const,
            content: `These names are not in your ${field} as the list writes them: ${lost.join(", ")}. ` +
              `Write ${field} again with every one of them exactly so.`,
          },
        ],
      });
      const retry = again.content.find((c) => c.type === "text");
      let second = first;
      try {
        if (retry?.type === "text") second = (JSON.parse(retry.text)[field] ?? "").trim() || first;
      } catch (_) { /* the first draft stands */ }
      const still = namesLost(source, second, lang, own);
      console.log("write-blurb names", { slug, mode, lost, still });
      return json(still.length ? { [field]: second, names_lost: still } : { [field]: second });
    }
    if (lang) return json({ [field]: (parsed[field] ?? "").trim() });
    return json({
      desc_vi: (parsed.desc_vi ?? "").trim(),
      desc_en: (parsed.desc_en ?? "").trim(),
      desc_ja: (parsed.desc_ja ?? "").trim(),
      sources: lead ? [lead.url] : [],
      photos: photos.length,
    });
  } catch (err) {
    console.log("write-blurb failed", (err as Error).message);
    return json({ error: (err as Error).message }, 502);
  }
});
