"use client";

import { useCallback, useMemo, type CSSProperties } from "react";
import { coverStyle, designedCard } from "@/components/launch-design";
import { cardArt, type ArtSet, type StockCard } from "@/lib/cards";
import type { MarketCoin } from "@/lib/market";
import type { PackConfig } from "@/lib/pack";
import { useMarketCoins } from "@/lib/published-packs";

/* A launched coin's custom design (Launch → Design) outside the Launch flow: pack sleeve and card art per rarity. */

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

export const isCustom = (config: PackConfig | undefined) => config?.design === "custom";

/** SealedPack colour and style for a custom-designed coin; undefined for the default look. */
export function customPack(config: PackConfig | undefined): { color: { bg: string; ink: string }; style: CSSProperties } | undefined {
  if (!config || !isCustom(config)) return undefined;
  return { color: { bg: config.tone, ink: ink(config.tone) }, style: coverStyle(config.tone, config.pattern, config.cover) };
}

type CardRef = { coin: string; ticker: string; rarity: number; set: ArtSet };

/** The art for a card from a coin: the coin's custom card for that rarity, or the default art. */
export function coinCardArt(coin: MarketCoin | undefined, card: CardRef): StockCard {
  const config = coin?.config;
  const d = isCustom(config) ? config?.cards[card.rarity] : undefined;
  if (!d) return cardArt(card.ticker, card.rarity, card.set);
  // Art "by pack size" uses the set the card was opened with.
  return designedCard({ ...d, set: d.set ?? card.set }, card.rarity, card.ticker);
}

/** Looks up each card's coin among the marketplace coins and returns its art. */
export function useCardArt() {
  const coins = useMarketCoins();
  const bySlug = useMemo(() => new Map(coins.map((c) => [c.slug, c])), [coins]);
  return useCallback((card: CardRef) => coinCardArt(bySlug.get(card.coin), card), [bySlug]);
}
