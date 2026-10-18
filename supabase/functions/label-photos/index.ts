// label-photos — the photo labels (docs/photo-labels.md), for photographs
// the photo-labels skill has not seen.
//
// The skill labels the catalog in a Claude session, from contact sheets,
// and is how the backfill and the measuring rounds are done. This is the
// other half: a photograph added tomorrow should not wait for somebody to
// open a session. It is step 2b, and until its agreement with the owner is
// measured it is reached only by an editor or the `label-photos` ops token
// — the app does not call it yet (§10, rule 3).
//
// What it is handed: photograph ids. It reads each one's address itself,
// so a caller cannot point the model at a URL of its own, and it labels
// only photographs stored in our bucket: a Google link with no
// `storage_path` is short-lived, and one dead link would cost a call.
//
// Two modes, by `write`:
// - true (the default): photographs that already carry a complete label
//   at the current VERSION are skipped, so calling twice costs nothing,
//   and the rest are written as the `claude-labels` scorer with
//   `"by": "fn"` and the model, beside the skill's `"by": "skill"`.
// - false: every photograph is labelled and nothing is written. This is
//   how the function is measured — on round 2's and round 3's photographs,
//   which the owner has answered — before it is let near the catalog.
//
// A write replaces the row's signals rather than merging them as the
// skill's write does: the function only writes rows that are missing or
// incomplete, and it writes every key of the current version, so there is
// nothing newer in such a row for a merge to keep.
//
// Secrets: ANTHROPIC_API_KEY. Callers: an editor's session, or the
// `label-photos` ops token (`_shared/gate.ts`).

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.1";
import { opsOrEditor } from "../_shared/gate.ts";
import { ATTRS, type Answer, DEFINITIONS, SCHEMA, SCORER, VERSION, toSignals } from "../_shared/photoLabels.ts";

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

/** Which model answers. Opus 5.5 by default; the measurement on round 2
 *  and round 3 runs the same photographs through each of these, and which
 *  one the catalog gets is the owner's call on the agreement and the cost
 *  per photograph it measured — the reason a caller may name one. */
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;
const MODEL = MODELS[0];

/** Effort: `low` by default — one photograph, one enum and six
 *  yes-or-no questions is the size of job low is for — and `medium` to
 *  measure whether more thought buys agreement. */
const EFFORTS = ["low", "medium"] as const;

/** The answer is under 150 tokens; the rest is thinking, which this also
 *  caps. write-blurb's measurement (13 Oct 2026) is why it is not tight:
 *  a call that spends its budget thinking returns no answer at all. */
const MAX_TOKENS = 4000;

/** Photographs per request, and how many go to the model at once. A place
 *  has 5 to 10 visible photographs in the trial's random draw, so one
 *  request holds a whole place; four at once keeps a request of 24 to six
 *  rounds of calls. */
const MAX_PHOTOS = 24;
const AT_ONCE = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Photo = { id: string; photo_uri: string | null; storage_path: string | null };
type Usage = { input_tokens: number; output_tokens: number };

/** Runs `fn` over `items`, `n` at a time, in order. */
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
  if (!(await opsOrEditor(admin, req, "label-photos"))) return json({ error: "editors only" }, 403);

  try {
    const body = await req.json();
    const ids: unknown = body.photo_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_PHOTOS || !ids.every((id) => typeof id === "string" && UUID.test(id))) {
      return json({ error: `photo_ids: 1 to ${MAX_PHOTOS} photograph ids` }, 400);
    }
    const model = body.model ?? MODEL;
    if (!MODELS.includes(model)) return json({ error: `model: one of ${MODELS.join(", ")}` }, 400);
    const effort = body.effort ?? EFFORTS[0];
    if (!EFFORTS.includes(effort)) return json({ error: `effort: one of ${EFFORTS.join(", ")}` }, 400);
    const write = body.write !== false;

    const { data: rows, error } = await admin.from("place_photos")
      .select("id, photo_uri, storage_path").in("id", ids);
    if (error) throw new Error(error.message);
    const found = new Map((rows as Photo[] ?? []).map((p) => [p.id, p]));
    const missing = (ids as string[]).filter((id) => !found.has(id));
    const unstored = (ids as string[]).filter((id) => found.has(id) && !found.get(id)!.storage_path);
    let todo = (ids as string[]).filter((id) => found.get(id)?.storage_path && found.get(id)!.photo_uri);

    // Already labelled, completely, at this version: nothing to do. Nor
    // is a label the owner set by hand (`"by": "owner"`), at any version:
    // a model asked again would only undo a ruling. Only when writing — a
    // measurement asks again on purpose.
    const labelled: string[] = [];
    if (write && todo.length) {
      const { data: have } = await admin.from("photo_scores")
        .select("photo_id, scorer_version, signals").eq("scorer", SCORER).in("photo_id", todo);
      const done = new Set((have ?? [])
        .filter((s: { scorer_version: number; signals: Record<string, unknown> | null }) =>
          s.signals?.by === "owner" ||
          (s.scorer_version >= VERSION && ["kind", ...ATTRS].every((k) => k in (s.signals ?? {}))))
        .map((s: { photo_id: string }) => s.photo_id));
      labelled.push(...todo.filter((id) => done.has(id)));
      todo = todo.filter((id) => !done.has(id));
    }

    const anthropic = new Anthropic({ apiKey });
    const usage: Usage = { input_tokens: 0, output_tokens: 0 };
    const results = await pool(todo, AT_ONCE, async (id) => {
      const params = {
        model,
        max_tokens: MAX_TOKENS,
        system: DEFINITIONS,
        output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: found.get(id)!.photo_uri! } },
            { type: "text", text: "Label this photograph." },
          ],
        }],
      };
      try {
        // A policy decline on Opus or Sonnet is retried by the API on the
        // model it picks for the decline's category; Haiku has no
        // server-side fallback, and a refused photograph is reported.
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
          console.log("label-photos no answer", { id, model, stop_reason: message.stop_reason });
          return { id, error: `no answer (${message.stop_reason})` };
        }
        const answer = JSON.parse(text.text) as Answer;
        return { id, signals: toSignals(answer, { by: "fn", model }) };
      } catch (e) {
        console.log("label-photos failed", { id, model, error: (e as Error).message });
        return { id, error: (e as Error).message };
      }
    });

    const labels = results.filter((r): r is { id: string; signals: ReturnType<typeof toSignals> } => "signals" in r);
    const failed = results.filter((r): r is { id: string; error: string } => "error" in r);

    if (write && labels.length) {
      const { error: wrote } = await admin.from("photo_scores").upsert(
        labels.map((l) => ({ photo_id: l.id, scorer: SCORER, scorer_version: VERSION, signals: l.signals, scored_at: new Date().toISOString() })),
        { onConflict: "photo_id,scorer" },
      );
      if (wrote) throw new Error(wrote.message);
    }

    return json({ model, effort, write, labels, failed, labelled, missing, unstored, usage });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
