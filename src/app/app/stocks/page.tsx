import type { Metadata } from "next";
import { StockList } from "@/components/stock-list";

export const metadata: Metadata = { title: "Stocks", description: "Live, signed bStocks prices from Atlas Oracle: the prices the pack vault uses." };

export default function StockListPage() {
  return (
    <div className="page">
      {/* Graily's page opener: bracketed label left, two-tone title right; compact on phones so the prices come up fast. */}
      <header className="grid grid-cols-1 items-start gap-3 pt-6 pb-6 desk:grid-cols-2 desk:gap-8 desk:pt-10 desk:pb-12">
        <p className="text-sm text-muted">[ stock list ]</p>
        <div>
          <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:text-[clamp(40px,5vw,64px)] desk:leading-[1.08]">
            bStocks on Atlas.
            <br />
            <span className="text-muted">Signed prices, live.</span>
          </h1>
        </div>
      </header>
      <StockList />
    </div>
  );
}
