import type { Launchpad } from "@/lib/pack";

/*
 * Demo coins for the pack marketplace (/app/packs). Each coin launched with its own packs; its stock pool decides
 * which risk tiers are unlocked. Names only, no tickers. Replace with on-chain data once launches are live.
 */

export type PackColor = { bg: string; ink: string };
export type MarketPack = { size: "starter" | "standard" | "grail"; color: PackColor };
export type MarketCoin = {
  slug: string;
  name: string;
  /** Avatar and halo color. */
  tone: string;
  launchpad: Launchpad;
  poolUsd: number;
  /** 24h trading volume (USD), for the Trending sort. */
  volumeUsd: number;
  /** Days since launch, for the New sort. */
  ageDays: number;
  packs: MarketPack[];
  /** bStocks the pool buys, by weight (percent). The biggest one is the subject of the Cournot risk check. */
  basket: { ticker: string; weight: number }[];
};

export const MARKET_COINS: MarketCoin[] = [
  {
    slug: "moon-cats", name: "Moon Cats", tone: "#ec746e", launchpad: "flap", poolUsd: 12400, volumeUsd: 86000, ageDays: 9,
    packs: [
      { size: "starter", color: { bg: "#ec746e", ink: "#2a0e0b" } },
      { size: "standard", color: { bg: "#8f1a12", ink: "#f6d4cf" } },
      { size: "grail", color: { bg: "#3b0a06", ink: "#f5b9b0" } },
    ],
    basket: [{ ticker: "TSLA", weight: 50 }, { ticker: "SPCX", weight: 30 }, { ticker: "RKLB", weight: 20 }],
  },
  {
    slug: "robo-rally", name: "Robo Rally", tone: "#3fb68b", launchpad: "four", poolUsd: 4100, volumeUsd: 41000, ageDays: 4,
    packs: [
      { size: "starter", color: { bg: "#5dcaa5", ink: "#04342c" } },
      { size: "standard", color: { bg: "#202020", ink: "#74fc84" } },
    ],
    basket: [{ ticker: "NVDA", weight: 40 }, { ticker: "AMD", weight: 30 }, { ticker: "TSM", weight: 30 }],
  },
  {
    slug: "pixel-pups", name: "Pixel Pups", tone: "#7f77dd", launchpad: "four", poolUsd: 6300, volumeUsd: 23000, ageDays: 2,
    packs: [
      { size: "starter", color: { bg: "#afa9ec", ink: "#26215c" } },
      { size: "standard", color: { bg: "#534ab7", ink: "#eeedfe" } },
      { size: "grail", color: { bg: "#26215c", ink: "#cecbf6" } },
    ],
    basket: [{ ticker: "META", weight: 40 }, { ticker: "GOOGL", weight: 35 }, { ticker: "MSFT", weight: 25 }],
  },
  {
    slug: "frog-fund", name: "Frog Fund", tone: "#639922", launchpad: "flap", poolUsd: 800, volumeUsd: 9000, ageDays: 1,
    packs: [{ size: "standard", color: { bg: "#97c459", ink: "#173404" } }],
    basket: [{ ticker: "COIN", weight: 50 }, { ticker: "HOOD", weight: 50 }],
  },
];

export const coinBySlug = (slug: string) => MARKET_COINS.find((c) => c.slug === slug);

/** The basket stock with the biggest weight. */
export const topStock = (coin: MarketCoin) => [...coin.basket].sort((a, b) => b.weight - a.weight)[0];
