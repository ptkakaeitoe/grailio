"use client";

import Link from "next/link";
import { OnchainPacks } from "@/components/onchain-packs";
import { PackShop } from "@/components/pack-shop";
import { useMarketCoins } from "@/lib/published-packs";

/** Finds the pack (a seed pack, or one published in this browser). On-chain coins get the live pack panel; the rest the demo launch. */
export function CoinShop({ slug }: { slug: string }) {
  const coin = useMarketCoins().find((c) => c.slug === slug);
  if (!coin) {
    return <p className="py-16 text-center text-base text-muted">This pack isn&apos;t here. <Link href="/app/packs" className="text-black underline underline-offset-4">All packs</Link></p>;
  }
  if (coin.config.onchain) return <OnchainPacks coin={coin} />;
  return (
    <>
      <h1 className="sr-only">{coin.name} packs</h1>
      <PackShop key={slug} market={coin} />
    </>
  );
}
