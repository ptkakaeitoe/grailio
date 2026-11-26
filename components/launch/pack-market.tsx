"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import { SealedPack } from "@/components/launch/pack-shop";
import { ClassicPack, lineOf } from "@/components/launch/classic-pack-shop";
import { cleanChip, cleanField, cn } from "@/components/clean-ui";
import { sectionLabel, sectionTitle } from "@/components/market-parts";
import type { MarketCoin } from "@/lib/launch/market";
import { useMarketCoins } from "@/lib/launch/published-packs";
import { useLaunchSim } from "@/lib/launch/demo-launch";
import { customPack } from "@/lib/launch/design";
import { usd } from "@/lib/launch/format";
import { CoinAvatar } from "@/components/launch/coin-avatar";
import { TokenIcon } from "@/components/token-icon";
import { usePublicClient } from "wagmi";
import { appChain } from "@/lib/launch/chain";
import { SALE, saleVaultAbi } from "@/lib/launch/onchain";
import { launcherAbi } from "@/lib/launch/flap";

/*
 * Launched packs (testnet): every launched coin's packs and every collection published from Launch, as compact cards
 * (1 column on phones, 2 from 481px, 3 from 801px, 4 from 1201px) with sort and search. Shown on /packs below the
 * stock packs.
 */

const SORTS = [
  { id: "trending", label: "Trending", by: (a: MarketCoin, b: MarketCoin) => b.volumeUsd - a.volumeUsd },
  { id: "new", label: "New", by: (a: MarketCoin, b: MarketCoin) => a.ageDays - b.ageDays },
  { id: "pool", label: "Pool size", by: (a: MarketCoin, b: MarketCoin) => b.poolUsd - a.poolUsd },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const PAD_NAME = { flap: "Flap", four: "Four.meme" } as const;

/** SealedPack is laid out at 228px wide; cards show it scaled down. */
const PACK_W = 228;
const PACK_H = 384;
const SCALE = 0.4;
/** Fan of up to three sleeves: rotation and sideways shift, left to right. */
const FAN = [{ r: -9, x: -58 }, { r: 0, x: 0 }, { r: 9, x: 58 }];

const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : usd(v, 0));

const grid = "grid grid-cols-1 gap-3 phone:grid-cols-2 desk:grid-cols-3 desk:gap-5 wide:grid-cols-4";
const card = "group flex min-w-0 flex-col rounded-md border border-border p-2.5 transition-colors hover:border-black focus-visible:outline-offset-4";
const stage = "relative isolate h-[176px] overflow-hidden rounded-[4px] bg-surface-muted";

/** One sleeve, scaled down and placed in the fan. */
function Sleeve({ i, n, children }: { i: number; n: number; children: React.ReactNode }) {
  const f = n === 1 ? FAN[1] : n === 2 ? FAN[i === 0 ? 0 : 2] : FAN[i];
  const x = n === 2 ? f.x * 0.6 : f.x;
  return (
    <div className="absolute top-1/2 left-1/2 transition-transform duration-300 group-hover:-translate-y-1"
      style={{ width: PACK_W * SCALE, height: PACK_H * SCALE, marginLeft: (-PACK_W * SCALE) / 2 + x, marginTop: (-PACK_H * SCALE) / 2 + 6, rotate: `${f.r}deg`, zIndex: f.r === 0 ? 2 : 1 }}>
      <div className="overflow-hidden rounded-[4px] shadow-[0_10px_20px_-12px_#000c]" style={{ width: PACK_W, height: PACK_H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function CardFoot({ title, meta, avatar, badge }: { title: string; meta: ReactNode; avatar?: React.ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 px-0.5 pt-2.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <h3 className="flex min-w-0 items-center gap-2 text-base leading-tight font-normal"><span className="truncate">{title}</span>{badge}</h3>
        <p className="tabular-nums mt-0.5 truncate text-[13px] text-muted">{meta}</p>
      </div>
      <ArrowUpRightIcon weight="bold" className="size-4 shrink-0 text-muted transition-colors group-hover:text-black" aria-hidden="true" />
    </div>
  );
}

/** An on-chain coin's sale progress, read from its sale vault (Four.meme) or launcher (Flap). null until read. */
function useOnchainSale(coin: MarketCoin) {
  const client = usePublicClient({ chainId: appChain.id });
  const oc = coin.config.onchain;
  const [sale, setSale] = useState<{ live: boolean; sold: number; forSale: number } | null>(null);
  useEffect(() => {
    if (!client || !oc) return;
    let on = true;
    const read = oc.pad === "flap" && oc.launcher
      ? Promise.all([
          client.readContract({ address: oc.launcher, abi: launcherAbi, functionName: "launched" }),
          client.readContract({ address: oc.launcher, abi: launcherAbi, functionName: "packsSold" }),
          client.readContract({ address: oc.launcher, abi: launcherAbi, functionName: "packsForSale" }),
        ]).then(([launched, sold, forSale]) => ({ live: launched as boolean, sold: Number(sold), forSale: Number(forSale) }))
      : Promise.all([
          client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "phase" }),
          client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "remainingForSale" }),
        ]).then(([phase, remaining]) => {
          const forSale = Number(SALE.saleAmount / SALE.tokensPerPack);
          return { live: Number(phase) >= 3, sold: forSale - Number((remaining as bigint) / SALE.tokensPerPack), forSale };
        });
    read.then((v) => { if (on) setSale(v); }, () => {});
    return () => { on = false; };
  }, [client, oc]);
  return sale;
}

const phaseBadge = (live: boolean) => (
  <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[11px]", live ? "bg-up/15 text-up" : "bg-surface-muted text-muted")}>
    <span className={cn("size-1 rounded-full", live ? "bg-up" : "bg-black")} aria-hidden="true" />{live ? "Live" : "Presale"}
  </span>
);

function CoinCard({ coin }: { coin: MarketCoin }) {
  const sim = useLaunchSim(coin);
  const chainSale = useOnchainSale(coin);
  const offered = coin.config.sizes.filter((s) => coin.packs.some((p) => p.size === s.id));
  const sizes = (offered.length ? offered : coin.config.sizes).slice(0, 3);
  const custom = customPack(coin.config);
  const onchain = Boolean(coin.config.onchain);
  // On-chain coins show what the chain says; simulated ones their simulation.
  const live = onchain ? Boolean(chainSale?.live) : sim.phase === "live";
  const status = onchain
    ? chainSale ? (chainSale.live ? "Packs open" : `${chainSale.sold}/${chainSale.forSale} sold`) : "…"
    : live ? `Pool ${compact(sim.pool)}` : `${sim.packsSold}/${sim.packsForSale} sold`;
  const pad = coin.config.onchain?.pad ?? coin.launchpad;
  return (
    <li className="min-w-0">
      <Link href={`/packs/${coin.slug}`} className={card} aria-label={`${coin.name} packs`}>
        <div className={stage} aria-hidden="true">
          {sizes.map((s, i) => (
            <Sleeve key={s.id} i={i} n={sizes.length}>
              <SealedPack size={s} coin={coin.name} color={custom?.color ?? coin.packs.find((p) => p.size === s.id)?.color} style={custom?.style} className="h-full justify-between shadow-none" />
            </Sleeve>
          ))}
        </div>
        <CardFoot
          title={coin.name}
          badge={phaseBadge(live)}
          meta={
            <span className="inline-flex items-center gap-1.5">
              {status} ·
              {onchain ? <><TokenIcon symbol={pad === "flap" ? "FLAP" : "FOUR"} className="size-3.5" /> {PAD_NAME[pad as keyof typeof PAD_NAME] ?? "On-chain"}</> : "Simulated"}
            </span>
          }
          avatar={
            <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} style={custom?.style} className="size-9 rounded-full" />
          }
        />
      </Link>
    </li>
  );
}

/** Title and a zero-padded count; the count's noun is dropped on narrow phones so it stays on one line. */
function SectionTitle({ id, title, n, noun }: { id: string; title: string; n: number; noun: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-4 desk:pb-6">
      <h2 id={id} className={cn(sectionTitle, "min-w-0 truncate")}>{title}</h2>
      <span className={cn(sectionLabel, "shrink-0 tabular-nums")}>[ {String(n).padStart(2, "0")}<span className="max-phone:hidden"> {noun}</span> ]</span>
    </div>
  );
}

/** A classic collection (no coin), styled like a coin card: its packs fanned, avatar, name, price and stock count.
 *  Without `coin` it's the built-in Classic line. */
function ClassicCollectionCard({ coin }: { coin?: MarketCoin }) {
  const line = lineOf(coin);
  const sizes = line.sizes.slice(0, 3);
  const custom = customPack(coin?.config);
  const from = usd(Math.min(...line.sizes.map((s) => s.price)), 0);
  const href = coin ? `/packs/${coin.slug}` : "/packs/classic";
  return (
    <li className="min-w-0">
      <Link href={href} className={card} aria-label={`${line.name} packs`}>
        <div className={stage} aria-hidden="true">
          {sizes.map((s, i) => (
            <Sleeve key={s.id} i={i} n={sizes.length}><ClassicPack size={s} coin={coin} className="h-full justify-between shadow-none" /></Sleeve>
          ))}
        </div>
        <CardFoot
          title={line.name}
          meta={`From ${from} · ${line.basket.length} ${line.basket.length === 1 ? "stock" : "stocks"}`}
          avatar={
            <CoinAvatar seed={coin ? coin.slug || coin.name : line.name} tone={coin?.tone} image={coin?.config.image} style={coin ? custom?.style : undefined} className="size-9 rounded-full" />
          }
        />
      </Link>
    </li>
  );
}

/**
 * Testnet packs page, below the stock packs: every launched coin's packs and every collection published from Launch,
 * with sort, search and a way to launch one. (PackMarket above is the standalone page this came from.)
 */
export function LaunchedPacks() {
  const [sort, setSort] = useState<SortId>("trending");
  const [query, setQuery] = useState("");
  const all = useMarketCoins();
  const classics = useMemo(() => all.filter((c) => c.config.kind === "classic"), [all]);
  const coins = useMemo(() => all.filter((c) => c.config.kind !== "classic"), [all]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coins.filter((c) => !q || c.name.toLowerCase().includes(q)).sort(SORTS.find((s) => s.id === sort)!.by);
  }, [coins, sort, query]);
  const total = coins.length + classics.length;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <SectionTitle id="launched-title" title="Launched" n={total} noun={total === 1 ? "pack" : "packs"} />
        <Link href="/launch" className="mb-4 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3.5 text-sm transition-colors hover:border-black desk:mb-6">
          Launch a coin <ArrowUpRightIcon weight="bold" className="size-4" />
        </Link>
      </div>
      <div className="mb-5 flex flex-col gap-3 desk:mb-6 desk:flex-row desk:items-center desk:justify-between">
        <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] [scrollbar-width:none] desk:mx-0 desk:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Sort coins">
          {SORTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}
              className={cn(cleanChip, "min-h-11 shrink-0 px-4 desk:min-h-9 desk:px-3")}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="relative w-full desk:max-w-[300px]">
          <span className="sr-only">Search coins</span>
          <MagnifyingGlassIcon weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coins"
            className={cn(cleanField, "pl-10 placeholder:text-muted hover:border-black")} />
        </label>
      </div>
      {shown.length || classics.length ? (
        <ul className={grid}>
          {shown.map((c) => <CoinCard key={c.slug} coin={c} />)}
          {!query.trim() && [...classics].reverse().map((c) => <ClassicCollectionCard key={c.slug} coin={c} />)}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border-strong py-12 text-center text-base text-muted">{query.trim() ? <>No coins match &ldquo;{query.trim()}&rdquo;.</> : <>No packs yet. <Link href="/launch" className="text-black underline underline-offset-4">Launch a coin</Link>.</>}</p>
      )}
    </div>
  );
}
