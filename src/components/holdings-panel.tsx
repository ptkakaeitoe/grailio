"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { useHoldings } from "@/lib/holdings";
import { usd } from "@/lib/format";

const amount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Where a holding trades: a stock's trade screen, a launched coin's token screen, or Trade for BNB. */
const tradeHref = (key: string, ticker: string | null) =>
  ticker ? `/app/trade/stock/${ticker}` : key.startsWith("token:") ? `/app/trade/token/${key.slice(6)}` : "/app/trade";

/** The wallet's holdings and their estimated value: BNB and redeemed bStocks. */
export function HoldingsPanel() {
  const { loaded, holdings, walletValue } = useHoldings();
  return (
    <section id="holdings" className="py-8 desk:pt-10 desk:pl-8" aria-labelledby="holdings-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="holdings-title" className="text-[28px] leading-[1.2] font-normal tracking-tight">Holdings</h2>
        <span className="text-base text-muted">[ est. value ]</span>
      </div>
      <p className="mt-4 text-[40px] leading-[1.2] tracking-tight tabular-nums">{loaded ? usd(walletValue) : "—"}</p>
      {loaded ? (
        <ul className="mt-4 flex flex-col" aria-label="Holdings">
          {holdings.map((h) => (
            <li key={h.key}>
              <Link href={tradeHref(h.key, h.ticker)} className="-mx-2 grid grid-cols-[28px_minmax(0,1fr)_auto_16px] items-center gap-x-3 rounded-md px-2 py-2.5 text-base transition-colors hover:bg-surface-muted">
                {h.ticker ? <StockLogo ticker={h.ticker} size={28} className="row-span-2" /> : h.key === "bnb" ? (
                  <span className="row-span-2 grid size-7 place-items-center rounded-full bg-[#f0b90b] text-[11px] font-semibold text-[#111]" aria-hidden="true">BNB</span>
                ) : (
                  <span className="row-span-2 grid size-7 place-items-center rounded-full bg-surface-muted text-sm" aria-hidden="true">{h.label[0]}</span>
                )}
                <span className="truncate">{h.ticker || h.label}</span>
                <span className="text-right tabular-nums">{h.price === null ? "—" : usd(h.amount * h.price)}</span>
                <ChevronRight className="row-span-2 size-4 text-muted" aria-hidden="true" />
                <span className="text-sm text-muted tabular-nums">{amount(h.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted" role="status">Loading holdings…</p>
      )}
    </section>
  );
}
