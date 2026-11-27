"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { ArrowLeftIcon, ArrowsDownUpIcon } from "@phosphor-icons/react/ssr";
import { cleanButton, cn } from "@/components/clean-ui";
import { CoinAvatar } from "@/components/launch/coin-avatar";
import { CoinLoopFor } from "@/components/launch/coin-page/coin-loop";
import { PriceChart } from "@/components/launch/price-chart";
import { WalletEntry } from "@/components/wallet-entry";
import { startDemo, tradeDemo, useDemo } from "@/lib/launch/demo";
import { launchMcap, simOf, simTokenHistory, simTokenPrice, TOTAL_SUPPLY, tradeTokenSim, useDemoLaunches, type LaunchSim } from "@/lib/launch/demo-launch";
import { usd } from "@/lib/launch/format";
import { demoTokenPrice, type MarketCoin } from "@/lib/launch/market";
import { useMarketCoins } from "@/lib/launch/published-packs";
import { showToast } from "@/lib/toast";

/*
 * A launched coin's trade screen (testnet): its price and chart (one point per trade), the coin → pool → packs loop,
 * the stock pool beside it, and a swap box. Coin trades are simulated in the launch demo wallet until the coin trades
 * on-chain; every simulated trade moves the price against the pool's liquidity and pays the tax into the pool.
 */

const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });
const priceText = (p: number) => (p >= 1 ? usd(p) : `$${p.toPrecision(3)}`);
const compactUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : usd(n));

/** Beside a coin's chart: its stock pool and where the trading tax went, its mcap and pack price, and a way to its packs. */
function PoolPanel({ coin, sim, price }: { coin: MarketCoin; sim: LaunchSim; price: number | null }) {
  const presale = sim.phase === "presale";
  const mcap = price ? price * TOTAL_SUPPLY : launchMcap(sim.price * sim.packsForSale);
  const tax = sim.tax.pool + sim.tax.stakers + sim.tax.creator + sim.tax.platform;
  const rows: [string, string, boolean][] = [
    [presale ? "Mcap at launch" : "Mcap", compactUsd(mcap), false],
    ["Liquidity", sim.liquidity > 0 ? compactUsd(sim.liquidity) : "—", false],
    ["Tax collected", compactUsd(tax), false],
    ["to the pool", compactUsd(sim.tax.pool), true],
    ["to stakers", compactUsd(sim.tax.stakers), true],
    ["Pack", `${usd(sim.price, 0)} each`, false],
  ];
  return (
    <section aria-label="Pool" className="rounded-md border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-muted">Stock pool</h2>
        <span className="text-[13px] text-muted">{presale ? "presale" : "live"}</span>
      </div>
      <p className="mt-1 text-[32px] leading-tight tabular-nums">{compactUsd(sim.pool)}</p>
      <p className="text-[13px] text-muted">Pays out pack prizes in stocks</p>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
        {rows.map(([label, value, sub]) => (
          <div key={label} className="contents">
            <dt className={sub ? "pl-3 text-muted" : "text-muted"}>{label}</dt>
            <dd className="m-0 text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Link href={`/packs/${coin.slug}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border-strong text-sm transition-colors hover:border-black">Open packs</Link>
    </section>
  );
}

export function CoinTradeScreen({ slug }: { slug: string }) {
  const demo = useDemo();
  const wallet = useAccount();
  const coins = useMarketCoins();
  const sims = useDemoLaunches();
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const coin = coins.find((c) => c.slug === slug) ?? null;
  const key = `token:${slug}`;
  const symbol = coin ? coin.config.ticker || coin.name : "";
  const price = coin ? simTokenPrice(sims, coin) ?? demoTokenPrice(coin) : null;
  const points = coin ? simTokenHistory(sims, coin) : [];
  const sim = coin ? simOf(sims, coin) : null;

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => { if (typeof d.price === "number" && d.price > 0) setBnbUsd(d.price); }).catch(() => {});
  }, []);

  const change = points.length > 1 ? (points.at(-1)!.p - points[0].p) / points[0].p : null;
  const held = demo.assets?.[key] ?? 0;
  const payBalance = side === "buy" ? demo.bnb : held;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const receive = useMemo(() => {
    if (!valid || !price || !bnbUsd) return null;
    return side === "buy" ? (value * bnbUsd) / price : (value * price) / bnbUsd;
  }, [valid, value, price, bnbUsd, side]);
  const payLabel = side === "buy" ? "BNB" : symbol;
  const getLabel = side === "buy" ? symbol : "BNB";
  const short = valid && value > payBalance + 1e-12;

  if (!coin) return <p className="py-16 text-center text-base text-muted">This coin isn&apos;t listed.</p>;

  function submit() {
    if (!demo.active) { startDemo(); return; }
    if (!valid || !price || !bnbUsd || !coin) return;
    if (tradeDemo(side, key, value, price, bnbUsd)) {
      // The trade moves the demo price and its tax fills the pool.
      tradeTokenSim(coin, side, side === "buy" ? value * bnbUsd : value * price);
      showToast({ kind: "success", title: `${side === "buy" ? "Bought" : "Sold"} ${fmt(side === "buy" ? receive ?? 0 : value, 4)} ${symbol}`, detail: "Simulated · BSC testnet" });
      setAmount("");
    }
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 pb-10 desk:max-w-[1180px] desk:pt-8">
      <Link href="/packs" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm text-muted hover:text-black"><ArrowLeftIcon weight="bold" className="size-4" /> Packs</Link>

      <header className="flex items-center gap-3">
        <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight">{symbol}</h1>
          <p className="truncate text-sm text-muted">{coin.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] leading-tight tabular-nums">{price ? priceText(price) : "—"}</p>
          {change !== null && <p className={cn("text-sm tabular-nums", change >= 0 ? "text-up" : "text-down")}>{change >= 0 ? "+" : ""}{(change * 100).toFixed(2)}%</p>}
          <p className="text-sm text-muted">simulated price</p>
        </div>
      </header>

      <div className="grid gap-6 desk:grid-cols-[minmax(0,1fr)_380px] desk:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {points.length > 1 ? (
            <section aria-label="Chart"><PriceChart points={points} up={(change ?? 0) >= 0} /></section>
          ) : (
            <div className="grid h-[260px] place-items-center rounded-md border border-dashed border-border text-sm text-muted">No trades yet. The chart starts with the first one.</div>
          )}
          {coin.config.kind !== "classic" && <CoinLoopFor coin={coin} />}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {sim && coin.config.kind !== "classic" && <PoolPanel coin={coin} sim={sim} price={price} />}
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
                  <button key={f} type="button" disabled={!(payBalance > 0)} onClick={() => { const d = side === "buy" ? 6 : 8; setAmount(String(Math.floor(payBalance * f * 10 ** d) / 10 ** d)); }}
                    className="min-h-9 flex-1 rounded-full border border-border-strong text-sm transition-colors hover:border-black disabled:opacity-40">{f === 1 ? "Max" : `${f * 100}%`}</button>
                ))}
              </div>
            </div>

            <div className="relative z-[1] -my-4 flex justify-center">
              <button type="button" onClick={() => { setSide(side === "buy" ? "sell" : "buy"); setAmount(""); }} aria-label="Switch buy and sell"
                className="grid size-10 place-items-center rounded-full border border-border-strong bg-white transition-colors hover:border-black">
                <ArrowsDownUpIcon weight="bold" className="size-4" />
              </button>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>You receive</span>
                <span className="tabular-nums">Balance {fmt(side === "buy" ? held : demo.bnb, 6)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[32px] leading-none tabular-nums text-muted">{receive !== null ? fmt(receive, 6) : "—"}</span>
                <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{getLabel}</span>
              </div>
            </div>
          </section>

          {!demo.active && !wallet.isConnected ? (
            <div className="flex flex-col items-center gap-3">
              <WalletEntry className={cn(cleanButton.solid, "min-h-12 w-full justify-center")} />
              <button type="button" className="text-sm text-muted underline-offset-4 hover:text-black hover:underline" onClick={startDemo}>Try without a wallet</button>
            </div>
          ) : (
            <button type="button" onClick={submit} disabled={demo.active && (!valid || short || !price || !bnbUsd)}
              className="min-h-12 rounded-md bg-black text-base text-white transition-opacity disabled:opacity-40">
              {!demo.active ? "Try it simulated" : !valid ? "Enter an amount" : short ? `Not enough ${payLabel}` : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
            </button>
          )}
          <p className="-mt-3 text-center text-sm text-muted">Simulated · BSC testnet</p>
        </div>
      </div>
    </div>
  );
}
