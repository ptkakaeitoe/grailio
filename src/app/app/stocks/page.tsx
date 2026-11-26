import type { Metadata } from "next";
import { StockList } from "@/components/stock-list";

export const metadata: Metadata = { title: "Stocks", description: "Live, signed bStocks prices from Atlas Oracle: the prices the pack vault uses." };

export default function StockListPage() {
  return (
    <div className="page">
      <h1 className="pt-6 pb-4 text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:pt-10 desk:pb-6 desk:text-[40px]">Stocks</h1>
      <StockList />
    </div>
  );
}
