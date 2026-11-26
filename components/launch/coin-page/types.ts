import type { ReactNode } from "react";
import type { Address } from "viem";

import type { MarketCoin } from "@/lib/launch/market";

/*
 * One shape for every launched coin's pack page, whatever runs it: the browser simulation, an OpenFour (Four.meme)
 * sale + pack vault, or a Flap launcher + pack vault. The adapter (use-coin-pack.ts) fills it; the header, buy panel and
 * tabs only read it, so all three sources look the same.
 */

export type CoinSource = "sim" | "four" | "flap";
export type CoinPhase = "presale" | "live" | "refund";
export type RiskTier = 0 | 1 | 2;

/** Presale facts. Amounts in the quote token (`quote`), USD values where known. */
export type CoinPresale = {
  packsSold: number;
  packsForSale: number;
  /** Price of one presale pack in the quote token, and in USD. */
  price: number;
  priceUsd: number | null;
  /** Coins one presale pack is worth at launch. */
  coinsPerPack: number;
  /** Packs you bought (unopened presale packs after launch). */
  mine: number;
  /** Unix ms; null when the sale has no deadline. */
  deadline: number | null;
  /** What the raise funds at launch, in USD. */
  toLiquidityUsd: number | null;
  toPoolUsd: number | null;
};

/** One risk tier of the live pack. */
export type CoinTier = {
  id: RiskTier;
  name: string;
  /** Pack price in the quote token and USD. */
  price: number;
  priceUsd: number | null;
  /** Ten equally likely outcomes, as multiples of the price (TABLES in demo-launch). */
  outcomes: number[];
  /** null = unlimited; 0 = locked / sold out. */
  left: number | null;
  /** Why it's locked, e.g. "Unlocks at a $120 pool". */
  lockedReason: string | null;
  /** Your unopened packs of this tier. */
  unopened: number;
};

export type CoinStakedCard = {
  id: string;
  ticker: string;
  rarity: number;
  valueUsd: number;
  /** Earning per (real or simulated) day, USD. */
  earnsPerDayUsd: number;
  art?: ReactNode;
};

export type CoinStaking = {
  claimableUsd: number;
  poolUsd: number;
  perDayUsd: number;
  /** 0..1 */
  share: number;
  staked: CoinStakedCard[];
  /** Cards of this coin you could stake. */
  stakeable: CoinStakedCard[];
  /** e.g. "7 days run in 60s" for the simulation; null on chain. */
  timeNote: string | null;
};

/** The card a pack just opened into (for the reveal). */
export type CoinPull = {
  ticker: string;
  rarity: number;
  valueUsd: number | null;
  /** Stock amount the card holds, when known. */
  amount?: number;
  /** e.g. "120% of the price" or "1.4× its share". */
  note: string;
  cardId?: string;
};

export type CoinActivityItem = { id: string; label: string; detail?: string; at: number; href?: string };

/** Everything the coin pack page shows. Actions are async and throw on failure (callers toast). */
export type CoinPack = {
  coin: MarketCoin;
  source: CoinSource;
  /** True when it runs in the browser (demo / not on chain yet). */
  simulated: boolean;
  phase: CoinPhase;
  /** On-chain ticker when known (token.symbol()), else the configured one. */
  ticker: string;
  launchpad: "Four.meme" | "Flap" | null;
  tokenAddress: Address | null;
  explorerUrl: string | null;
  /** Payment token label: "BNB", "tBNB" or "USD". */
  quote: string;
  /** Coin market data (USD). null when unknown. */
  priceUsd: number | null;
  mcapUsd: number | null;
  liquidityUsd: number | null;
  stockPoolUsd: number | null;
  /** Stocks the packs draw from. */
  basket: { ticker: string; weight: number }[];
  presale: CoinPresale;
  tiers: CoinTier[];
  /** Trading-tax split in percent and what has been collected (USD). */
  taxSplit: { pool: number; stakers: number; creator: number; platform: number };
  taxCollectedUsd: { pool: number; stakers: number; creator: number; platform: number } | null;
  staking: CoinStaking | null;
  activity: CoinActivityItem[];
  /** Wallet / demo state for the buy buttons. */
  ready: boolean;
  needsWallet: boolean;
  /** Spendable balance of the quote token. */
  balance: number | null;
  actions: {
    buyPresale?: (quantity: number) => Promise<void>;
    openPresale?: () => Promise<void>;
    buyTier?: (tier: RiskTier, quantity: number) => Promise<void>;
    openTier?: (tier: RiskTier) => Promise<void>;
    claimCoins?: () => Promise<void>;
    refund?: () => Promise<void>;
    stake?: (cardIds: string[]) => Promise<void>;
    unstake?: (cardIds: string[]) => Promise<void>;
    claimRewards?: () => Promise<void>;
    connect?: () => void;
    /** Flap / testnet only: mint free test USD to the wallet. */
    claimTestUsd?: () => Promise<void>;
  };
  /** The last opened card (set by openPresale / openTier), until clearPull. */
  lastPull?: CoinPull | null;
  clearPull?: () => void;
  /** Label of the action in flight, e.g. "Approving…", "Revealing…"; "" when idle. */
  busy?: string;
  /** Coins you can claim after launch (Flap), in coin units. */
  claimableCoins?: number;
  /** Demo-only controls (simulate other buyers / trading); shown in a small drawer in demo mode only. */
  demo: { simulateBuyers?: () => void; simulateTrading?: () => void } | null;
  loading: boolean;
  error: string | null;
};
