import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { PageShell } from "@/components/page-shell";
import { MARKET_COINS, coinBySlug } from "@/lib/launch/market";
import { IS_TESTNET } from "@/lib/network";
import { CoinShop } from "./coin-shop";

type Props = { params: Promise<{ coin: string }> };

export function generateStaticParams() {
  return IS_TESTNET ? MARKET_COINS.map((c) => ({ coin: c.slug })) : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const coin = coinBySlug((await params).coin);
  return { title: coin ? `${coin.name} packs — grailio` : "Packs — grailio" };
}

async function CoinBody({ params }: Props) {
  return <CoinShop slug={(await params).coin} />;
}

/** Testnet only: a launched coin's packs. */
export default function CoinPacksPage({ params }: Props) {
  if (!IS_TESTNET) notFound();
  return (
    <PageShell>
      <Link href="/packs" className="mt-2 -ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted transition-colors hover:text-black desk:mt-6"><ArrowLeftIcon weight="bold" className="size-4" /> All packs</Link>
      <section className="flex flex-col pt-2 pb-6 desk:py-8" aria-label="Coin packs">
        <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading packs…</p>}>
          <CoinBody params={params} />
        </Suspense>
      </section>
    </PageShell>
  );
}
