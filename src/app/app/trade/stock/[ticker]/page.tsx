import type { Metadata } from "next";
import { Suspense } from "react";
import { TradeScreen } from "@/components/trade-screen";
import { PRICED_STOCKS } from "@/lib/stocks";

type Props = { params: Promise<{ ticker: string }> };

export function generateStaticParams() {
  return PRICED_STOCKS.map((s) => ({ ticker: s.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `${(await params).ticker}B` };
}

async function Body({ params }: Props) {
  return <TradeScreen asset={{ kind: "stock", ticker: (await params).ticker }} />;
}

export default function StockTradePage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}
