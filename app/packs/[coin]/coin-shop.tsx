"use client";

import Link from "next/link";

import { ClassicPackShop } from "@/components/launch/classic-pack-shop";
import { CoinPackPage } from "@/components/launch/coin-page/coin-pack-page";
import { useMarketCoins } from "@/lib/launch/published-packs";

/** Finds a launched coin's pack (a seed pack, or one published in this browser) and shows its shop: every launched coin (simulated, Four.meme or Flap) gets the one coin pack page; classic collections (no coin) keep the classic shop. */
export function CoinShop({ slug }: { slug: string }) {
  const coin = useMarketCoins().find((c) => c.slug === slug);
  if (!coin) {
    return <p className="py-16 text-center text-base text-muted">This pack isn&apos;t here. <Link href="/packs" className="text-black underline underline-offset-4">All packs</Link></p>;
  }
  if (coin.config.kind === "classic") {
    return (
      <>
        <h1 className="sr-only">{coin.name} packs</h1>
        <ClassicPackShop key={slug} collection={coin} />
      </>
    );
  }
  return <CoinPackPage key={slug} coin={coin} />;
}
