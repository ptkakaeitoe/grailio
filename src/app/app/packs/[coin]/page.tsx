import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MARKET_COINS, coinBySlug } from "@/lib/market";
import { CoinShop } from "./coin-shop";

type Props = { params: Promise<{ coin: string }> };

export function generateStaticParams() {
  return MARKET_COINS.map((c) => ({ coin: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const coin = coinBySlug((await params).coin);
  return { title: coin ? `${coin.name} packs` : "Packs" };
}

/** Reads the coin from the URL inside Suspense, so the page shell stays shared across coins. */
async function CoinBody({ params }: Props) {
  const coin = coinBySlug((await params).coin);
  if (!coin) notFound();
  return (
    <>
      <h1 className="sr-only">{coin.name} packs</h1>
      <CoinShop slug={coin.slug} />
    </>
  );
}

export default function CoinPacksPage({ params }: Props) {
  return (
    <div className="page">
      <Link href="/app/packs" className="mt-2 -ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted transition-colors hover:text-black desk:mt-6"><ArrowLeft className="size-4" /> All packs</Link>
      {/* Phones read top to bottom from the pack; from 801px the two columns centre in the screen. */}
      <section className="flex flex-col pt-2 pb-6 desk:min-h-[calc(100dvh-var(--header-h)-60px)] desk:justify-center desk:py-8" aria-label="Coin packs">
        <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading packs…</p>}>
          <CoinBody params={params} />
        </Suspense>
      </section>
    </div>
  );
}
