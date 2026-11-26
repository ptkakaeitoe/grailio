import "server-only";
import { ATLAS_FEEDS } from "./atlas-feeds";
import { STOCKS } from "./stocks";

/**
 * CoinMarketCap Pro API, read server-side with CMC_API_KEY (never sent to the browser).
 * Two endpoints, both batched:
 *  - /v2/cryptocurrency/quotes/latest?id=…   the bStock token itself (price, 24h volume, market cap, 24h change)
 *  - /v5/real-world-assets/quotes/latest?symbol=…   the underlying stock across every tokenized issuer
 *    (average tokenized price = our "real stock" reference for the bStock price gap)
 * Results are cached in memory for 60 s to stay well inside the Basic plan's credits.
 */
const BASE = "https://pro-api.coinmarketcap.com";
const TTL_MS = 60_000;
const RWA_CHUNK = 30;
/** Underlying tickers CoinMarketCap's real-world-asset endpoint rejects (checked 2026-11-25); one bad symbol fails the whole batch. */
const RWA_UNSUPPORTED = new Set(["CYPH", "SECZ", "USDE", "BOT", "BSP", "SKDD", "SKUU"]);

export type CmcQuote = {
  ticker: string;
  symbol: string;
  cmcId: number | null;
  /** bStock token on CoinMarketCap. */
  price: number | null;
  volume24h: number | null;
  marketCap: number | null;
  change24h: number | null;
  /** Underlying stock: average price across all tokenized versions (bStocks, xStocks, Ondo, …). */
  underlyingAvg: number | null;
  underlyingVolume24h: number | null;
  issuers: number | null;
  updatedAt: string | null;
};

export type CmcSnapshot = { quotes: CmcQuote[]; fetchedAt: number; credits: number; cached: boolean };

type CryptoResp = { status: { error_code: number | string; error_message: string | null; credit_count: number }; data?: Record<string, { symbol: string; quote: { USD: { price: number | null; volume_24h: number | null; market_cap: number | null; percent_change_24h: number | null; last_updated: string } } }> };
type RwaResp = { status: { error_code: number | string; error_message: string | null; credit_count: number }; data?: { rwa_assets: { symbol: string; average_tokenized_price: number | null; tokenized_volume_24h: number | null; tokens: { symbol: string; issuer_name: string; price: number | null }[] }[] } };

const cache = new Map<string, { at: number; value: CmcSnapshot }>();

async function call<T extends { status: { error_code: number | string; error_message: string | null } }>(path: string, key: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const json = (await res.json()) as T;
  if (!res.ok || (json.status.error_code !== 0 && json.status.error_code !== "0")) throw new Error(`CoinMarketCap: ${json.status.error_message ?? `HTTP ${res.status}`}`);
  return json;
}

export async function fetchCmc(tickers: string[]): Promise<CmcSnapshot> {
  const key = process.env.CMC_API_KEY?.trim();
  if (!key) throw new Error("CMC_API_KEY is not set. Add it to .env.local and restart the dev server.");

  const wanted = [...new Set(tickers)].map((t) => STOCKS.find((s) => s.ticker === t)).filter((s): s is (typeof STOCKS)[number] => !!s);
  const cacheKey = wanted.map((s) => s.ticker).sort().join(",");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.value, cached: true };

  const idOf = (symbol: string) => ATLAS_FEEDS.find((f) => f.symbol === symbol)?.cmcId ?? null;
  const ids = wanted.map((s) => idOf(s.symbol)).filter((x): x is number => x !== null);

  const rwaTickers = wanted.map((s) => s.ticker).filter((t) => !RWA_UNSUPPORTED.has(t));
  const chunks: string[][] = [];
  for (let i = 0; i < rwaTickers.length; i += RWA_CHUNK) chunks.push(rwaTickers.slice(i, i + RWA_CHUNK));

  // The token quotes are required; a failed real-world-asset batch only leaves those underlying prices empty.
  const [crypto, rwaSettled] = await Promise.all([
    ids.length ? call<CryptoResp>(`/v2/cryptocurrency/quotes/latest?id=${ids.join(",")}`, key) : Promise.resolve(null),
    Promise.allSettled(chunks.map((c) => call<RwaResp>(`/v5/real-world-assets/quotes/latest?symbol=${encodeURIComponent(c.join(","))}`, key))),
  ]);
  const rwa = rwaSettled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

  const assets = new Map(rwa.flatMap((r) => r.data?.rwa_assets ?? []).map((a) => [a.symbol, a]));
  const quotes: CmcQuote[] = wanted.map((s) => {
    const id = idOf(s.symbol);
    const t = id !== null ? crypto?.data?.[String(id)]?.quote.USD : undefined;
    const a = assets.get(s.ticker);
    // Tokens without a CMC id still appear in the real-world-asset list under the bStocks issuer.
    const fromRwa = a?.tokens.find((x) => x.issuer_name === "bStocks" && x.symbol === s.symbol)?.price ?? null;
    return {
      ticker: s.ticker,
      symbol: s.symbol,
      cmcId: id,
      price: t?.price ?? fromRwa,
      volume24h: t?.volume_24h ?? null,
      marketCap: t?.market_cap ?? null,
      change24h: t?.percent_change_24h ?? null,
      underlyingAvg: a?.average_tokenized_price ?? null,
      underlyingVolume24h: a?.tokenized_volume_24h ?? null,
      issuers: a ? a.tokens.length : null,
      updatedAt: t?.last_updated ?? null,
    };
  });

  const credits = (crypto?.status.credit_count ?? 0) + rwa.reduce((s, r) => s + (r.status.credit_count ?? 0), 0);
  const value = { quotes, fetchedAt: Date.now(), credits, cached: false };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}
