import type { Metadata } from "next";
import { Suspense } from "react";
import { TradeScreen } from "@/components/trade-screen";

export const metadata: Metadata = { title: "BNB", description: "Trade BNB for USDT in the demo wallet." };

/** BNB against USDT, demo only. */
export default function BnbTradePage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading…</p>}>
        <TradeScreen asset={{ kind: "bnb" }} />
      </Suspense>
    </div>
  );
}
