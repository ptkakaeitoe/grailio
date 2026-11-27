"use client";

import { usd } from "@/lib/launch/format";

import type { MarketCoin } from "@/lib/launch/market";

import type { CoinPack } from "./types";
import { useCoinPack } from "./use-coin-pack";

/**
 * How the coin funds its packs, as plain numbered steps with the coin's real numbers: the trading tax, the share
 * that fills the stock pool, what the pool pays for, and what stakers earn. With no tax, the presale raise funds it.
 */
export function CoinLoop({ pack }: { pack: CoinPack }) {
  const { pool, stakers } = pack.taxSplit;
  const rate = Math.max(pack.coin.config.buyTax ?? 0, pack.coin.config.sellTax ?? 0);
  const packPrice = pack.phase === "presale" ? pack.presale.price : pack.tiers[0]?.price;
  const priceText = !packPrice ? null : pack.quote === "USD" ? usd(packPrice, packPrice < 10 ? 2 : 0) : `${packPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${pack.quote}`;
  const share = pool >= 100 ? "All of it" : pool === 50 ? "Half of it" : `${pool}% of it`;
  const steps: React.ReactNode[] = pool > 0
    ? [
        <>Every {pack.ticker} trade pays a {rate > 0 ? `${rate}% ` : ""}tax</>,
        <>{share} goes to the stock pool</>,
        <>The pool pays pack prizes in stocks{priceText && <>. Packs cost <b className="font-normal text-black tabular-nums">{priceText}</b></>}</>,
        ...(stakers > 0 ? [<>Staked cards earn {stakers}% of the tax</>] : []),
      ]
    : [
        <>The presale raise funds the stock pool</>,
        <>The pool pays pack prizes in stocks{priceText && <>. Packs cost <b className="font-normal text-black tabular-nums">{priceText}</b></>}</>,
      ];
  return (
    <section className="rounded-md border border-border p-4 phone:p-5" aria-label="How the packs are funded">
      <p className="text-sm">How the packs are funded</p>
      <ol className="mt-3 flex list-none flex-col gap-2.5 p-0">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-muted">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-[11px] tabular-nums text-black" aria-hidden="true">{i + 1}</span>
            <span className="min-w-0 pt-px">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The same strip for a coin page outside the pack page (the coin's trade page), read from the coin's own source. */
export function CoinLoopFor({ coin }: { coin: MarketCoin }) {
  return <CoinLoop pack={useCoinPack(coin)} />;
}
