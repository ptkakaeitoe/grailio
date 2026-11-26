"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownUp, ArrowLeft } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { cleanButton, cn } from "@/components/clean-ui";
import { TryDemoLink } from "@/components/get-started";
import { WalletEntry } from "@/components/wallet-entry";
import { useAccount } from "wagmi";
import { startDemo, tradeDemo, tradeDemoBnb, useDemo } from "@/lib/demo";
import { demoTokenPrice } from "@/lib/market";
import { launchMcap, simOf, simTokenHistory, simTokenPrice, TOTAL_SUPPLY, tradeTokenSim, useDemoLaunches, type LaunchSim } from "@/lib/demo-launch";
import { PriceChart } from "@/components/price-chart";
import { tradableTicker } from "@/lib/trade-market";
import { useMarketPrice, useStockBalance, useTradeMarket, type TradeCurrency } from "@/lib/use-trade-market";
import type { MarketCoin } from "@/lib/market";
import { CoinPackLink } from "@/components/coin-link";
import { useMarketCoins } from "@/lib/published-packs";
import { stockOf } from "@/lib/stocks";
import { showToast } from "@/lib/toast";
import { ago, usd } from "@/lib/format";
import type { AtlasQuote } from "@/lib/atlas";
import { gapPct, useCmc } from "@/lib/use-cmc";
import { CoinAvatar } from "@/components/coin-avatar";

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

const AGREE_PCT = 1;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

/**
 * A stock's price data, for checking it: the Atlas feed and when it was signed, its consensus, and how it compares with
 * CoinMarketCap and with the average across tokenized versions of the stock. (The Trade list keeps only the essentials.)
 */
function StockPriceData({ ticker, quote }: { ticker: string; quote: AtlasQuote | null }) {
  const cmc = useCmc([ticker]);
  const m = cmc.byTicker.get(ticker);
  // Clock starts at 0 and is set after mount, so the server render never reads the time.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  const vsCmc = gapPct(quote?.price, m?.price);
  const vsStock = gapPct(m?.price, m?.underlyingAvg);
  const healthy = quote?.consensusStatus === "HEALTHY";
  const rows: [string, ReactNode][] = [
    ["Atlas feed", quote ? `#${quote.id}` : "—"],
    ["Signed", quote && now ? ago(quote.timestamp, now) : "—"],
    ["Consensus", quote?.consensusScore == null ? "—" : (
      <>{quote.consensusScore.toFixed(2)} <span className={healthy ? "text-up" : "text-warn"}>{quote.consensusStatus?.toLowerCase()}</span></>
    )],
    ["CoinMarketCap", m?.price ? (
      <>{usd(m.price, m.price < 1 ? 4 : 2)}{vsCmc !== null && <span className={cn("ml-1.5", Math.abs(vsCmc) > AGREE_PCT ? "text-warn" : "text-muted")}>Atlas {signed(vsCmc)}</span>}</>
    ) : "—"],
    ["vs the stock", vsStock === null ? "—" : (
      <><span className={Math.abs(vsStock) > AGREE_PCT ? "text-warn" : undefined}>{signed(vsStock)}</span><span className="ml-1.5 text-muted">avg of {m?.issuers} issuers</span></>
    )],
  ];
  return (
    <section aria-label="Price data" className="rounded-md border border-border p-4">
      <h2 className="mb-3 text-sm text-muted">Price data</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
      <Link href={`/app/packs/${coin.slug}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border-strong text-sm transition-colors hover:border-black">Open packs</Link>
    </section>
  );
}

export function TradeScreen({ asset }: { asset: Asset }) {
  const demo = useDemo();
  const wallet = useAccount();
  const coins = useMarketCoins();
  const sims = useDemoLaunches();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("24H");
  const [history, setHistory] = useState<Point[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [atlasQuote, setAtlasQuote] = useState<AtlasQuote | null>(null);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const stock = asset.kind === "stock" ? stockOf(asset.ticker) : null;
  const coin = asset.kind === "token" ? coins.find((c) => c.slug === asset.slug) : null;
  const isBnb = asset.kind === "bnb";
  const key = asset.kind === "stock" ? asset.ticker : asset.kind === "token" ? `token:${asset.slug}` : "bnb";
  const symbol = isBnb ? "BNB" : stock ? stock.ticker : coin ? coin.config.ticker || coin.name : "";
  const price = isBnb ? bnbUsd : stock ? livePrice : coin ? simTokenPrice(sims, coin) ?? demoTokenPrice(coin) : null;
  // Coins: one chart point per demo trade (lib/demo-launch).
  const coinHistory = coin ? simTokenHistory(sims, coin) : [];
  const sim = coin ? simOf(sims, coin) : null;
  /** What you pay with: BNB for stocks and tokens, USDT for BNB. */
  // Real trades: a listed stock, a wallet on BSC testnet and the trade market deployed (lib/use-trade-market).
  const trade = useTradeMarket();
  const liveTicker = stock && trade.live && tradableTicker(stock.ticker) ? stock.ticker : null;
  const [payWith, setPayWith] = useState<TradeCurrency>("USD");
  // Selling always pays out test USD; buying pays test USD or tBNB.
  const liveQuote: TradeCurrency = side === "buy" ? payWith : "USD";
  const marketPrice = useMarketPrice(liveTicker, liveQuote);
  const liveStock = useStockBalance(liveTicker);
  const quote = liveTicker ? (liveQuote === "USD" ? "USD" : "tBNB") : isBnb ? "USDT" : "BNB";
  const quoteUsd = isBnb ? 1 : bnbUsd;
  const chartTicker = isBnb ? "BNB" : stock?.ticker;

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => { if (typeof d.price === "number" && d.price > 0) setBnbUsd(d.price); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!stock?.feedId) return;
    fetch(`/api/atlas?ids=${stock.feedId}`).then((r) => r.json()).then((d: { quotes?: AtlasQuote[] }) => {
      const q = d.quotes?.[0];
      if (q && typeof q.price === "number") { setLivePrice(q.price); setAtlasQuote(q); }
    }).catch(() => {});
  }, [stock?.feedId]);
  useEffect(() => {
    if (!chartTicker) return;
    let live = true;
    fetch(`/api/history?ticker=${chartTicker}&period=${period}`).then((r) => r.json()).then((d: { points?: Point[] }) => { if (live) setHistory(d.points ?? []); }).catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [chartTicker, period]);

  const points = coin ? coinHistory : history;
  const change = points.length > 1 ? (points.at(-1)!.p - points[0].p) / points[0].p : null;
  const held = liveTicker ? liveStock.balance ?? 0 : isBnb ? demo.bnb : demo.assets?.[key] ?? 0;
  const quoteBalance = liveTicker ? (liveQuote === "USD" ? trade.usdBalance : trade.bnbBalance) ?? 0 : isBnb ? demo.usdt : demo.bnb;
  // Live tBNB keeps 0.001 back for gas.
  const payBalance = side === "buy" ? (liveTicker && liveQuote === "BNB" ? Math.max(0, quoteBalance - 0.001) : quoteBalance) : held;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const receive = useMemo(() => {
    if (!valid) return null;
    // Live: the market's own price (quote units per stock); demo: Atlas price and BNB/USD.
    if (liveTicker) return marketPrice ? (side === "buy" ? value / marketPrice : value * marketPrice) : null;
    if (!price || !quoteUsd) return null;
    return side === "buy" ? (value * quoteUsd) / price : (value * price) / quoteUsd;
  }, [valid, value, price, quoteUsd, side, liveTicker, marketPrice]);
  const payLabel = side === "buy" ? quote : symbol;
  const getLabel = side === "buy" ? symbol : quote;
  const short = valid && value > payBalance + 1e-12;

  if ((asset.kind === "token" && !coin) || (asset.kind === "stock" && !stock)) return <p className="py-16 text-center text-base text-muted">This isn&apos;t listed.</p>;

  async function submitLive(ticker: string) {
    const ok = side === "buy" ? await trade.buy(ticker, payWith, amount) : await trade.sell(ticker, amount);
    if (ok) { setAmount(""); void liveStock.refetch(); }
  }

  function submit() {
    if (liveTicker) { void submitLive(liveTicker); return; }
    if (!demo.active) { startDemo(); return; }
    if (!valid || !price || !bnbUsd) return;
    if (isBnb ? tradeDemoBnb(side, value, bnbUsd) : tradeDemo(side, key, value, price, bnbUsd)) {
      // Coins: the trade moves the demo price and its tax fills the pool.
      if (coin) tradeTokenSim(coin, side, side === "buy" ? value * bnbUsd : value * price);
      showToast({ kind: "success", title: `${side === "buy" ? "Bought" : "Sold"} ${fmt(side === "buy" ? receive ?? 0 : value, 4)} ${symbol}`, detail: "Simulated · BSC testnet" });
      setAmount("");
    }
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 pb-10 desk:max-w-[1180px] desk:pt-8">
      <Link href="/app/trade" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm text-muted hover:text-black"><ArrowLeft className="size-4" /> Trade</Link>

      <header className="flex items-center gap-3">
        {isBnb ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0b90b] text-[13px] font-semibold text-[#111]" aria-hidden="true">BNB</span>
        ) : stock ? <StockLogo ticker={stock.ticker} size={40} /> : (
          <CoinAvatar seed={coin!.slug || coin!.name} tone={coin!.tone} image={coin!.config.image} className="size-10 rounded-full" />
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

      <div className="grid gap-6 desk:grid-cols-[minmax(0,1fr)_380px] desk:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {chartTicker ? (
            <section aria-label="Chart">
              {history.length > 1 ? <PriceChart points={history} up={(change ?? 0) >= 0} /> : <div className="grid h-[260px] place-items-center text-sm text-muted">Loading chart…</div>}
              <div className="mt-2 flex gap-1" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
                    className="min-h-9 rounded-md px-3 text-sm text-muted transition-colors aria-pressed:bg-surface-muted aria-pressed:text-black">{p}</button>
                ))}
              </div>
            </section>
          ) : coinHistory.length > 1 ? (
            <section aria-label="Chart"><PriceChart points={coinHistory} up={(change ?? 0) >= 0} /></section>
          ) : (
            <div className="grid h-[260px] place-items-center rounded-md border border-dashed border-border text-sm text-muted">No trades yet. The chart starts with the first one.</div>
          )}
          {coin && coin.config.kind !== "classic" && <CoinPackLink market={coin} page="coin" />}
          {stock && <StockPriceData ticker={stock.ticker} quote={atlasQuote} />}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
      {coin && sim && coin.config.kind !== "classic" && <PoolPanel coin={coin} sim={sim} price={price} />}
      <section aria-label="Swap" className="flex flex-col gap-1.5">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <div className="flex items-baseline justify-between text-sm text-muted">
            <span>You pay</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              Balance {fmt(payBalance, 6)}
              {liveTicker && side === "buy" && payWith === "USD" && (
                <button type="button" className="text-black underline-offset-4 hover:underline disabled:opacity-40" disabled={Boolean(trade.busy)} onClick={() => { void trade.claimUsd(); }}>Claim 100</button>
              )}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={`Amount of ${payLabel}`}
              className="min-w-0 flex-1 bg-transparent text-[32px] leading-none tabular-nums outline-none placeholder:text-muted" />
            {liveTicker && side === "buy" ? (
              <button type="button" onClick={() => { setPayWith(payWith === "USD" ? "BNB" : "USD"); setAmount(""); }} aria-label={`Paying with ${payLabel}; switch`}
                className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm transition-colors hover:border-black">{payLabel} ⇄</button>
            ) : (
              <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{payLabel}</span>
            )}
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

      {!liveTicker && !demo.active && !wallet.isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <WalletEntry className={cn(cleanButton.solid, "min-h-12 w-full justify-center")} />
          <TryDemoLink />
        </div>
      ) : (
        <button type="button" onClick={submit} disabled={liveTicker ? !valid || short || !marketPrice || Boolean(trade.busy) : demo.active && (!valid || short || !price || !bnbUsd)}
          className="min-h-12 rounded-md bg-black text-base text-white transition-opacity disabled:opacity-40">
          {liveTicker && trade.busy ? trade.busy : !liveTicker && !demo.active ? "Try it simulated" : !valid ? "Enter an amount" : short ? `Not enough ${payLabel}` : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </button>
      )}
      <p className="-mt-3 text-center text-sm text-muted">{liveTicker ? "BSC testnet · real transaction" : "Simulated"}</p>
        </div>
      </div>
    </div>
  );
}
