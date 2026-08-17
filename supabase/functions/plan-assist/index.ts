// The only part of the planner that talks to a model.
//
// `app/src/lib/planner.ts` decides *which* places make a plan and in what
// order — that is arithmetic over the catalog the phone already holds, and
// it stays there. This function decides how the plan *reads*: what to call
// the evening, and one line per stop saying why it is on the list.
//
// POST { action: "narrate", draft, lang, stops: [...] }
//   → { title, stops: [{ slug, why }] }
//
// Secrets (Edge Function settings): ANTHROPIC_API_KEY.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// ── the model never picks a place ──
//
// The prompt receives the stops already chosen and may only write about
// them. `slug` in the output schema is an `enum` of exactly the slugs sent,
// so a made-up place is not a thing the model can return; the loop at the
// bottom checks again anyway, and drops an unknown slug rather than the
// whole answer. Losing one sentence is a worse outcome than losing the
// plan, and both are better than printing a café that does not exist.
//
// ── on the cost cap ──
//
// There isn't one per account, and that is a deliberate copy of what
// `fetch-place`'s `search` action already does and says: capping this would
// need a record of narrate calls, which is state with nothing else to
// justify it, and the exposure is bounded by needing an account at all.
// What *is* capped is the cost of any single call — at most `MAX_STOPS`
// places in, a small `max_tokens` out, and a hard timeout. The daily
// suggestion cap next door works because it can be counted off the `places`
// rows themselves; there is no equivalent row for a plan nobody saved, and
// a cap that counts the wrong thing is worse than an honest absence. If the
// bill ever shows it, the answer is a counter table.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** A day out is five stops and an evening is three; eight leaves room for a
 *  plan the reader has added to without letting one request grow unbounded. */
const MAX_STOPS = 8;

/** Long enough for a name and eight short sentences with the model's own
 *  reasoning in front of them — thinking and text share this budget. Too
 *  small and the answer is cut mid-sentence, which reads as a bug rather
 *  than as a limit. */
const MAX_TOKENS = 2000;

/** Past this the app stops waiting and prints the fallback. A plan the
 *  reader can already see is worth more than a better sentence about it. */
const TIMEOUT_MS = 12_000;

const MODEL = "claude-opus-5";

const LANGS: Record<string, string> = {
  en: "English",
  vi: "Vietnamese",
  ja: "Japanese",
};

/**
 * Fixed, and first in the request, so it can be cached.
 *
 * Everything that varies — the answers, the stops — goes in the user turn
 * below. Prompt caching is a prefix match: one interpolated value up here
 * and every request pays full price for the whole prompt. See
 * `docs/ai-agent-planner.md`.
 */
const SYSTEM = `You name a night out and say why each place is on the list.

You are given a plan that has already been built: the places are chosen, the
order is fixed, and the times are set. You are not choosing anything. Your
only job is the words.

The title:
- Names this specific evening, not the city. "Lakeside and late noodles"
  beats "A night in Hanoi".
- Six words at most. No colons, no emoji, no exclamation marks.
- Draws on what is actually in the plan — the neighbourhood, the kind of
  places, the hour — and never on anything you were not told.

Each "why" line:
- One sentence, under twenty words.
- Says why this place, at this point in the evening, for these people. The
  reader can already see its name, its area and its rating; do not repeat
  them back.
- Says nothing specific about the venue that you were not told. You may
  recognise some of these places; write as if you do not. No dishes, no
  decor, no house speciality, no history, no "famous for" — not even when
  you are sure. What a place is like is the reader's to find out, and a
  sentence that is right about one branch and wrong about another is worse
  than a sentence about the hour and the company.
- Never mentions the plan, the app, or yourself.

Write in the language you are asked for, in the register a friend would use
in that language — not a brochure, not a review site.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Same gate as every other function here: signed in, nothing more. There
  // is no editors check because there is nothing privileged about asking
  // for a sentence.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user?.id) return json({ error: "not signed in" }, 401);

  try {
    const body = await req.json();
    if (body.action !== "narrate") {
      return json({ error: `unknown action: ${body.action}` }, 400);
    }

    const lang = LANGS[String(body.lang ?? "en")] ?? LANGS.en;
    const stops = Array.isArray(body.stops) ? body.stops.slice(0, MAX_STOPS) : [];
    if (!stops.length) return json({ error: "stops required" }, 400);

    // The slugs the model is allowed to name, and the only ones it can:
    // this list becomes the `enum` on the output schema.
    const slugs = stops.map((s: { slug?: unknown }) => String(s.slug ?? "")).filter(Boolean);
    if (!slugs.length) return json({ error: "stops need slugs" }, 400);

    const draft = body.draft ?? {};
    const facts = stops.map((s: Record<string, unknown>, i: number) => [
      `${i + 1}. ${s.slug}`,
      `   name: ${s.name ?? "—"}`,
      `   kind: ${Array.isArray(s.categories) ? s.categories.join(", ") : "—"}`,
      `   area: ${s.neighborhood ?? "—"}`,
      `   arrives: ${s.arrive ?? "—"}`,
      s.rating ? `   rating: ${s.rating}` : null,
    ].filter(Boolean).join("\n")).join("\n");

    const ask = [
      `Language: ${lang}.`,
      `Company: ${draft.company ?? "unstated"}.`,
      `Asked for: ${Array.isArray(draft.categories) ? draft.categories.join(", ") : "anything"}.`,
      `When: ${draft.when === "day" ? "a day out" : "an evening"}${draft.where ? ` around ${draft.where}` : ""}.`,
      "",
      "The stops, in order:",
      facts,
    ].join("\n");

    const anthropic = new Anthropic({ apiKey });

    // Thinking is on by default on this model and shares `max_tokens` with
    // the answer; `effort: "low"` keeps that share small, which is right for
    // a task whose hard part is taste rather than reasoning.
    const message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                stops: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      // Not "a slug" — *these* slugs. The model cannot name a
                      // place that is not in the plan it was handed.
                      slug: { type: "string", enum: slugs },
                      why: { type: "string" },
                    },
                    required: ["slug", "why"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "stops"],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: "user", content: ask }],
      },
      { timeout: TIMEOUT_MS },
    );

    // Checked before the content is read, because a refused request returns
    // a perfectly successful 200 with nothing in it.
    if (message.stop_reason === "refusal") {
      console.log("plan-assist refusal", message.stop_details?.category);
      return json({ title: null, stops: [] });
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ title: null, stops: [] });

    const parsed = JSON.parse(text.text) as {
      title?: unknown;
      stops?: { slug?: unknown; why?: unknown }[];
    };

    // The schema already said this, and it is checked again here. A schema
    // is a request to the model; this is the app's own answer to "could a
    // place the reader never chose end up on their screen".
    const allowed = new Set(slugs);
    const out = (parsed.stops ?? [])
      .map((s) => ({ slug: String(s.slug ?? ""), why: String(s.why ?? "").trim() }))
      .filter((s) => allowed.has(s.slug) && s.why);

    console.log("plan-assist narrate", {
      stops: slugs.length,
      returned: out.length,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read: message.usage.cache_read_input_tokens,
    });

    return json({
      title: typeof parsed.title === "string" ? parsed.title.trim() : null,
      stops: out,
    });
  } catch (err) {
    // The app's fallback is a real plan with a derived name and a line of
    // facts under each stop, so a failure here costs the prose and nothing
    // else. Returning 200 with an empty answer rather than an error is what
    // makes that the *same* code path as a model that had nothing to say.
    console.log("plan-assist failed", (err as Error).message);
    return json({ title: null, stops: [] });
  }
});
