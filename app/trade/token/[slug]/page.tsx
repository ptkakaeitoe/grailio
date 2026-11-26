import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CoinTradeScreen } from "@/components/launch/trade-screen";
import { PageShell } from "@/components/page-shell";
import { MARKET_COINS, coinBySlug } from "@/lib/launch/market";
import { IS_TESTNET } from "@/lib/network";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return IS_TESTNET ? MARKET_COINS.map((c) => ({ slug: c.slug })) : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `${coinBySlug((await params).slug)?.name ?? "Token"} — grailio` };
}

async function Body({ params }: Props) {
  return <CoinTradeScreen slug={(await params).slug} />;
}

/** Testnet only: a launched coin's trade screen. */
export default function TokenTradePage({ params }: Props) {
  if (!IS_TESTNET) notFound();
  return (
    <PageShell>
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </PageShell>
  );
}
