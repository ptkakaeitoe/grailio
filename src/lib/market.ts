import type { Launchpad, PackConfig } from "@/lib/pack";
import { SEED_PACKS } from "@/data/packs";

/*
 * The pack marketplace: every coin is a pack designed in the Launch flow. Seed packs ship with the app (src/data/packs,
 * exported from the studio); packs you publish from the studio are saved in this browser and listed beside them.
 * Names only on screen, no tickers.
 */

export type PackColor = { bg: string; ink: string };
export type MarketPack = { size: string; color: PackColor };
export type MarketCoin = {
  slug: string;
  name: string;
  /** Avatar and halo colour (the studio's tone). */
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
  /** The full pack design: sizes, risk tiers, unlocks, cards. */
  config: PackConfig;
  /** Ships with the app (has a server-side risk check), or was published in this browser. */
  seed: boolean;
};

export type SeedPack = { meta: { poolUsd: number; volumeUsd: number; ageDays: number }; config: PackConfig };

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
function mix(color: string, target: string, amount: number) {
  const a = color.replace("#", ""), b = target.replace("#", "");
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `#${[0, 2, 4].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * amount)).join("")}`;
}
function ink(bg: string) {
  const c = bg.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? mix(bg, "#000000", 0.82) : mix(bg, "#ffffff", 0.85);
}

/** Pack colours per size from the studio tone: lighter Starter, the tone itself for Standard, darker Grail. */
function packColors(tone: string, sizes: string[]): MarketPack[] {
  const shade: Record<string, string> = { starter: mix(tone, "#ffffff", 0.35), standard: tone, grail: mix(tone, "#000000", 0.5) };
  return sizes.map((size) => {
    const bg = shade[size] ?? tone;
    return { size, color: { bg, ink: ink(bg) } };
  });
}

export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack";

export function toCoin(config: PackConfig, meta: SeedPack["meta"], seed: boolean, slug = slugify(config.name)): MarketCoin {
  return {
    slug, name: config.name, tone: config.tone, launchpad: config.launchpad,
    poolUsd: meta.poolUsd, volumeUsd: meta.volumeUsd, ageDays: meta.ageDays,
    packs: packColors(config.tone, config.sizes.map((s) => s.id)),
    basket: config.basket, config, seed,
  };
}

export const MARKET_COINS: MarketCoin[] = SEED_PACKS.map((p) => toCoin(p.config, p.meta, true));

export const coinBySlug = (slug: string) => MARKET_COINS.find((c) => c.slug === slug);

/** The basket stock with the biggest weight. */
export const topStock = (coin: MarketCoin) => [...coin.basket].sort((a, b) => b.weight - a.weight)[0];

/** A launched token's demo price (USD) until it trades on-chain: scaled from its pool. */
export const demoTokenPrice = (coin: MarketCoin) => Math.max(0.000001, coin.poolUsd / 1e8);
