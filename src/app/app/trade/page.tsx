import type { Metadata } from "next";
import { TradeWorkspace } from "@/components/trade-workspace";

export const metadata: Metadata = { title: "Trade", description: "Live signed bStocks prices from Atlas, and the tokens launched with packs." };

export default function TradePage() {
  return (
    <div className="page">
      <TradeWorkspace />
    </div>
  );
}
