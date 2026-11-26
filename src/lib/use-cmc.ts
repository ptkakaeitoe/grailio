"use client";

import { useEffect, useState } from "react";
import type { CmcQuote, CmcSnapshot } from "./cmc";

/** Live CoinMarketCap data from our /api/cmc route (server holds the key and caches for 60 s). */
export function useCmc(tickers?: string[], refreshMs = 60_000) {
  const [snap, setSnap] = useState<CmcSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = tickers ? [...tickers].sort().join(",") : "";

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(key ? `/api/cmc?tickers=${key}` : "/api/cmc", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (alive) { setSnap(json); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "CoinMarketCap request failed");
      }
    };
    const first = setTimeout(load, 0);
    const t = setInterval(load, refreshMs);
    return () => { alive = false; clearTimeout(first); clearInterval(t); };
  }, [key, refreshMs]);

  const byTicker = new Map<string, CmcQuote>((snap?.quotes ?? []).map((q) => [q.ticker, q]));
  return { snap, error, byTicker };
}

/** Percent difference of a vs b. */
export const gapPct = (a: number | null | undefined, b: number | null | undefined) => (a && b ? ((a - b) / b) * 100 : null);

export const compactUsd = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
