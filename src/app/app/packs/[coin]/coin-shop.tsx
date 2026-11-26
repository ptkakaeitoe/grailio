"use client";

import { useSearchParams } from "next/navigation";
import { PackShop } from "@/components/pack-shop";
import { coinBySlug } from "@/lib/market";

/** Reads ?size= in the browser so the coin page itself can be prerendered. */
export function CoinShop({ slug }: { slug: string }) {
  const size = useSearchParams().get("size") ?? undefined;
  const coin = coinBySlug(slug);
  if (!coin) return null;
  return <PackShop key={`${slug}-${size ?? ""}`} market={coin} initialSize={size} />;
}
