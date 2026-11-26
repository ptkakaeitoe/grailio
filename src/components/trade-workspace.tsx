"use client";

import { useState } from "react";
import { StockList } from "@/components/stock-list";
import { TokenList } from "@/components/token-list";
import { cn } from "@/components/clean-ui";

const TABS = [
  { id: "stocks", label: "Stocks" },
  { id: "tokens", label: "Tokens" },
] as const;

/** Trade: the bStocks behind the packs, and the launched tokens. */
export function TradeWorkspace() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("stocks");
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1 desk:inline-grid desk:w-[280px]" role="tablist" aria-label="Category">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("min-h-10 rounded-[4px] text-sm transition-colors", tab === t.id ? "bg-black text-white" : "text-muted hover:text-black")}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "stocks" ? <StockList /> : <TokenList />}</div>
    </>
  );
}
