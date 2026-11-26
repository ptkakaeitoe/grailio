"use client";

import { StockLogo } from "@/components/stock-logo";
import { useHoldings } from "@/lib/holdings";
import { usd } from "@/lib/format";

const amount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** The wallet's holdings and their estimated value: BNB, redeemed bStocks, and the bStocks inside kept cards. */
export function HoldingsPanel() {
  const { loaded, holdings, inCards, cardCount, total } = useHoldings();
  return (
    <section id="holdings" className="py-8 desk:pt-10 desk:pl-8" aria-labelledby="holdings-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="holdings-title" className="text-[28px] leading-[1.2] font-normal tracking-tight">Holdings</h2>
        <span className="text-base text-muted">[ est. value ]</span>
      </div>
      <p className="mt-4 text-[40px] leading-[1.2] tracking-tight tabular-nums">{loaded ? usd(total) : "—"}</p>
      {loaded ? (
        <ul className="mt-6 border-t border-border" aria-label="Holdings">
          {holdings.map((h) => (
            <li key={h.key} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border py-3 text-base">
              {h.ticker ? <StockLogo ticker={h.ticker} size={28} className="row-span-2" /> : (
                <span className="row-span-2 grid size-7 place-items-center rounded-full bg-[#f0b90b] text-[11px] font-semibold text-[#111]" aria-hidden="true">BNB</span>
              )}
              <span className="truncate">{h.label} <span className="text-sm text-muted">{h.name}</span></span>
              <span className="text-right tabular-nums">{h.price === null ? "—" : usd(h.amount * h.price)}</span>
              <span className="text-sm text-muted tabular-nums">{amount(h.amount)}</span>
            </li>
          ))}
          {cardCount > 0 && (
            <li className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border py-3 text-base">
              <span className="row-span-2 grid size-7 place-items-center rounded-[4px] border border-border-strong text-[11px] text-muted" aria-hidden="true">{cardCount}</span>
              <span className="truncate">In cards</span>
              <span className="text-right tabular-nums">{usd(inCards)}</span>
              <span className="text-sm text-muted">bStocks inside {cardCount} {cardCount === 1 ? "card" : "cards"}</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted" role="status">Loading holdings…</p>
      )}
      <p className="mt-4 text-sm text-muted">Prices: Atlas Oracle (bStocks), Chainlink (BNB). Demo wallet until the vault is on BSC testnet.</p>
    </section>
  );
}
