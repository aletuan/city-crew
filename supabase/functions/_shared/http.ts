// The response plumbing every function carried a copy of (22 Nov 2026):
// the CORS headers, the preflight answer and `json()`. Thirteen copies had
// drifted into two variants already — the batch jobs allow `x-ops-token`,
// the rest do not — and the next function would have been a fourteenth.
//
// The variant is a choice, not a default to forget: a function that takes
// an ops token (`_shared/gate.ts`) says so here, and one that does not
// keeps the header off its allow-list, as each did before.

const BASE_HEADERS = "authorization, x-client-info, apikey, content-type";

export function http({ opsToken = false }: { opsToken?: boolean } = {}) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": opsToken ? `${BASE_HEADERS}, x-ops-token` : BASE_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  return { CORS, json };
}
