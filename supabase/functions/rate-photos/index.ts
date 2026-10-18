// rate-photos — how good a photograph is among its own kind, 1 to 10
// (docs/photo-labels.md §12, round 4).
//
// The sibling of `label-photos`, and built the same way: handed
// photograph ids, it reads each one's address and its kind itself, so a
// caller can neither point the model at a URL of its own nor tell it a
// latte is a room. The kind is the photo labels' (`claude-labels`), and
// only a confident food, interior or exterior label is rated — the three
// kinds a cover is drawn from, each with its own criteria
// (`_shared/photoBeauty.ts`). Anything else comes back as `unkinded`.
//
// It writes nothing. Round 4 measures it first: on 60 pairs of
// photographs of one kind at one place, does the higher score pick the
// photograph the owner picks, at 75% or better (§12)? Its scores are
// sealed before the owner answers. Where they would be stored, and
// whether, is decided after that, as the labels' storage was.
//
// Secrets: ANTHROPIC_API_KEY. Callers: an editor's session, or the
// `rate-photos` ops token (`_shared/gate.ts`).

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.1";
import { opsOrEditor } from "../_shared/gate.ts";
import { SCORER as LABELS } from "../_shared/photoLabels.ts";
import { type Answer, type BeautyKind, SCHEMA, VERSION, instructions, isBeautyKind } from "../_shared/photoBeauty.ts";

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

/** Which model answers. Haiku by default, because it is the model the
 *  catalog's labels run on and the one a catalog-wide score would be
 *  affordable with; round 4 seals Opus's scores beside it, to see what the
 *  difference buys. */
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;
const EFFORTS = ["low", "medium"] as const;

/** The answer is a number and a sentence; the rest is thinking, capped as
 *  label-photos caps it, for the same reason: a call that spends its
 *  budget thinking returns no answer at all. */
const MAX_TOKENS = 4000;

/** As label-photos: a request of 24, four at a time. */
const MAX_PHOTOS = 24;
const AT_ONCE = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Photo = { id: string; photo_uri: string | null; storage_path: string | null };
type Label = { photo_id: string; signals: { kind?: unknown; unsure?: unknown } | null };
type Usage = { input_tokens: number; output_tokens: number };

/** Runs `fn` over `items`, `n` at a time, in order — label-photos' own. */
async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
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
  if (!(await opsOrEditor(admin, req, "rate-photos"))) return json({ error: "editors only" }, 403);

  try {
    const body = await req.json();
    const ids: unknown = body.photo_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_PHOTOS || !ids.every((id) => typeof id === "string" && UUID.test(id))) {
      return json({ error: `photo_ids: 1 to ${MAX_PHOTOS} photograph ids` }, 400);
    }
    const model = body.model ?? MODELS[0];
    if (!MODELS.includes(model)) return json({ error: `model: one of ${MODELS.join(", ")}` }, 400);
    const effort = body.effort ?? EFFORTS[0];
    if (!EFFORTS.includes(effort)) return json({ error: `effort: one of ${EFFORTS.join(", ")}` }, 400);

    const { data: rows, error } = await admin.from("place_photos")
      .select("id, photo_uri, storage_path").in("id", ids);
    if (error) throw new Error(error.message);
    const found = new Map((rows as Photo[] ?? []).map((p) => [p.id, p]));
    const missing = (ids as string[]).filter((id) => !found.has(id));
    const unstored = (ids as string[]).filter((id) => found.has(id) && !found.get(id)!.storage_path);
    const stored = (ids as string[]).filter((id) => found.get(id)?.storage_path && found.get(id)!.photo_uri);

    // The kind each one is rated as: the labels', and only when sure.
    const kinds = new Map<string, BeautyKind>();
    if (stored.length) {
      const { data: labels, error: unread } = await admin.from("photo_scores")
        .select("photo_id, signals").eq("scorer", LABELS).in("photo_id", stored);
      if (unread) throw new Error(unread.message);
      for (const l of (labels as Label[] ?? [])) {
        const kind = l.signals?.kind;
        if (l.signals?.unsure !== true && isBeautyKind(kind)) kinds.set(l.photo_id, kind);
      }
    }
    const unkinded = stored.filter((id) => !kinds.has(id));
    const todo = stored.filter((id) => kinds.has(id));

    const anthropic = new Anthropic({ apiKey });
    const usage: Usage = { input_tokens: 0, output_tokens: 0 };
    const results = await pool(todo, AT_ONCE, async (id) => {
      const kind = kinds.get(id)!;
      const params = {
        model,
        max_tokens: MAX_TOKENS,
        system: instructions(kind),
        output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: found.get(id)!.photo_uri! } },
            { type: "text", text: "Score this photograph." },
          ],
        }],
      };
      try {
        // As label-photos: Opus and Sonnet retry a policy decline on the
        // API's fallback; Haiku has none, and a refusal is reported.
        // deno-lint-ignore no-explicit-any
        const message: any = model === "claude-haiku-5-5"
          ? await anthropic.messages.create(params as never)
          : await anthropic.beta.messages.create({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          } as never);
        usage.input_tokens += message.usage?.input_tokens ?? 0;
        usage.output_tokens += message.usage?.output_tokens ?? 0;
        const text = message.content.find((c: { type: string }) => c.type === "text");
        if (message.stop_reason === "refusal" || !text) {
          console.log("rate-photos no answer", { id, model, stop_reason: message.stop_reason });
          return { id, error: `no answer (${message.stop_reason})` };
        }
        const answer = JSON.parse(text.text) as Answer;
        return { id, kind, score: answer.score, why: answer.why.trim() };
      } catch (e) {
        console.log("rate-photos failed", { id, model, error: (e as Error).message });
        return { id, error: (e as Error).message };
      }
    });

    const scores = results.filter((r) => "score" in r);
    const failed = results.filter((r) => "error" in r);
    return json({ v: VERSION, model, effort, scores, failed, missing, unstored, unkinded, usage });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
