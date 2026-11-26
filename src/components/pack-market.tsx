"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { SealedPack } from "@/components/pack-shop";
import { cleanChip, cleanField, cn } from "@/components/clean-ui";
import { MARKET_COINS, type MarketCoin } from "@/lib/market";
import { DEFAULT_SIZES } from "@/lib/pack";
import { usd } from "@/lib/format";

/*
 * Pack marketplace, layout A: one shelf per coin (avatar, name, pool, launchpad), its packs in a row underneath.
 * A pack opens that coin's page on that size; the coin name opens the coin's page.
 * Graily's look: section titles and bracketed labels, hairline rules, outlined chips. Mobile first: the shelves run
 * edge to edge and swipe sideways with snap, like graily's floor strip.
 */

const SORTS = [
  { id: "trending", label: "Trending", by: (a: MarketCoin, b: MarketCoin) => b.volumeUsd - a.volumeUsd },
  { id: "new", label: "New", by: (a: MarketCoin, b: MarketCoin) => a.ageDays - b.ageDays },
  { id: "pool", label: "Pool size", by: (a: MarketCoin, b: MarketCoin) => b.poolUsd - a.poolUsd },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const PAD_NAME = { flap: "Flap", four: "Four.meme" } as const;

/** SealedPack is laid out at 228px wide; shelves show it scaled down. */
const PACK_W = 228;
const PACK_H = 384;
const SCALE = 0.62;

const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : usd(v, 0));

function Shelf({ coin }: { coin: MarketCoin }) {
  const sizes = DEFAULT_SIZES.filter((s) => coin.packs.some((p) => p.size === s.id));
  const href = `/app/packs/${coin.slug}`;
  return (
    <section className="border-t border-border pt-6 pb-7 desk:pt-8 desk:pb-10" aria-labelledby={`coin-${coin.slug}`}>
      <div className="mb-4 flex items-center gap-3 desk:mb-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-lg text-[#111]" style={{ background: coin.tone }} aria-hidden="true">{coin.name[0]}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`coin-${coin.slug}`} className="truncate text-xl leading-[1.25] font-normal tracking-tight desk:text-[22px]">
            <Link href={href} className="underline-offset-4 hover:underline">{coin.name}</Link>
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            <span className="num">Pool {compact(coin.poolUsd)}</span> · {sizes.length} {sizes.length === 1 ? "pack" : "packs"} · {PAD_NAME[coin.launchpad]}
          </p>
        </div>
        <Link href={href} aria-label={`View ${coin.name}`}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm transition-colors hover:border-black max-phone:px-0">
          <span className="max-phone:hidden">View coin</span> <ArrowUpRight className="size-4" />
        </Link>
      </div>
      {/* A sideways strip that snaps pack by pack, running to the screen edges on phones. */}
      <ul className="-mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-[var(--gutter)] pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] desk:gap-5 [&::-webkit-scrollbar]:hidden">
        {sizes.map((s) => (
          <li key={s.id} className="shrink-0 snap-start">
            <Link href={`${href}?size=${s.id}`} className="group block rounded-[4px] focus-visible:outline-offset-[6px]" aria-label={`${coin.name} ${s.name} pack, ${usd(s.price, 0)}`}>
              <div className="relative overflow-hidden rounded-[4px] transition-transform duration-300 group-hover:-translate-y-1" style={{ width: PACK_W * SCALE, height: PACK_H * SCALE }}>
                <div style={{ width: PACK_W, height: PACK_H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
                  <SealedPack size={s} coin={coin.name} color={coin.packs.find((p) => p.size === s.id)?.color} className="h-full justify-between shadow-none" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="truncate text-base">{s.name}</span>
                <span className="num text-[13px] text-muted">{usd(s.price, 0)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PackMarket() {
  const [sort, setSort] = useState<SortId>("trending");
  const [query, setQuery] = useState("");
  const coins = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKET_COINS.filter((c) => !q || c.name.toLowerCase().includes(q)).sort(SORTS.find((s) => s.id === sort)!.by);
  }, [sort, query]);

  return (
    <div className="page pt-6 desk:pt-10">
      <header className="grid grid-cols-1 items-start gap-3 pb-6 desk:grid-cols-2 desk:gap-8 desk:pb-10">
        <p className="text-sm text-muted max-desk:hidden">[ pack marketplace ]</p>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:text-[clamp(40px,4.5vw,56px)]">Packs</h1>
            <span className="num text-sm text-muted desk:hidden">[ {String(MARKET_COINS.length).padStart(2, "0")} coins ]</span>
          </div>
          <p className="mt-2 max-w-[440px] text-base text-muted desk:mt-4">Every coin launches with its own packs. Pick a coin, then a pack.</p>
        </div>
      </header>

      <div className="mb-6 flex flex-col gap-3 desk:mb-8 desk:flex-row desk:items-center desk:justify-between">
        {/* Phones: one row of chips you can swipe instead of wrapping. */}
        <div className="-mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] desk:mx-0 desk:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Sort coins">
          {SORTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}
              className={cn(cleanChip, "min-h-11 shrink-0 px-4 desk:min-h-9 desk:px-3")}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="relative w-full desk:max-w-[300px]">
          <span className="sr-only">Search coins</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coins"
            className={cn(cleanField, "pl-10 placeholder:text-muted hover:border-black")} />
        </label>
      </div>

      {coins.length ? coins.map((c) => <Shelf key={c.slug} coin={c} />) : (
        <p className="border-t border-border py-12 text-center text-base text-muted">No coins match &ldquo;{query.trim()}&rdquo;.</p>
      )}
      <p className="border-t border-border pt-6 text-sm text-muted">Demo coins and pools. Purchases are simulated until launches are live on BSC testnet.</p>
    </div>
  );
}
