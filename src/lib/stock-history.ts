import "server-only";
import { ATLAS_FEEDS } from "./atlas-feeds";

/*
 * Price history for the trade chart, from CoinMarketCap's /v2/cryptocurrency/quotes/historical for the bStock token
 * itself (TSLAB, not the US stock). Each window stays under 100 points (one CMC credit) and is cached for 5 minutes.
 */

export const HISTORY_PERIODS = ["24H", "7D", "30D"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export type PricePoint = { t: number; p: number };

const WINDOWS: Record<HistoryPeriod, { interval: string; count: number }> = {
  "24H": { interval: "15m", count: 96 },
  "7D": { interval: "2h", count: 84 },
  "30D": { interval: "12h", count: 60 },
};
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; points: PricePoint[] }>();

/** CoinMarketCap ID of a bStock from its stock ticker (TSLA → TSLAB's ID). */
export const cmcIdFor = (ticker: string) => ATLAS_FEEDS.find((f) => f.symbol === `${ticker}B`)?.cmcId ?? null;

/** Real price history for one window; empty if CoinMarketCap doesn't answer. */
export async function fetchStockHistory(ticker: string, period: HistoryPeriod): Promise<PricePoint[]> {
  const id = cmcIdFor(ticker);
  const key = process.env.CMC_API_KEY?.trim();
  if (!id || !key) return [];
  const cacheKey = `${id}:${period}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.points;
  try {
    const { interval, count } = WINDOWS[period];
    const res = await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical?id=${id}&interval=${interval}&count=${count}`, {
      headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" }, cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const quotes: { timestamp: string; quote?: { USD?: { price?: number } } }[] = json?.data?.quotes ?? json?.data?.[id]?.quotes ?? [];
    const points = quotes.flatMap((q) => {
      const p = q.quote?.USD?.price;
      return typeof p === "number" ? [{ t: Math.floor(Date.parse(q.timestamp) / 1000), p }] : [];
    });
    if (points.length > 1) cache.set(cacheKey, { at: Date.now(), points });
    return points;
  } catch {
    return [];
  }
}
