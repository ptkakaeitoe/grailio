import type { Metadata } from "next";
import { Suspense } from "react";
import { TradeScreen } from "@/components/trade-screen";
import { MARKET_COINS, coinBySlug } from "@/lib/market";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return MARKET_COINS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: coinBySlug((await params).slug)?.name ?? "Token" };
}

async function Body({ params }: Props) {
  return <TradeScreen asset={{ kind: "token", slug: (await params).slug }} />;
}

export default function TokenTradePage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}
