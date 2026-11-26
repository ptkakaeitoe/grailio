import type { Metadata } from "next";
import { TradeWorkspace } from "@/components/trade-workspace";

export const metadata: Metadata = { title: "Trade", description: "Live signed bStocks prices from Atlas, and the tokens launched with packs." };

export default function TradePage() {
  return (
    <div className="page">
      <h1 className="pt-6 pb-4 text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:pt-10 desk:pb-6 desk:text-[40px]">Trade</h1>
      <TradeWorkspace />
    </div>
  );
}
