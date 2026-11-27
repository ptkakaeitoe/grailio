"use client";

import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { CoinAvatar } from "@/components/launch/coin-avatar";
import { usd } from "@/lib/launch/format";

import type { CoinPack } from "./types";

const compact = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : usd(n, n > 0 && n < 10 ? 2 : 0);

function Node({ value, label }: { value: string; label: React.ReactNode }) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-[17px] leading-tight tabular-nums phone:text-lg">{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1 truncate text-[12px] text-muted phone:text-[13px]">{label}</p>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[11px] leading-none text-muted">
      <span className="whitespace-nowrap">{label}</span>
      <ArrowRightIcon className="size-3.5" aria-hidden="true" />
    </div>
  );
}

/**
 * How the coin feeds its packs, from the coin's real numbers: the coin (its mcap) → what fills the pool (the trading
 * tax's pool share, or the presale raise when there's no tax) → the stock pool → the packs. Under it, what stakers get.
 */
export function CoinLoop({ pack }: { pack: CoinPack }) {
  const taxToPool = pack.taxSplit.pool;
  const packPrice = pack.phase === "presale" ? pack.presale.price : pack.tiers[0]?.price;
  const priceText = !packPrice ? "—" : pack.quote === "USD" ? compact(packPrice) : `${packPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${pack.quote}`;
  return (
    <figure className="rounded-md border border-border px-3 py-4 phone:px-5" aria-label="How the coin funds its packs">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Node
          value={compact(pack.mcapUsd)}
          label={<><CoinAvatar seed={pack.coin.slug} tone={pack.coin.tone} image={pack.coin.config.image} className="size-3.5 shrink-0 rounded-full" /><span className="truncate">{pack.ticker}<span className="max-phone:hidden"> mcap</span></span></>}
        />
        <Arrow label={taxToPool > 0 ? `${taxToPool}% tax` : "raise"} />
        <Node value={compact(pack.stockPoolUsd)} label="Stock pool" />
        <Arrow label="prizes" />
        <Node value={priceText} label="Pack" />
      </div>
      <figcaption className="mt-4 border-t border-border pt-3 text-center text-[12px] text-muted">
        {pack.taxSplit.stakers > 0 ? `Staked cards earn ${pack.taxSplit.stakers}% of the trading tax` : "No trading tax: the presale raise funds the pool"}
      </figcaption>
    </figure>
  );
}
