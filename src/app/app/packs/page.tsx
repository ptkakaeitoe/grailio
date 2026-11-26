import type { Metadata } from "next";
import { Suspense } from "react";
import { PackMarket } from "@/components/pack-market";

export const metadata: Metadata = { title: "Packs", description: "Pack marketplace: classic packs and coin-backed packs." };

/** The Classic | New-gen tab is read from the URL on the client, inside Suspense. */
export default function PacksMarketPage() {
  return (
    <Suspense fallback={<p className="page py-16 text-center text-sm text-muted">Loading packs…</p>}>
      <PackMarket />
    </Suspense>
  );
}
