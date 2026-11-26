"use client";

import type { MarketCoin } from "@/lib/launch/market";

import { BuyPanel } from "./buy-panel";
import { CoinHeader, PackColumn, PhaseSteps } from "./coin-header";
import { CoinTabs } from "./coin-tabs";
import { useCoinPack } from "./use-coin-pack";

/**
 * One pack page for every launched coin (simulated, Four.meme or Flap), laid out like mainnet's pack page:
 * coin header and steps on top, the pack art and its stocks on the left, the presale / live buy panel on the right,
 * then Pool · Staking · Activity tabs.
 */
export function CoinPackPage({ coin }: { coin: MarketCoin }) {
  const pack = useCoinPack(coin);
  return (
    <div className="pt-6 pb-16 desk:pt-10">
      <h1 className="sr-only">{coin.name} packs</h1>
      <CoinHeader pack={pack} />
      <PhaseSteps pack={pack} />
      <div className="mt-8 grid grid-cols-1 gap-8 desk:mt-10 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desk:gap-12">
        <PackColumn pack={pack} />
        <BuyPanel pack={pack} />
      </div>
      <CoinTabs pack={pack} />
    </div>
  );
}
