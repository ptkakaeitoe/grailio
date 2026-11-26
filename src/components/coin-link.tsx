"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SealedPack } from "@/components/pack-shop";
import { coverStyle } from "@/components/launch-design";
import { cn } from "@/components/clean-ui";
import { SEED_SHARE, TAX_SPLIT, launchMcap, packSizeOf, useLaunchSim } from "@/lib/demo-launch";
import { usd } from "@/lib/format";
import type { MarketCoin } from "@/lib/market";

/*
 * How a coin and its packs feed each other, as a small loop on both the pack page and the coin's trade page:
 *  - Presale: packs sell → the raise → the coin launches (70% liquidity), and 30% of the raise becomes the presale prizes.
 *  - Live: coin trades → 50% of the tax fills the stock pool → the pool pays the pack prizes → cards; staked cards
 *    earn 30% of the tax back from the coin.
 * The node for the page you're on is highlighted; the other end links across.
 */

const compact = (v: number) => (v >= 10_000 ? `$${(v / 1000).toFixed(0)}k` : v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : usd(v, 0));
const node = "flex min-w-0 flex-col items-center gap-1.5 rounded-md border border-border bg-surface-muted px-1.5 py-2.5 text-center transition-colors";
const nodeLink = "hover:border-black focus-visible:outline-offset-2";
const here = "border-black";

function Edge({ label, back = false }: { label: string; back?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 text-muted" aria-hidden="true">
      <span className="num text-[10px] leading-none whitespace-nowrap">{label}</span>
      {back ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
    </div>
  );
}

export function CoinPackLink({ market, page }: { market: MarketCoin; page: "packs" | "coin" }) {
  const sim = useLaunchSim(market);
  const size = packSizeOf(market);
  const custom = market.config.design === "custom";
  const color = market.packs.find((p) => p.size === size.id)?.color;
  const ticker = market.config.ticker || market.name;
  const raise = sim.price * sim.packsForSale;
  const mcap = launchMcap(raise);
  const presale = sim.phase === "presale";
  const taxPct = ((market.config.buyTax ?? 3) + (market.config.sellTax ?? 3)) / 2;

  const coinInner = <>
    <span className="grid size-10 place-items-center overflow-hidden rounded-full text-base text-[#fff]" style={{ background: market.tone }}>
      {market.config.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the launched coin
        <img src={market.config.image} alt="" className="size-full object-cover" />
      ) : market.name[0]}
    </span>
    <span className="w-full truncate text-sm">{ticker}</span>
    <span className="num w-full truncate text-[11px] text-muted">{presale ? `${compact(mcap)} at launch` : `${compact(mcap)} mcap`}</span>
  </>;

  const packsInner = <>
    <span className="relative block h-10 w-6 overflow-hidden rounded-[2px]" aria-hidden="true">
      <span className="absolute top-0 left-0 block origin-top-left scale-[0.105]" style={{ width: 228, height: 384 }}>
        <SealedPack size={size} coin={market.name} color={color} style={custom ? coverStyle(market.config.tone, market.config.pattern, market.config.cover) : undefined} className="h-full justify-between shadow-none" />
      </span>
    </span>
    <span className="w-full truncate text-sm">Packs</span>
    <span className="num w-full truncate text-[11px] text-muted">{presale ? `${sim.packsSold}/${sim.packsForSale} sold` : `${usd(sim.price, 0)} each`}</span>
  </>;

  const coinNode = page === "coin"
    ? <div className={cn(node, here)} aria-current="page">{coinInner}</div>
    : <Link href={`/app/trade/token/${market.slug}`} className={cn(node, nodeLink)} aria-label={`Trade ${ticker}`}>{coinInner}</Link>;
  const packsNode = page === "packs"
    ? <div className={cn(node, here)} aria-current="page">{packsInner}</div>
    : <Link href={`/app/packs/${market.slug}`} className={cn(node, nodeLink)} aria-label={`${market.name} packs`}>{packsInner}</Link>;

  return (
    <section aria-label={`How ${ticker} and its packs connect`} className="rounded-md border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        {coinNode}
        <Edge label={presale ? `${Math.round((1 - SEED_SHARE) * 100)}% raise` : `${Math.round(TAX_SPLIT.pool * 100)}% tax`} back={presale} />
        <div className={node}>
          <span className="num grid h-10 place-items-center text-[17px] leading-none">{compact(presale ? raise : sim.pool)}</span>
          <span className="w-full truncate text-sm">{presale ? "Raise" : "Pool"}</span>
          <span className="num w-full truncate text-[11px] text-muted">{presale ? `${sim.packsForSale} × ${usd(sim.price, 0)}` : "stocks"}</span>
        </div>
        <Edge label={presale ? "buys" : "prizes"} back={presale} />
        {packsNode}
      </div>

      {/* The way back: cards from the packs earn the stakers' share of the coin's tax (or, in presale, the prizes). */}
      <div className="relative mx-[16.5%] mt-1 h-5 rounded-b-lg border-x border-b border-dashed border-border-strong" aria-hidden="true">
        <ArrowLeft className="absolute -top-2.5 -left-2 size-4 rotate-90 bg-white text-muted" />
      </div>
      <p className="num mt-1.5 text-center text-[11px] text-muted">
        {presale
          ? `${Math.round(SEED_SHARE * 100)}% of the raise · presale prizes · ${usd(raise * SEED_SHARE, 0)}`
          : `Staked cards earn ${Math.round(TAX_SPLIT.stakers * 100)}% of the ${taxPct}% tax`}
      </p>
    </section>
  );
}
