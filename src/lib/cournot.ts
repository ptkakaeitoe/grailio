import "server-only";
import type { CournotMarket } from "./risk";

/*
 * Cournot Intelligence Oracle over HTTP, server-side only. Same endpoints and headers as the official Cournot skill
 * client (.claude/skills/cournot/scripts): POST /intelligence/v1/resolve (free) and /intelligence/v1/probability.
 * Probability uses COURNOT_API_KEY when set; otherwise the server's free calls (three per IP, ever).
 * Paid per-call settlement needs a wallet signature, which this server never does: it reports that calls ran out.
 */

const PRODUCTION = "https://interface.cournot.ai";
const DEV = "https://dev-interface.cournot.ai";

function base() {
  const b = (process.env.COURNOT_API_BASE || PRODUCTION).replace(/\/$/, "");
  return b === DEV ? DEV : PRODUCTION;
}

type Raw = { status: number; body: { code?: number; msg?: string; data?: Record<string, unknown> } | null };

async function post(path: "resolve" | "probability", body: unknown): Promise<Raw> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = process.env.COURNOT_API_KEY?.trim();
  if (key && path === "probability") headers["COURNOT-API-KEY"] = key;
  const res = await fetch(`${base()}/intelligence/v1/${path}`, {
    method: "POST", headers, body: JSON.stringify(body), redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(path === "probability" ? 120_000 : 30_000),
  });
  const text = await res.text();
  let parsed: Raw["body"] = null;
  try { parsed = text.trim() ? JSON.parse(text) : null; } catch { throw new CournotError("Cournot sent a response that isn't JSON.", "bad_response"); }
  return { status: res.status, body: parsed };
}

export type CournotState = "free_calls_used" | "prepaid_calls_used" | "key_invalid" | "rate_limited" | "service_error" | "api_error" | "bad_response" | "no_market";

export class CournotError extends Error {
  constructor(message: string, readonly state: CournotState) { super(message); }
}

/** Mirrors the skill client's responseState(). */
function check(r: Raw) {
  if (r.status === 429) throw new CournotError("Cournot is rate limiting this server. Try again later.", "rate_limited");
  if (r.status >= 500) throw new CournotError("Cournot had a server error. Try again later.", "service_error");
  if (r.body?.code === 22002) throw new CournotError("This Cournot key has no prepaid calls left.", "prepaid_calls_used");
  if (r.status === 401 || (r.body?.code === 4100 && r.body?.msg === "api key is invalid")) throw new CournotError("COURNOT_API_KEY is invalid or was rotated.", "key_invalid");
  if (r.status === 402) throw new CournotError("This server's free Cournot calls are used up. Add a prepaid COURNOT_API_KEY to .env.local.", "free_calls_used");
  if (!(r.status >= 200 && r.status < 300 && r.body?.code === 0)) throw new CournotError("Cournot couldn't answer this question.", "api_error");
  return r.body.data ?? {};
}

/** Prediction markets matching a question. Free. */
export async function resolveMarkets(message: string, limit = 10): Promise<CournotMarket[]> {
  const data = check(await post("resolve", { message, limit }));
  const markets = Array.isArray(data.markets) ? data.markets : [];
  return markets.flatMap((m: { matching_confidence?: number; market_info?: { id?: string | number; title?: string; end_time?: string } }) =>
    m.market_info?.id != null && m.market_info.title
      ? [{ id: String(m.market_info.id), title: m.market_info.title, endTime: m.market_info.end_time ?? null, confidence: m.matching_confidence ?? 0 }]
      : []);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Cournot's billing route in plain words, from the returned quota fields (as the skill client reads them). */
function billingText(data: Record<string, unknown>): string | null {
  const left = (q: unknown) => (isObj(q) && typeof q.remaining === "number" ? ` · ${q.remaining} left` : "");
  if (isObj(data.x402) && data.x402.txn_hash) return "Paid on-chain";
  if (isObj(data.api_key_quota)) return `Prepaid call${left(data.api_key_quota)}`;
  if (isObj(data.free_quota)) return `Free call${left(data.free_quota)}`;
  return null;
}

/** Fields never shown or saved: billing internals and the caller's IP. */
const PRIVATE = new Set(["basis", "free_quota", "api_key_quota", "api_key", "x402", "charged", "ip"]);

export type Probability = { probabilityYes: number; result: Record<string, unknown>; basis: unknown; billing: string | null };

/** Cournot's probability for one market. Uses a free or prepaid call. */
export async function probability(message: string, marketId: string): Promise<Probability> {
  const data = check(await post("probability", { message, market_ids: [marketId] }));
  // Responses come flat (probability: 0.15, basis: [...]) or nested (probability: { point_estimate, basis }).
  const nested = isObj(data.probability) ? data.probability : isObj(data.result) ? data.result : null;
  const p = [nested?.point_estimate, nested?.probability, data.point_estimate, data.probability].find((v) => typeof v === "number" && v >= 0 && v <= 1) as number | undefined;
  if (p === undefined) throw new CournotError("Cournot answered without a probability.", "bad_response");
  // Every returned assessment field, as sent, minus billing internals.
  const result = Object.fromEntries(Object.entries({ ...data, ...(nested ?? {}) }).filter(([k, v]) => !PRIVATE.has(k) && !isObj(v) && !(k === "probability" && nested)));
  return { probabilityYes: p, result, basis: nested?.basis ?? data.basis ?? null, billing: billingText(data) };
}
