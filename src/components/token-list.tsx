"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cleanField, cn } from "@/components/clean-ui";
import { useMarketCoins } from "@/lib/published-packs";

const PAD_NAME = { flap: "Flap", four: "Four.meme" } as const;
const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`);

/** Launched coins, busiest first: each opens its trade screen. Names only, no tickers. */
export function TokenList() {
  const coins = useMarketCoins();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coins.filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => b.volumeUsd - a.volumeUsd);
  }, [coins, query]);

  return (
    <div className="flex flex-col gap-4">
      <label className="relative desk:max-w-[320px]">
        <span className="sr-only">Search tokens</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input className={cn(cleanField, "pl-10 text-sm desk:h-10")} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="border-t border-border">
        {rows.map((c) => (
          <li key={c.slug}>
            <Link href={`/app/trade/token/${c.slug}`} className="flex min-h-16 items-center gap-3 border-b border-border py-3 transition-colors hover:bg-surface-muted">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-sm text-[#fff]" style={{ background: c.tone }} aria-hidden="true">
                {c.config.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the launched coin
                  <img src={c.config.image} alt="" className="size-full object-cover" />
                ) : c.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{c.name}</span>
                <span className="block truncate text-[13px] text-muted">{PAD_NAME[c.launchpad]} · pool {compact(c.poolUsd)}</span>
              </span>
              <span className="text-right">
                <span className="block text-base tabular-nums">{compact(c.volumeUsd)}</span>
                <span className="block text-[13px] text-muted">24h vol</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-12 text-center text-sm text-muted">No tokens match.</li>}
      </ul>
    </div>
  );
}
