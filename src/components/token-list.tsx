"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/components/clean-ui";
import { TradeToolbar, tradeList, tradeTable } from "@/components/trade-toolbar";
import { useMarketCoins } from "@/lib/published-packs";
import type { MarketCoin } from "@/lib/market";
import { useDemoLaunches } from "@/lib/demo-launch";
import { CoinAvatar } from "@/components/coin-avatar";

const PAD_NAME = { flap: "Flap", four: "Four.meme" } as const;
type View = "all" | keyof typeof PAD_NAME;
const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`);

function CoinMark({ coin, size }: { coin: MarketCoin; size: "sm" | "md" }) {
  return (
    <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className={cn("rounded-full", size === "sm" ? "size-6" : "size-9")} />
  );
}

/**
 * Launched coins, busiest first, laid out like the bStocks list: the same toolbar (All, Flap, Four.meme), a table from
 * 801px and a compact list on phones. Each row opens the coin's trade screen. Names only, no tickers.
 */
export function TokenList() {
  const market = useMarketCoins();
  const sims = useDemoLaunches();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  // Demo-launched coins: pool and volume from the simulation (volume = tax received / tax rate).
  const coins = useMemo(() => market.filter((c) => c.config.kind !== "classic").map((c) => {
    const s = sims[c.slug];
    if (!s) return c;
    const tax = s.tax.pool + s.tax.stakers + s.tax.creator + s.tax.platform;
    const rate = ((c.config.buyTax ?? 3) + (c.config.sellTax ?? 3)) / 200;
    return { ...c, poolUsd: s.pool, volumeUsd: rate > 0 ? tax / rate : 0 };
  }), [market, sims]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coins
      .filter((c) => (view === "all" || c.launchpad === view) && (!q || c.name.toLowerCase().includes(q)))
      .sort((a, b) => b.volumeUsd - a.volumeUsd);
  }, [coins, query, view]);
  const totalPool = coins.reduce((sum, c) => sum + c.poolUsd, 0);

  const status = (
    <>
      <span>{coins.length} {coins.length === 1 ? "token" : "tokens"}</span>
      <span aria-hidden="true">·</span>
      <span>pools {compact(totalPool)}</span>
      <span aria-hidden="true">·</span>
      <span>busiest first</span>
    </>
  );
  const empty = rows.length === 0 ? "No tokens match." : null;

  return (
    <div className="flex flex-col gap-5 desk:gap-6">
      <TradeToolbar
        views={[["all", "All"], ["flap", "Flap"], ["four", "Four.meme"]] as const}
        view={view}
        onView={setView}
        status={status}
        query={query}
        onQuery={setQuery}
        placeholder="Search tokens"
        searchLabel="Search tokens by name"
      />

      {/* Phones and tablets: a compact list. */}
      <ul className={tradeList.frame} aria-label="Tokens">
        {empty && <li className="py-12 text-center text-sm text-muted">{empty}</li>}
        {rows.map((c) => (
          <li key={c.slug} className={tradeList.item}>
            <Link href={`/app/trade/token/${c.slug}`} className={tradeList.link}>
              <CoinMark coin={c} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{c.name}</span>
                <span className="block truncate text-[13px] text-muted">{PAD_NAME[c.launchpad]} · pool {compact(c.poolUsd)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="num block text-base">{compact(c.volumeUsd)}</span>
                <span className="block text-[13px] text-muted">24h vol</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* From 801px: the same table frame as bStocks. The whole row opens the coin. */}
      <div className={tradeTable.frame}>
        <table className={tradeTable.table}>
          <thead className={tradeTable.head}>
            <tr>
              <th className={tradeTable.th}>Token</th>
              <th className={tradeTable.th}>Launchpad</th>
              <th className={cn(tradeTable.th, "text-right")}>Pool</th>
              <th className={cn(tradeTable.th, "text-right")}>24h volume</th>
            </tr>
          </thead>
          <tbody>
            {empty && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">{empty}</td></tr>}
            {rows.map((c) => (
              <tr key={c.slug} className={tradeTable.row}>
                <td className={tradeTable.td}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CoinMark coin={c} size="sm" />
                    <Link href={`/app/trade/token/${c.slug}`} className={cn("truncate", tradeTable.rowLink)}>{c.name}</Link>
                  </div>
                </td>
                <td className={cn(tradeTable.td, "text-ink-soft")}>{PAD_NAME[c.launchpad]}</td>
                <td className={cn(tradeTable.td, "num text-right")}>{compact(c.poolUsd)}</td>
                <td className={cn(tradeTable.td, "num text-right text-ink-soft")}>{compact(c.volumeUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
