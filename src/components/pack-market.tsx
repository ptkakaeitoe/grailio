"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { SealedPack } from "@/components/pack-shop";
import { ClassicPack, lineOf } from "@/components/classic-pack-shop";
import { cleanChip, cleanField, cn } from "@/components/clean-ui";
import type { MarketCoin } from "@/lib/market";
import { useMarketCoins } from "@/lib/published-packs";
import { useLaunchSim } from "@/lib/demo-launch";
import { customPack } from "@/lib/design";
import { usd } from "@/lib/format";

/*
 * Pack marketplace: a Classic | New-gen selector at the top (kept in the URL as ?tab=classic; New-gen is the default),
 * and the selected collection's grid of compact cards (1 column on phones, 2 from 481px, 3 from 801px,
 * 4 from 1201px):
 *  - Classic collections: packs not backed by a coin, in the same card style as New-gen. Collections published from
 *    Launch (config.kind === "classic", newest first, opening /app/packs/<slug>), then the built-in line (/app/packs/classic).
 *  - New-gen collections: coin-backed packs, one card per coin (its packs fanned, avatar, name, pool or presale,
 *    launchpad), opening /app/packs/<coin>. Sort and search apply here.
 * Graily's look: section titles and bracketed labels, hairline borders, outlined chips.
 */

const SORTS = [
  { id: "trending", label: "Trending", by: (a: MarketCoin, b: MarketCoin) => b.volumeUsd - a.volumeUsd },
  { id: "new", label: "New", by: (a: MarketCoin, b: MarketCoin) => a.ageDays - b.ageDays },
  { id: "pool", label: "Pool size", by: (a: MarketCoin, b: MarketCoin) => b.poolUsd - a.poolUsd },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const TABS = [
  { id: "classic", label: "Classic", href: "/app/packs?tab=classic" },
  { id: "newgen", label: "New-gen", href: "/app/packs" },
] as const;

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

function CardFoot({ title, meta, avatar }: { title: string; meta: string; avatar?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 px-0.5 pt-2.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base leading-tight font-normal">{title}</h3>
        <p className="num mt-0.5 truncate text-[13px] text-muted">{meta}</p>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-black" aria-hidden="true" />
    </div>
  );
}

function CoinCard({ coin }: { coin: MarketCoin }) {
  const sim = useLaunchSim(coin);
  const offered = coin.config.sizes.filter((s) => coin.packs.some((p) => p.size === s.id));
  const sizes = (offered.length ? offered : coin.config.sizes).slice(0, 3);
  const custom = customPack(coin.config);
  const status = !coin.config.onchain && sim.phase === "presale"
    ? `Presale · ${sim.packsSold}/${sim.packsForSale} packs`
    : `Pool ${compact(coin.config.onchain ? coin.poolUsd : sim.pool)}`;
  return (
    <li className="min-w-0">
      <Link href={`/app/packs/${coin.slug}`} className={card} aria-label={`${coin.name} packs`}>
        <div className={stage} aria-hidden="true">
          {sizes.map((s, i) => (
            <Sleeve key={s.id} i={i} n={sizes.length}>
              <SealedPack size={s} coin={coin.name} color={custom?.color ?? coin.packs.find((p) => p.size === s.id)?.color} style={custom?.style} className="h-full justify-between shadow-none" />
            </Sleeve>
          ))}
        </div>
        <CardFoot
          title={coin.name}
          meta={`${status} · ${PAD_NAME[coin.launchpad]}`}
          avatar={
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-base text-[#fff]" style={custom?.style ?? { background: coin.tone }} aria-hidden="true">
              {coin.config.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the launched coin
                <img src={coin.config.image} alt="" className="size-full object-cover" />
              ) : coin.name[0]}
            </span>
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
      <h2 id={id} className="min-w-0 truncate text-[22px] leading-[1.2] font-normal tracking-tight desk:text-[28px]">{title}</h2>
      <span className="num shrink-0 text-sm text-muted">[ {String(n).padStart(2, "0")}<span className="max-phone:hidden"> {noun}</span> ]</span>
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
  const href = coin ? `/app/packs/${coin.slug}` : "/app/packs/classic";
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
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-base text-[#fff]" style={coin ? custom?.style ?? { background: coin.tone } : { background: "#111", boxShadow: "inset 0 0 0 1px #fff3" }} aria-hidden="true">
              {coin?.config.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the collection
                <img src={coin.config.image} alt="" className="size-full object-cover" />
              ) : line.name[0]}
            </span>
          }
        />
      </Link>
    </li>
  );
}

function ClassicSection({ published }: { published: MarketCoin[] }) {
  const total = 1 + published.length;
  return (
    <section className="pb-8" aria-labelledby="classic-title">
      <SectionTitle id="classic-title" title="Classic collections" n={total} noun={total === 1 ? "collection" : "collections"} />
      <ul className={grid}>
        {[...published].reverse().map((c) => <ClassicCollectionCard key={c.slug} coin={c} />)}
        <ClassicCollectionCard />
      </ul>
    </section>
  );
}

export function PackMarket() {
  const [sort, setSort] = useState<SortId>("trending");
  const [query, setQuery] = useState("");
  const all = useMarketCoins();
  // Classic collections published from Launch list under Classic; New-gen is coin-backed packs only.
  const classics = useMemo(() => all.filter((c) => c.config.kind === "classic"), [all]);
  const coins = useMemo(() => all.filter((c) => c.config.kind !== "classic"), [all]);
  const tab = useSearchParams().get("tab") === "classic" ? "classic" : "newgen";
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coins.filter((c) => !q || c.name.toLowerCase().includes(q)).sort(SORTS.find((s) => s.id === sort)!.by);
  }, [coins, sort, query]);

  return (
    <div className="page pt-6 desk:pt-10">
      <header className="grid grid-cols-1 items-start gap-3 pb-6 desk:grid-cols-2 desk:gap-8 desk:pb-10">
        <p className="text-sm text-muted max-desk:hidden">[ pack marketplace ]</p>
        <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:text-[clamp(40px,4.5vw,56px)]">Packs</h1>
      </header>

      <nav className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-border p-1 desk:mb-8 desk:max-w-[360px]" aria-label="Collections">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} replace scroll={false} aria-current={tab === t.id ? "page" : undefined}
            className="inline-flex min-h-11 items-center justify-center rounded-[4px] text-sm text-muted transition-colors hover:text-black aria-[current=page]:bg-black aria-[current=page]:text-white">
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "classic" ? <ClassicSection published={classics} /> : (
      <section className="pb-8" aria-labelledby="newgen-title">
        <SectionTitle id="newgen-title" title="New-gen collections" n={coins.length} noun={coins.length === 1 ? "coin" : "coins"} />
        <div className="mb-5 flex flex-col gap-3 desk:mb-6 desk:flex-row desk:items-center desk:justify-between">
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

        {shown.length ? <ul className={grid}>{shown.map((c) => <CoinCard key={c.slug} coin={c} />)}</ul> : (
          <p className="rounded-md border border-dashed border-border-strong py-12 text-center text-base text-muted">{query.trim() ? <>No coins match &ldquo;{query.trim()}&rdquo;.</> : <>No packs yet. <Link href="/launch" className="text-black underline underline-offset-4">Launch a coin</Link>.</>}</p>
        )}
      </section>
      )}
    </div>
  );
}
