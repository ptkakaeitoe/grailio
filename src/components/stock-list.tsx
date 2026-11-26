"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, RefreshCw, Search, TriangleAlert } from "lucide-react";
import type { AtlasSnapshot } from "@/lib/atlas";
import { underlying } from "@/lib/atlas-feeds";
import { usePack } from "@/lib/pack";
import { compactUsd, gapPct, useCmc } from "@/lib/use-cmc";
import { usd } from "@/lib/format";
import { cleanChip, cleanField, cn } from "@/components/clean-ui";
import { StockLogo } from "@/components/stock-logo";

const REFRESH_MS = 30_000;
type Filter = "all" | "pack" | "healthy" | "degraded";
type Sort = "symbol" | "price" | "change" | "score" | "volume" | "gap";
const AGREE_PCT = 1;

const ago = (ts: number, now: number) => {
  const s = Math.max(0, Math.round(now / 1000 - ts));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

export function StockList() {
  const pack = usePack();
  const inPack = useMemo(() => new Set(pack.basket.map((b) => b.ticker)), [pack.basket]);
  const [snap, setSnap] = useState<AtlasSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  // Clock starts at 0 and is set after mount, so the server render never reads the time.
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("symbol");
  const cmc = useCmc();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atlas", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSnap(json);
      setNow(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // First load, then poll while auto-refresh is on.
    const first = setTimeout(load, 0);
    const poll = auto ? setInterval(load, REFRESH_MS) : undefined;
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [load, auto]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    if (!snap) return [];
    const q = query.trim().toUpperCase();
    const list = snap.quotes.filter((r) => {
      if (q && !r.symbol.includes(q) && !String(r.id).includes(q)) return false;
      if (filter === "pack") return inPack.has(underlying(r.symbol));
      if (filter === "healthy") return r.consensusStatus === "HEALTHY";
      if (filter === "degraded") return r.consensusStatus !== null && r.consensusStatus !== "HEALTHY";
      return true;
    });
    const by: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      symbol: (a, b) => a.symbol.localeCompare(b.symbol),
      price: (a, b) => b.price - a.price,
      change: (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
      score: (a, b) => (b.consensusScore ?? -1) - (a.consensusScore ?? -1),
      volume: (a, b) => (cmc.byTicker.get(underlying(b.symbol))?.volume24h ?? -1) - (cmc.byTicker.get(underlying(a.symbol))?.volume24h ?? -1),
      gap: (a, b) => Math.abs(gapPct(b.price, cmc.byTicker.get(underlying(b.symbol))?.price) ?? -1) - Math.abs(gapPct(a.price, cmc.byTicker.get(underlying(a.symbol))?.price) ?? -1),
    };
    return [...list].sort(by[sort]);
  }, [snap, query, filter, sort, inPack, cmc.byTicker]);

  const agree = useMemo(() => {
    if (!snap || !cmc.snap) return null;
    const gaps = snap.quotes.map((q) => gapPct(q.price, cmc.byTicker.get(underlying(q.symbol))?.price)).filter((g): g is number => g !== null);
    return { n: gaps.length, ok: gaps.filter((g) => Math.abs(g) <= AGREE_PCT).length };
  }, [snap, cmc.snap, cmc.byTicker]);
  const newest = snap ? Math.max(...snap.quotes.map((q) => q.timestamp)) : 0;

  const chip = cn(cleanChip, "min-h-11 shrink-0 px-4 desk:min-h-9 desk:px-3");
  const changeText = (c: number | null) => (c == null ? "—" : `${c > 0 ? "+" : ""}${c.toFixed(2)}%`);
  const changeTone = (c: number | null) => (c == null ? "text-muted" : c >= 0 ? "text-up" : "text-down");
  const empty = !snap && !error ? "Fetching signed prices from Atlas…" : snap && rows.length === 0 ? "No feeds match." : null;

  return (
    <div className="flex flex-col gap-6 desk:gap-8">
      {/* One status line: how many feeds, that Atlas signed them, how fresh, and how many agree with CoinMarketCap. */}
      <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted tabular-nums">
        <span>{snap ? snap.quotes.length : "—"} feeds</span>
        <span aria-hidden="true">·</span>
        <span className={cn("inline-flex items-center gap-1", snap?.signerOk ? "text-up" : snap ? "text-down" : "")} title={snap?.signer}>
          {snap ? (snap.signerOk ? <BadgeCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />) : null}
          {snap ? (snap.signerOk ? "signed" : "unknown signer") : "—"}
        </span>
        {snap && <span>{ago(newest, now)}</span>}
        {agree && <><span aria-hidden="true">·</span><span>{agree.ok}/{agree.n} match CMC</span></>}
      </p>

      <div className="flex flex-col gap-3 wide:flex-row wide:items-center wide:justify-between">
        <div className="flex flex-col gap-3 desk:flex-row desk:items-center desk:gap-2">
          <label className="relative desk:w-[220px] desk:shrink-0">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input className={cn(cleanField, "num pl-10 text-sm uppercase placeholder:normal-case placeholder:text-muted desk:h-9")} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search symbol or feed ID" />
          </label>
          {/* Phones: one row of chips you can swipe instead of wrapping. */}
          <div className="-mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] desk:mx-0 desk:flex-wrap desk:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter">
            {([["all", "All"], ["pack", "In your pack"], ["healthy", "Healthy"], ["degraded", "Degraded"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={chip} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="-mx-[var(--gutter)] flex items-center gap-1.5 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] desk:mx-0 desk:flex-wrap desk:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Sort">
          <span className="mr-1 shrink-0 text-sm text-muted">Sort</span>
          {([["symbol", "A–Z"], ["price", "Price"], ["change", "Change"], ["score", "Score"], ["volume", "Volume"], ["gap", "Atlas↔CMC gap"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={chip} aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
          ))}
          <button type="button" className={chip} aria-pressed={auto} onClick={() => setAuto((a) => !a)} title="Refresh every 30 seconds">Auto</button>
          <button type="button" className={cn(chip, "inline-flex items-center gap-1.5 disabled:opacity-50")} onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw className={cn("size-4", loading && "animate-spin")} /> <span>Refresh</span></button>
        </div>
      </div>

      {error && <p className="rounded-md border border-down/40 bg-down/10 px-4 py-3 text-sm break-words text-down" role="alert">{error}</p>}

      {/* Phones and tablets: a compact price list like a trading app's watchlist. */}
      <ul className="border-y border-border desk:hidden" aria-label="bStocks prices">
        {empty && <li className="py-12 text-center text-sm text-muted">{empty}</li>}
        {rows.map((r) => {
          const tick = underlying(r.symbol);
          return (
            <li key={r.id} className="flex min-h-16 items-center gap-3 border-b border-border py-3 last:border-b-0">
              <StockLogo ticker={r.symbol} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="num truncate text-base">{r.symbol}</span>
                  {inPack.has(tick) && <span className="shrink-0 rounded-[4px] bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">in pack</span>}
                </p>
                <p className="truncate text-[13px] text-muted">{tick === r.symbol ? "token" : `${tick} · bStock`}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num text-base">{usd(r.price, r.price < 1 ? 4 : 2)}</p>
                <p className={cn("num text-[13px]", changeTone(r.changePct))}>{changeText(r.changePct)}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* From 801px: the full table with the CoinMarketCap cross-check and consensus. */}
      <div className="hidden overflow-hidden rounded-md border border-border desk:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-[12px] text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Stock</th>
              <th className="px-4 py-3 text-right font-normal">Price</th>
              <th className="px-4 py-3 text-right font-normal">Change</th>
              <th className="px-4 py-3 text-right font-normal">CoinMarketCap</th>
              <th className="hidden px-4 py-3 text-right font-normal wide:table-cell">vs stock</th>
              <th className="px-4 py-3 font-normal">Consensus</th>
              <th className="hidden px-4 py-3 text-right font-normal wide:table-cell">Feed ID</th>
              <th className="hidden px-4 py-3 text-right font-normal wide:table-cell">Signed</th>
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">{empty}</td></tr>
            )}
            {rows.map((r) => {
              const tick = underlying(r.symbol);
              const ok = r.consensusStatus === "HEALTHY";
              return (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <StockLogo ticker={r.symbol} size={24} />
                      <span className="num">{r.symbol}</span>
                      {inPack.has(tick) && <span className="rounded-[4px] bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">in pack</span>}
                    </div>
                    <span className="text-[12px] text-muted">{tick === r.symbol ? "token" : `${tick} · bStock`}</span>
                  </td>
                  <td className="num px-4 py-3 text-right">{usd(r.price, r.price < 1 ? 4 : 2)}</td>
                  <td className={cn("num px-4 py-3 text-right", changeTone(r.changePct))}>{changeText(r.changePct)}</td>
                  {(() => {
                    const m = cmc.byTicker.get(tick);
                    const dev = gapPct(r.price, m?.price);
                    const toStock = gapPct(m?.price, m?.underlyingAvg);
                    return (
                      <>
                        <td className="num px-4 py-3 text-right">
                          <span className="text-ink-soft">{m?.price ? usd(m.price, m.price < 1 ? 4 : 2) : "—"}</span>
                          {dev !== null && <span className={cn("ml-1.5 text-[11px]", Math.abs(dev) > AGREE_PCT ? "text-warn" : "text-muted")}>{dev > 0 ? "+" : ""}{dev.toFixed(2)}%</span>}
                          <span className="block text-[11px] text-muted">vol {compactUsd(m?.volume24h)}</span>
                        </td>
                        <td className={cn("num hidden px-4 py-3 text-right text-[13px] wide:table-cell", toStock === null ? "text-muted" : Math.abs(toStock) > AGREE_PCT ? "text-warn" : "text-ink-soft")}
                          title={m?.underlyingAvg ? `Average across ${m.issuers} tokenized ${tick} issuers: ${usd(m.underlyingAvg)}` : undefined}>
                          {toStock === null ? "—" : `${toStock > 0 ? "+" : ""}${toStock.toFixed(2)}%`}
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-3">
                    {r.consensusScore == null ? <span className="text-muted">—</span> : (
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-raised-strong" aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: `${r.consensusScore * 100}%`, background: ok ? "var(--up)" : "var(--warn)" }} />
                        </span>
                        <span className="num text-[12px] text-ink-soft">{r.consensusScore.toFixed(2)}</span>
                        <span className={cn("text-[11px] lowercase", ok ? "text-up" : "text-warn")}>{r.consensusStatus}</span>
                      </div>
                    )}
                  </td>
                  <td className="num hidden px-4 py-3 text-right text-[12px] text-muted wide:table-cell">{r.id}</td>
                  <td className="num hidden px-4 py-3 text-right text-[12px] text-muted wide:table-cell">{ago(r.timestamp, now)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cmc.error && <p className="text-[12px] text-down">CoinMarketCap: {cmc.error}</p>}
    </div>
  );
}
