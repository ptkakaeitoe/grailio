"use client";

import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { CoinAvatar } from "@/components/launch/coin-avatar";
import { usd } from "@/lib/launch/format";

import type { CoinPack } from "./types";

const node = "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md border border-border px-3 py-4 text-center";
const compact = (n: number | null) =>
  n === null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : usd(n, n < 10 ? 2 : 0);

/**
 * How the coin feeds its packs, from the coin's real numbers: the coin (its mcap) → what fills the pool (the trading
 * tax's pool share, or the presale raise when there's no tax) → the stock pool → the packs. Under it, what stakers get.
 */
export function CoinLoop({ pack }: { pack: CoinPack }) {
  const taxToPool = pack.taxSplit.pool;
  const tier = pack.tiers[0];
  const packPrice = pack.phase === "presale" ? pack.presale.price : tier?.price;
  const priceText = packPrice ? (pack.quote === "USD" ? usd(packPrice, 2) : `${packPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${pack.quote}`) : "—";
  return (
    <figure className="rounded-md border border-border p-3" aria-label="How the coin funds its packs">
      <div className="flex items-stretch gap-1.5">
        <div className={node}>
          <CoinAvatar seed={pack.coin.slug} tone={pack.coin.tone} image={pack.coin.config.image} className="size-8 rounded-full" />
          <span className="text-sm">{pack.ticker}</span>
          <span className="text-[12px] text-muted tabular-nums">{compact(pack.mcapUsd)} mcap</span>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted">
          <span>{taxToPool > 0 ? `${taxToPool}% of tax` : "raise"}</span>
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </div>
        <div className={node}>
          <span className="text-lg tabular-nums">{compact(pack.stockPoolUsd)}</span>
          <span className="text-sm">Stock pool</span>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted">
          <span>prizes</span>
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </div>
        <div className={node}>
          <span className="text-lg tabular-nums">{priceText}</span>
          <span className="text-sm">Packs</span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-muted">
        {pack.taxSplit.stakers > 0 ? `Staked cards earn ${pack.taxSplit.stakers}% of the trading tax` : "No trading tax: the presale raise funds the pool"}
      </figcaption>
    </figure>
  );
}
