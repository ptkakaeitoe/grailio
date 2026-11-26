"use client";

import { useState } from "react";
import { StockList } from "@/components/stock-list";
import { TokenList } from "@/components/token-list";
import { NftMarket } from "@/components/nft-market";
import { cn } from "@/components/clean-ui";

const TABS = [
  { id: "stocks", label: "bStocks" },
  { id: "tokens", label: "Tokens" },
  { id: "nfts", label: "NFTs" },
] as const;

/**
 * Trade: the bStocks behind the packs, the launched tokens, and the pack-card NFT market. The title and the category
 * switch share one row (phones: the switch goes full width under the title). It takes at least the screen below the
 * header, so with a short list (a filter with three rows) the table still ends after its last row but the footer stays
 * below the fold instead of jumping up.
 */
export function TradeWorkspace() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("stocks");
  return (
    <div className="min-h-[calc(100svh-var(--header-h))]">
      <header className="flex flex-col gap-4 pt-6 pb-6 desk:flex-row desk:items-end desk:justify-between desk:pt-10 desk:pb-8">
        <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:text-[40px]">Trade</h1>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-surface-muted p-1 desk:w-[330px]" role="tablist" aria-label="Category">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn("min-h-10 rounded-[4px] text-sm transition-colors desk:min-h-9", tab === t.id ? "bg-black text-white" : "text-muted hover:text-black")}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div role="tabpanel">{tab === "stocks" ? <StockList /> : tab === "tokens" ? <TokenList /> : <NftMarket />}</div>
    </div>
  );
}
