"use client";

import Link from "next/link";
import { OnchainPacks } from "@/components/onchain-packs";
import { FlapPacks } from "@/components/flap-packs";
import { PackShop } from "@/components/pack-shop";
import { ClassicPackShop } from "@/components/classic-pack-shop";
import { useMarketCoins } from "@/lib/published-packs";

/** Finds the pack (a seed pack, or one published in this browser). On-chain coins get the live pack panel (Flap: presale and vault in test USD; Four.meme: BNB sale), classic collections the classic shop, the rest the demo launch. */
export function CoinShop({ slug }: { slug: string }) {
  const coin = useMarketCoins().find((c) => c.slug === slug);
  if (!coin) {
    return <p className="py-16 text-center text-base text-muted">This pack isn&apos;t here. <Link href="/app/packs" className="text-black underline underline-offset-4">All packs</Link></p>;
  }
  if (coin.config.onchain?.pad === "flap" && coin.config.onchain.launcher) return <FlapPacks coin={coin} />;
  if (coin.config.onchain) return <OnchainPacks coin={coin} />;
  // A classic collection (published without a coin) gets the classic shop with its own sizes, basket and design.
  if (coin.config.kind === "classic") {
    return (
      <>
        <h1 className="sr-only">{coin.name} packs</h1>
        <ClassicPackShop key={slug} collection={coin} />
      </>
    );
  }
  return (
    <>
      <h1 className="sr-only">{coin.name} packs</h1>
      <PackShop key={slug} market={coin} />
    </>
  );
}
