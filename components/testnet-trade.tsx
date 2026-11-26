"use client";

import { ArrowsDownUpIcon, ArrowUpRightIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";

import { cleanButton, cleanChip, cn } from "@/components/clean-ui";
import { DemoPriceChart } from "@/components/demo-price-chart";
import { TokenIcon } from "@/components/token-icon";
import { WalletEntry } from "@/components/wallet-entry";
import { STOCK_ASSETS } from "@/lib/stock-assets";
import { useMarketPrice, useStockBalance, useTradeMarket, type TradeCurrency } from "@/lib/use-trade-market";
import { tradeLive } from "@/lib/trade-market";

/**
 * Trade on the testnet build (NEXT_PUBLIC_NETWORK=testnet): the mainnet trade layout (chart + box), but the box
 * buys and sells the 15 test stocks on the testnet trade market, paid in Flap's free test USD or tBNB. A short
 * get-started strip covers gas (faucet) and test USD (Claim). Mainnet uses SwapWorkspace instead.
 */
const FAUCET = "https://www.bnbchain.org/en/testnet-faucet";
const STRIP_KEY = "grailio.testnet.getStarted.hidden";
const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });
/** Presets round down, so Max never asks for more than the wallet holds. */
const floorTo = (n: number, d: number) => Math.floor(n * 10 ** d) / 10 ** d;

function GetStarted({ usd, bnb, onClaim, busy }: { usd: number | null; bnb: number | null; onClaim: () => void; busy: boolean }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHidden(localStorage.getItem(STRIP_KEY) === "1"), 0);
    return () => clearTimeout(t);
  }, []);
  const done = (bnb ?? 0) > 0 && (usd ?? 0) > 0;
  if (hidden || done) return null;
  const step = "flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm";
  return (
    <section aria-label="Get started" className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
      <span className="mr-2 text-sm text-muted">Get started on BSC testnet</span>
      <a href={FAUCET} target="_blank" rel="noreferrer" className={cn(step, "hover:border-black")}>1 · Get tBNB for gas <ArrowUpRightIcon weight="bold" /></a>
      <button type="button" className={cn(step, "hover:border-black disabled:opacity-50")} disabled={busy} onClick={onClaim}>2 · Claim 100 test USD</button>
      <span className={cn(step, "text-muted")}>3 · Trade a stock</span>
      <button type="button" className="ml-auto grid size-9 place-items-center rounded-md text-muted hover:text-black" aria-label="Hide" onClick={() => { localStorage.setItem(STRIP_KEY, "1"); setHidden(true); }}>
        <XIcon />
      </button>
    </section>
  );
}

export function TestnetTrade() {
  const t = useTradeMarket();
  const [ticker, setTicker] = useState(STOCK_ASSETS[0]?.ticker ?? "NVDA");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [pay, setPay] = useState<TradeCurrency>("USD");
  const [amount, setAmount] = useState("");
  const held = useStockBalance(t.live ? ticker : null);
  const quote = side === "buy" ? pay : "USD";
  const price = useMarketPrice(ticker, quote);

  const quoteBalance = pay === "BNB" ? Math.max(0, (t.bnbBalance ?? 0) - 0.001) : t.usdBalance ?? 0;
  const payBalance = side === "buy" ? quoteBalance : held.balance ?? 0;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const receive = valid && price ? (side === "buy" ? value / price : value * price) : null;
  const short = valid && value > payBalance + 1e-12;
  const payLabel = side === "buy" ? pay : ticker;
  const getLabel = side === "buy" ? ticker : "USD";

  async function submit() {
    if (!t.live || !valid || short) return;
    const ok = side === "buy" ? await t.buy(ticker, pay, amount) : await t.sell(ticker, amount);
    if (ok) { setAmount(""); void held.refetch(); }
  }

  const label = !tradeLive
    ? "Trading opens soon"
    : t.busy ?? (!valid ? "Enter an amount" : short ? `Not enough ${payLabel}` : `${side === "buy" ? "Buy" : "Sell"} ${ticker}`);

  return (
    <div className="trade-workspace">
      {t.live && <GetStarted usd={t.usdBalance} bnb={t.bnbBalance} busy={Boolean(t.busy)} onClaim={() => { void t.claimUsd(); }} />}
      <div className="trade-layout pt-6 pb-16 desk:pt-16">
        <DemoPriceChart key={ticker} ticker={ticker} markets={STOCK_ASSETS.map((s) => ({ ticker: s.ticker, name: s.name }))} onSelect={(next) => { setTicker(next); setAmount(""); }} />
        <section className="swap-column w-full min-w-0 max-desk:mx-auto max-desk:max-w-[520px]" aria-label="Trade">
          <div className="swap-box rounded-md border border-border p-5 phone:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-[22px] leading-[1.3] font-normal tracking-tight">{side === "buy" ? "Buy" : "Sell"} {ticker}</h2>
              {t.live && (
                <button type="button" className={cleanButton.small} disabled={Boolean(t.busy)} onClick={() => { void t.claimUsd(); }}>
                  {t.usdBalance !== null ? `${fmt(t.usdBalance, 2)} USD · ` : ""}Claim
                </button>
              )}
            </div>

            <div className="rounded-md border border-border bg-surface-muted p-4">
              <div className="flex items-baseline justify-between text-base text-muted">
                <span>You pay</span>
                <span className="tabular-nums">Balance {t.live ? fmt(payBalance) : "—"}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  inputMode="decimal" placeholder="0" value={amount} aria-label={`Amount of ${payLabel}`}
                  onChange={(e) => { if (/^\d*\.?\d{0,18}$/.test(e.target.value)) setAmount(e.target.value); }}
                  className="min-w-0 flex-1 bg-transparent text-[32px] leading-none tabular-nums outline-none placeholder:text-muted"
                />
                {side === "buy" ? (
                  <button type="button" className={cn(cleanChip, "inline-flex items-center gap-1.5")} onClick={() => { setPay(pay === "USD" ? "BNB" : "USD"); setAmount(""); }} aria-label={`Pay with ${pay}; switch`}>
                    <TokenIcon symbol={pay === "USD" ? "USDT" : "BNB"} className="size-4" /> {pay === "BNB" ? "tBNB" : "USD"} ⇄
                  </button>
                ) : (
                  <span className={cn(cleanChip, "inline-flex items-center gap-1.5")}><TokenIcon symbol={ticker} className="size-4" /> {ticker}</span>
                )}
              </div>
              <div className="mt-3 flex gap-1.5">
                {[0.25, 0.5, 0.75, 1].map((f) => (
                  <button key={f} type="button" disabled={!(payBalance > 0)} onClick={() => setAmount(String(floorTo(payBalance * f, side === "buy" ? 6 : 8)))}
                    className={cn(cleanButton.small, "min-h-8 flex-1 rounded-full px-2.5 text-sm")}>{f === 1 ? "Max" : `${f * 100}%`}</button>
                ))}
              </div>
            </div>

            <div className="relative z-[1] -my-3 flex justify-center">
              <button type="button" onClick={() => { setSide(side === "buy" ? "sell" : "buy"); setAmount(""); }} aria-label="Switch buy and sell"
                className="grid size-10 place-items-center rounded-full border border-border-strong bg-white transition-colors hover:border-black">
                <ArrowsDownUpIcon />
              </button>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-baseline justify-between text-base text-muted">
                <span>You receive</span>
                <span className="tabular-nums">{price ? `1 ${ticker} = ${fmt(price, 4)} ${quote === "BNB" ? "tBNB" : "USD"}` : ""}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[32px] leading-none tabular-nums text-muted">{receive !== null ? fmt(receive) : "—"}</span>
                <span className={cn(cleanChip, "inline-flex items-center gap-1.5")}><TokenIcon symbol={side === "buy" ? ticker : "USDT"} className="size-4" /> {getLabel}</span>
              </div>
            </div>

            {t.live ? (
              <button type="button" onClick={() => { void submit(); }} disabled={!tradeLive || Boolean(t.busy) || !valid || short}
                className={cn(cleanButton.solid, "mt-5 h-12 w-full justify-center")}>{label}</button>
            ) : (
              <WalletEntry className={cn(cleanButton.solid, "mt-5 h-12 w-full justify-center")} />
            )}
            <p className="mt-3 text-center text-sm text-muted">BSC testnet · test tokens, no real value</p>
          </div>
        </section>
      </div>
    </div>
  );
}
