"use client";

import Link from "next/link";

import { ClassicPackShop } from "@/components/launch/classic-pack-shop";
import { FlapPacks } from "@/components/launch/flap-packs";
import { OnchainPacks } from "@/components/launch/onchain-packs";
import { PackShop } from "@/components/launch/pack-shop";
import { useMarketCoins } from "@/lib/launch/published-packs";

/** Finds a launched coin's pack (a seed pack, or one published in this browser) and shows its shop: on-chain coins get the live pack panel (Flap: presale and vault in test USD; OpenFour: BNB sale), classic collections the classic shop, the rest the simulated launch. */
export function CoinShop({ slug }: { slug: string }) {
  const coin = useMarketCoins().find((c) => c.slug === slug);
  if (!coin) {
    return <p className="py-16 text-center text-base text-muted">This pack isn&apos;t here. <Link href="/packs" className="text-black underline underline-offset-4">All packs</Link></p>;
  }
  if (coin.config.onchain?.pad === "flap" && coin.config.onchain.launcher) return <FlapPacks coin={coin} />;
  if (coin.config.onchain) return <OnchainPacks coin={coin} />;
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
