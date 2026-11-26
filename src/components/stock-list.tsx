"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, RefreshCw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { AtlasSnapshot } from "@/lib/atlas";
import { underlying } from "@/lib/atlas-feeds";
import { stockOf } from "@/lib/stocks";
import { usePack } from "@/lib/pack";
import { buyDemo, startDemo, useDemo } from "@/lib/demo";
import { showToast } from "@/lib/toast";
import { tradableTicker } from "@/lib/trade-market";
import { useTradeMarket } from "@/lib/use-trade-market";
import { compactUsd, gapPct, useCmc } from "@/lib/use-cmc";
import { ago, usd } from "@/lib/format";
import { cn } from "@/components/clean-ui";
import { TradeToolbar, toolbarChip, tradeList, tradeTable } from "@/components/trade-toolbar";
import { StockLogo } from "@/components/stock-logo";

const REFRESH_MS = 30_000;
/** The quick views above the list: everything, S&P 500 companies (and the SPY fund), or ETFs. */
type View = "all" | "sp500" | "etf";
/** bStocks whose company is in the S&P 500 (checked 2026-11-27), plus SPY, the index fund. */
const SP500 = new Set(["TSLA", "NVDA", "MU", "AMD", "INTC", "MSFT", "META", "PLTR", "GOOGL", "QCOM", "COIN", "WDC", "GLW", "IBM", "AVGO", "HOOD", "ORCL", "AAPL", "AMZN", "DELL", "AMAT", "PYPL", "GS", "NFLX", "SMCI", "CRWD", "STX", "MRNA", "CRM", "HPE", "ADBE", "JPM", "LLY", "VST", "BRK.B", "GEV", "APP", "SPY"]);
type Consensus = "any" | "healthy" | "degraded";
type Sort = "featured" | "symbol" | "price" | "change" | "score" | "volume" | "gap";
const AGREE_PCT = 1;
type QuickCurrency = "BNB" | "USDT";
const QUICK_KEY = "bsctemp.quickbuy.v1";
/** Default quick-buy size per currency. */
const QUICK_DEFAULT: Record<QuickCurrency, string> = { BNB: "0.1", USDT: "10" };

/**
 * Every bStock Atlas prices, in one dense list (no pages: about a hundred rows, refreshed every 30 s). Featured order
 * puts your pack's stocks first, then the busiest. The feed ID, signing time and the stock cross-check live on each
 * stock's trade screen.
 */
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
  const [view, setView] = useState<View>("all");
  const [consensus, setConsensus] = useState<Consensus>("any");
  const [sort, setSort] = useState<Sort>("featured");
  const cmc = useCmc();
  const demo = useDemo();
  // Real trades on the testnet trade market when a wallet is connected and the stock is listed there.
  const trade = useTradeMarket();
  const wallet = useAccount();

  // Quick buy: one size for every row's Buy button (e.g. 0.1 BNB or 10 USDT), remembered in this browser.
  const [quick, setQuick] = useState<{ amount: string; currency: QuickCurrency }>({ amount: QUICK_DEFAULT.BNB, currency: "BNB" });
  useEffect(() => {
    const t = setTimeout(() => {
      try { const saved = JSON.parse(localStorage.getItem(QUICK_KEY) ?? "null"); if (saved?.amount && (saved.currency === "BNB" || saved.currency === "USDT")) setQuick(saved); } catch { /* keep default */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const saveQuick = (next: { amount: string; currency: QuickCurrency }) => {
    setQuick(next);
    try { localStorage.setItem(QUICK_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => { if (typeof d.price === "number" && d.price > 0) setBnbUsd(d.price); }).catch(() => {});
  }, []);
  const quickAmount = Number(quick.amount);
  // On-chain the stable side is Flap's test USD.
  const quickLabel = trade.live && quick.currency === "USDT" ? "USD" : quick.currency;
  const quickOk = Number.isFinite(quickAmount) && quickAmount > 0;
  /** Simulated buy of `tick` at its Atlas price with the quick-buy size (starts the demo wallet if needed). */
  function quickBuy(tick: string, price: number) {
    if (!quickOk) return;
    if (trade.live && tradableTicker(tick)) {
      void trade.buy(tick, quick.currency === "BNB" ? "BNB" : "USD", quick.amount);
      return;
    }
    if (!bnbUsd) return;
    if (!demo.active && !wallet.isConnected) {
      showToast({ kind: "error", title: "Connect a wallet to trade", detail: "Or use “Try without a wallet” above (simulated)." });
      return;
    }
    if (!demo.active) startDemo();
    if (buyDemo(tick, quickAmount, quick.currency, price, bnbUsd)) {
      const got = quick.currency === "BNB" ? (quickAmount * bnbUsd) / price : quickAmount / price;
      showToast({ kind: "success", title: `Bought ${got.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${tick}`, detail: `${quick.amount} ${quick.currency} · Simulated` });
    } else {
      showToast({ kind: "error", title: `Not enough ${quick.currency}`, detail: "Lower the quick-buy amount or reset the demo wallet." });
    }
  }
  const buyButton = (tick: string, price: number) => (
    <button
      type="button"
      className={cn(toolbarChip, "relative z-10 min-h-9 px-3 desk:min-h-8")}
      disabled={!quickOk || !stockOf(tick) || (trade.live && tradableTicker(tick) ? Boolean(trade.busy) : !bnbUsd)}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); quickBuy(tick, price); }}
      aria-label={`Buy ${tick} with ${quick.amount} ${quickLabel}`}
    >
      Buy
    </button>
  );

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
      if (q && !r.symbol.includes(q) && !String(r.id).includes(q) && !stockOf(underlying(r.symbol))?.name.toUpperCase().includes(q)) return false;
      if (view === "sp500" && !SP500.has(underlying(r.symbol))) return false;
      if (view === "etf" && stockOf(underlying(r.symbol))?.kind !== "etf") return false;
      if (consensus === "healthy") return r.consensusStatus === "HEALTHY";
      if (consensus === "degraded") return r.consensusStatus !== null && r.consensusStatus !== "HEALTHY";
      return true;
    });
    type Row = (typeof list)[number];
    const volume = (r: Row) => cmc.byTicker.get(underlying(r.symbol))?.volume24h ?? -1;
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      // Your pack's stocks first, then the busiest, then A–Z.
      featured: (a, b) =>
        Number(inPack.has(underlying(b.symbol))) - Number(inPack.has(underlying(a.symbol))) || volume(b) - volume(a) || a.symbol.localeCompare(b.symbol),
      symbol: (a, b) => a.symbol.localeCompare(b.symbol),
      price: (a, b) => b.price - a.price,
      change: (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
      score: (a, b) => (b.consensusScore ?? -1) - (a.consensusScore ?? -1),
      volume: (a, b) => volume(b) - volume(a),
      gap: (a, b) => Math.abs(gapPct(b.price, cmc.byTicker.get(underlying(b.symbol))?.price) ?? -1) - Math.abs(gapPct(a.price, cmc.byTicker.get(underlying(a.symbol))?.price) ?? -1),
    };
    return [...list].sort(by[sort]);
  }, [snap, query, view, consensus, sort, inPack, cmc.byTicker]);

  const agree = useMemo(() => {
    if (!snap || !cmc.snap) return null;
    const gaps = snap.quotes.map((q) => gapPct(q.price, cmc.byTicker.get(underlying(q.symbol))?.price)).filter((g): g is number => g !== null);
    return { n: gaps.length, ok: gaps.filter((g) => Math.abs(g) <= AGREE_PCT).length };
  }, [snap, cmc.snap, cmc.byTicker]);
  const newest = snap ? Math.max(...snap.quotes.map((q) => q.timestamp)) : 0;

  const chip = toolbarChip;
  const changeText = (c: number | null) => (c == null ? "—" : `${c > 0 ? "+" : ""}${c.toFixed(2)}%`);
  const changeTone = (c: number | null) => (c == null ? "text-muted" : c >= 0 ? "text-up" : "text-down");
  const empty = !snap && !error ? "Fetching signed prices from Atlas…" : snap && rows.length === 0 ? "No feeds match." : null;

  /** The status line: how many feeds, that Atlas signed them, how fresh, and how many agree with CoinMarketCap. */
  const status = (
    <>
      <span>{snap ? snap.quotes.length : "—"} feeds</span>
      <span aria-hidden="true">·</span>
      <span className={cn("inline-flex items-center gap-1", snap?.signerOk ? "text-up" : snap ? "text-down" : "")} title={snap?.signer}>
        {snap ? (snap.signerOk ? <BadgeCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />) : null}
        {snap ? (snap.signerOk ? "signed" : "unknown signer") : "—"}
      </span>
      {snap && <span>{ago(newest, now)}</span>}
      {agree && <><span aria-hidden="true">·</span><span>{agree.ok}/{agree.n} match CMC</span></>}
    </>
  );

  return (
    <div className="flex flex-col gap-5 desk:gap-6">

      {/* Quick views (All, S&P 500, ETFs), the status line, then search, a Filter panel (consensus, sort,
          auto-refresh) and Refresh. */}
      <TradeToolbar
        views={[["all", "All"], ["sp500", "S&P 500"], ["etf", "ETFs"]] as const}
        view={view}
        onView={setView}
        status={status}
        query={query}
        onQuery={setQuery}
        placeholder="Search stocks"
        searchLabel="Search by ticker, name or feed ID"
        upper
        actions={<>
          {trade.live && (
            <button type="button" className={cn(chip, "inline-flex items-center gap-1.5 whitespace-nowrap desk:min-h-10")} disabled={Boolean(trade.busy)} onClick={() => { void trade.claimUsd(); }} title="Mint 100 free test USD to your wallet">
              <span className="num">{trade.usdBalance === null ? "—" : trade.usdBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              <span className="text-muted">USD</span>
              <span aria-hidden="true">·</span> Claim
            </button>
          )}
          <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-md border border-border desk:h-10" role="group" aria-label="Quick buy amount">
            <input
              className="num h-full w-16 bg-transparent px-2.5 text-right text-sm outline-none"
              inputMode="decimal"
              value={quick.amount}
              onChange={(e) => { if (/^\d*\.?\d{0,8}$/.test(e.target.value)) saveQuick({ ...quick, amount: e.target.value }); }}
              aria-label="Amount per Buy"
            />
            <button
              type="button"
              className="h-full border-l border-border px-2.5 text-sm transition-colors hover:bg-surface-muted"
              onClick={() => { const currency = quick.currency === "BNB" ? "USDT" : "BNB"; saveQuick({ currency, amount: QUICK_DEFAULT[currency] }); }}
              aria-label={`Pay with ${quick.currency}; switch currency`}
            >
              {quickLabel}
            </button>
          </div>
          <details className="group relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.open = false; }}>
            <summary className={cn(chip, "inline-flex list-none items-center gap-1.5 group-open:border-black desk:min-h-10 [&::-webkit-details-marker]:hidden")} aria-label="Filter and sort">
              <SlidersHorizontal className="size-4" aria-hidden="true" /><span className="max-phone:sr-only">Filter</span>
              {(consensus !== "any" || sort !== "featured") && <span className="size-1.5 rounded-full bg-black" aria-label="filters on" />}
            </summary>
            <div className="absolute top-[calc(100%+8px)] right-0 z-20 w-[min(300px,calc(100vw-36px))] animate-[popover-in_.15s_ease-out] rounded-md border border-border-strong bg-white p-4 shadow-[0_12px_30px_#0000004d]">
              <p className="mb-2 text-sm text-muted">Consensus</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Consensus">
                {([["any", "Any"], ["healthy", "Healthy"], ["degraded", "Degraded"]] as const).map(([id, label]) => (
                  <button key={id} type="button" className={chip} aria-pressed={consensus === id} onClick={() => setConsensus(id)}>{label}</button>
                ))}
              </div>
              <p className="mt-4 mb-2 text-sm text-muted">Sort</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort">
                {([["featured", "Featured"], ["symbol", "A–Z"], ["price", "Price"], ["change", "Change"], ["score", "Score"], ["volume", "Volume"], ["gap", "Atlas↔CMC gap"]] as const).map(([id, label]) => (
                  <button key={id} type="button" className={chip} aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
                ))}
              </div>
              <label className="mt-4 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                Auto-refresh
                <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={auto} onChange={() => setAuto((a) => !a)} />
              </label>
            </div>
          </details>
          <button type="button" className={cn(chip, "inline-flex items-center disabled:opacity-50 desk:min-h-10")} onClick={load} disabled={loading} aria-label="Refresh prices">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </>}
      />

      {error && <p className="rounded-md border border-down/40 bg-down/10 px-4 py-3 text-sm break-words text-down" role="alert">{error}</p>}

      {/* Phones and tablets: a compact price list like a trading app's watchlist. */}
      <ul className={tradeList.frame} aria-label="bStocks prices">
        {empty && <li className="py-12 text-center text-sm text-muted">{empty}</li>}
        {rows.map((r) => {
          const tick = underlying(r.symbol);
          return (
            <li key={r.id} className={cn(tradeList.item, "flex items-center gap-2")}>
              <Link href={stockOf(tick) ? `/app/trade/stock/${tick}` : "#"} aria-disabled={!stockOf(tick)} className={cn(tradeList.link, "min-w-0 flex-1 aria-disabled:pointer-events-none")}>
              <StockLogo ticker={r.symbol} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="num truncate text-base">{tick}</span>
                  {inPack.has(tick) && <span className="shrink-0 rounded-[4px] bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">in pack</span>}
                </p>
                <p className="truncate text-[13px] text-muted">{stockOf(tick)?.name ?? "Token"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num text-base">{usd(r.price, r.price < 1 ? 4 : 2)}</p>
                <p className={cn("num text-[13px]", changeTone(r.changePct))}>{changeText(r.changePct)}</p>
              </div>
              </Link>
              {buyButton(tick, r.price)}
            </li>
          );
        })}
      </ul>

      {/* From 801px: a dense table, one line per stock (about 12 on screen), with the CoinMarketCap cross-check and
          consensus (Volume from 1201px). The whole row opens the stock's trade screen. */}
      <div className={tradeTable.frame}>
        <table className={tradeTable.table}>
          <thead className={tradeTable.head}>
            <tr>
              <th className="px-4 py-2.5 font-normal">Stock</th>
              <th className="px-4 py-2.5 text-right font-normal">Price</th>
              <th className="px-4 py-2.5 text-right font-normal">Change</th>
              <th className="px-4 py-2.5 text-right font-normal">CoinMarketCap</th>
              <th className="hidden px-4 py-2.5 text-right font-normal wide:table-cell">Volume</th>
              <th className="px-4 py-2.5 font-normal">Consensus</th>
              <th className="px-4 py-2.5 text-right font-normal"><span className="sr-only">Buy</span>{quickOk ? `${quick.amount} ${quickLabel}` : ""}</th>
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">{empty}</td></tr>
            )}
            {rows.map((r) => {
              const tick = underlying(r.symbol);
              const ok = r.consensusStatus === "HEALTHY";
              const m = cmc.byTicker.get(tick);
              const dev = gapPct(r.price, m?.price);
              return (
                <tr key={r.id} className={tradeTable.row}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StockLogo ticker={r.symbol} size={24} />
                      {stockOf(tick) ? (
                        <Link href={`/app/trade/stock/${tick}`} className={cn("num shrink-0", tradeTable.rowLink)}>{tick}</Link>
                      ) : <span className="num shrink-0">{tick}</span>}
                      <span className="truncate text-[13px] text-muted">{stockOf(tick)?.name ?? "Token"}</span>
                      {inPack.has(tick) && <span className="shrink-0 rounded-[4px] bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">in pack</span>}
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-right">{usd(r.price, r.price < 1 ? 4 : 2)}</td>
                  <td className={cn("num px-4 py-3 text-right", changeTone(r.changePct))}>{changeText(r.changePct)}</td>
                  <td className="num px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-ink-soft">{m?.price ? usd(m.price, m.price < 1 ? 4 : 2) : "—"}</span>
                    {dev !== null && <span className={cn("ml-1.5 text-[11px]", Math.abs(dev) > AGREE_PCT ? "text-warn" : "text-muted")}>{dev > 0 ? "+" : ""}{dev.toFixed(2)}%</span>}
                  </td>
                  <td className="num hidden px-4 py-3 text-right text-ink-soft wide:table-cell">{compactUsd(m?.volume24h)}</td>
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
                  <td className="px-4 py-2 text-right">{buyButton(tick, r.price)}</td>
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
