"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowLeft } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { cn } from "@/components/clean-ui";
import { startDemo, tradeDemo, tradeDemoBnb, useDemo } from "@/lib/demo";
import { demoTokenPrice } from "@/lib/market";
import { simTokenPrice, useDemoLaunches } from "@/lib/demo-launch";
import { CoinPackLink } from "@/components/coin-link";
import { useMarketCoins } from "@/lib/published-packs";
import { stockOf } from "@/lib/stocks";
import { showToast } from "@/lib/toast";
import { usd } from "@/lib/format";

/*
 * Trade one asset, minimal: the price and a chart on top, a swap box below (pay BNB, receive the asset; flip to sell).
 * Stocks: signed Atlas price, chart of the bStock token from CoinMarketCap. Tokens: demo price, no history yet.
 * BNB (demo only): traded against the demo wallet's USDT at the Atlas BNB/USD price, with BNB's CoinMarketCap chart.
 * Trades run in the demo wallet until the contracts are on BSC testnet.
 */

type Asset = { kind: "stock"; ticker: string } | { kind: "token"; slug: string } | { kind: "bnb" };
type Point = { t: number; p: number };
const PERIODS = ["24H", "7D", "30D"] as const;

const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });
const priceText = (p: number) => (p >= 1 ? usd(p) : `$${p.toPrecision(3)}`);

function Chart({ points, up }: { points: Point[]; up: boolean }) {
  if (points.length < 2) return null;
  const W = 600, H = 180;
  const ps = points.map((x) => x.p);
  const lo = Math.min(...ps), hi = Math.max(...ps), span = hi - lo || 1;
  const xy = points.map((x, i) => [(i / (points.length - 1)) * W, H - 8 - ((x.p - lo) / span) * (H - 16)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[180px] w-full" role="img" aria-label="Price chart">
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TradeScreen({ asset }: { asset: Asset }) {
  const demo = useDemo();
  const coins = useMarketCoins();
  const sims = useDemoLaunches();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("24H");
  const [history, setHistory] = useState<Point[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const stock = asset.kind === "stock" ? stockOf(asset.ticker) : null;
  const coin = asset.kind === "token" ? coins.find((c) => c.slug === asset.slug) : null;
  const isBnb = asset.kind === "bnb";
  const key = asset.kind === "stock" ? asset.ticker : asset.kind === "token" ? `token:${asset.slug}` : "bnb";
  const symbol = isBnb ? "BNB" : stock ? stock.ticker : coin ? coin.config.ticker || coin.name : "";
  const price = isBnb ? bnbUsd : stock ? livePrice : coin ? simTokenPrice(sims, coin) ?? demoTokenPrice(coin) : null;
  /** What you pay with: BNB for stocks and tokens, USDT for BNB. */
  const quote = isBnb ? "USDT" : "BNB";
  const quoteUsd = isBnb ? 1 : bnbUsd;
  const chartTicker = isBnb ? "BNB" : stock?.ticker;

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => { if (typeof d.price === "number" && d.price > 0) setBnbUsd(d.price); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!stock?.feedId) return;
    fetch(`/api/atlas?ids=${stock.feedId}`).then((r) => r.json()).then((d: { quotes?: { price: number }[] }) => {
      const p = d.quotes?.[0]?.price;
      if (typeof p === "number") setLivePrice(p);
    }).catch(() => {});
  }, [stock?.feedId]);
  useEffect(() => {
    if (!chartTicker) return;
    let live = true;
    fetch(`/api/history?ticker=${chartTicker}&period=${period}`).then((r) => r.json()).then((d: { points?: Point[] }) => { if (live) setHistory(d.points ?? []); }).catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [chartTicker, period]);

  const change = history.length > 1 ? (history.at(-1)!.p - history[0].p) / history[0].p : null;
  const held = isBnb ? demo.bnb : demo.assets?.[key] ?? 0;
  const quoteBalance = isBnb ? demo.usdt : demo.bnb;
  const payBalance = side === "buy" ? quoteBalance : held;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const receive = useMemo(() => {
    if (!valid || !price || !quoteUsd) return null;
    return side === "buy" ? (value * quoteUsd) / price : (value * price) / quoteUsd;
  }, [valid, value, price, quoteUsd, side]);
  const payLabel = side === "buy" ? quote : symbol;
  const getLabel = side === "buy" ? symbol : quote;
  const short = valid && value > payBalance + 1e-12;

  if ((asset.kind === "token" && !coin) || (asset.kind === "stock" && !stock)) return <p className="py-16 text-center text-base text-muted">This isn&apos;t listed.</p>;

  function submit() {
    if (!demo.active) { startDemo(); return; }
    if (!valid || !price || !bnbUsd) return;
    if (isBnb ? tradeDemoBnb(side, value, bnbUsd) : tradeDemo(side, key, value, price, bnbUsd)) {
      showToast({ kind: "success", title: `${side === "buy" ? "Bought" : "Sold"} ${fmt(side === "buy" ? receive ?? 0 : value, 4)} ${symbol}`, detail: "Simulated · BSC testnet" });
      setAmount("");
    }
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 pb-10 desk:pt-8">
      <Link href="/app/trade" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm text-muted hover:text-black"><ArrowLeft className="size-4" /> Trade</Link>

      <header className="flex items-center gap-3">
        {isBnb ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0b90b] text-[13px] font-semibold text-[#111]" aria-hidden="true">BNB</span>
        ) : stock ? <StockLogo ticker={stock.ticker} size={40} /> : (
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-[#fff]" style={{ background: coin!.tone }} aria-hidden="true">
            {coin!.config.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the launched coin
              <img src={coin!.config.image} alt="" className="size-full object-cover" />
            ) : coin!.name[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight">{symbol}</h1>
          <p className="truncate text-sm text-muted">{isBnb ? "vs USDT · demo" : stock ? stock.name : "Token"}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] leading-tight tabular-nums">{price ? priceText(price) : "—"}</p>
          {change !== null && <p className={cn("text-sm tabular-nums", change >= 0 ? "text-up" : "text-down")}>{change >= 0 ? "+" : ""}{(change * 100).toFixed(2)}%</p>}
          {coin && <p className="text-sm text-muted">demo price</p>}
        </div>
      </header>

      {chartTicker ? (
        <section aria-label="Chart">
          {history.length > 1 ? <Chart points={history} up={(change ?? 0) >= 0} /> : <div className="grid h-[180px] place-items-center text-sm text-muted">Loading chart…</div>}
          <div className="mt-2 flex gap-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
                className="min-h-9 rounded-md px-3 text-sm text-muted transition-colors aria-pressed:bg-surface-muted aria-pressed:text-black">{p}</button>
            ))}
          </div>
        </section>
      ) : (
        <div className="grid h-[120px] place-items-center rounded-md border border-dashed border-border text-sm text-muted">No price history yet</div>
      )}

      {coin && coin.config.kind !== "classic" && <CoinPackLink market={coin} page="coin" />}

      <section aria-label="Swap" className="flex flex-col gap-1.5">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <div className="flex items-baseline justify-between text-sm text-muted">
            <span>You pay</span>
            <span className="tabular-nums">Balance {fmt(payBalance, 6)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={`Amount of ${payLabel}`}
              className="min-w-0 flex-1 bg-transparent text-[32px] leading-none tabular-nums outline-none placeholder:text-muted" />
            <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{payLabel}</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <button key={f} type="button" disabled={!(payBalance > 0)} onClick={() => setAmount(String(Number((payBalance * f).toFixed(side === "buy" ? 6 : 8))))}
                className="min-h-9 flex-1 rounded-full border border-border-strong text-sm transition-colors hover:border-black disabled:opacity-40">{f === 1 ? "Max" : `${f * 100}%`}</button>
            ))}
          </div>
        </div>

        <div className="relative z-[1] -my-4 flex justify-center">
          <button type="button" onClick={() => { setSide(side === "buy" ? "sell" : "buy"); setAmount(""); }} aria-label="Switch buy and sell"
            className="grid size-10 place-items-center rounded-full border border-border-strong bg-white transition-colors hover:border-black">
            <ArrowDownUp className="size-4" />
          </button>
        </div>

        <div className="rounded-md border border-border p-4">
          <div className="flex items-baseline justify-between text-sm text-muted">
            <span>You receive</span>
            <span className="tabular-nums">Balance {fmt(side === "buy" ? held : quoteBalance, 6)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[32px] leading-none tabular-nums text-muted">{receive !== null ? fmt(receive, 6) : "—"}</span>
            <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{getLabel}</span>
          </div>
        </div>
      </section>

      <button type="button" onClick={submit} disabled={demo.active && (!valid || short || !price || !bnbUsd)}
        className="min-h-12 rounded-md bg-black text-base text-white transition-opacity disabled:opacity-40">
        {!demo.active ? "Try the demo" : !valid ? "Enter an amount" : short ? `Not enough ${payLabel}` : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
      </button>
      <p className="-mt-3 text-center text-sm text-muted">Simulated · BSC testnet</p>
    </div>
  );
}
