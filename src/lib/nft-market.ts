"use client";

import { useSyncExternalStore } from "react";
import { addCard, type OwnedCard } from "@/lib/collection";
import { SET_FOR_SIZE, type ArtSet } from "@/lib/cards";
import { MARKET_COINS } from "@/lib/market";
import { spendDemoBnb } from "@/lib/demo";
import { stockOf } from "@/lib/stocks";

/*
 * The NFT market for pack cards, simulated until the vault is on BSC testnet: other collectors' listings (generated
 * the same way every time from the seed packs) next to the cards you list from your collection. Buying pays from the
 * demo wallet and moves the card into your collection.
 */

export type Listing = {
  id: string;
  coin: string;
  coinName: string;
  size: string;
  set: ArtSet;
  ticker: string;
  rarity: number;
  /** Value the card holds (USD). */
  usd: number;
  /** Asking price (USD). */
  priceUsd: number;
  seller: string;
};

// Small deterministic generator so every visitor sees the same listings.
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

const SIZES = ["starter", "standard", "grail"] as const;

export const DEMO_LISTINGS: Listing[] = MARKET_COINS.flatMap((coin, ci) => {
  const r = rng(ci * 7919 + 17);
  return [0, 1, 2].map((i) => {
    const size = SIZES[Math.floor(r() * 3)];
    const price = coin.config.sizes.find((s) => s.id === size)?.price ?? 10;
    const rarity = [0, 0, 1, 1, 2, 3][Math.floor(r() * 6)];
    const tier = coin.config.risks.find((x) => x.id === "medium")?.tiers[rarity];
    const usd = Math.round(price * (tier?.mult ?? 1) * 100) / 100;
    const ticker = coin.basket[Math.floor(r() * coin.basket.length)].ticker;
    const seller = `0x${Math.floor(r() * 0xffff).toString(16).padStart(4, "0")}…${Math.floor(r() * 0xffff).toString(16).padStart(4, "0")}`;
    return { id: `${coin.slug}-${i}`, coin: coin.slug, coinName: coin.name, size, set: SET_FOR_SIZE[size], ticker, rarity, usd, priceUsd: Math.round(usd * (1.05 + r() * 0.3) * 100) / 100, seller };
  });
});

const KEY = "bsctemp.nft-bought.v1";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const NONE: string[] = [];

function readBought(): string[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}

/** Buys a listing with demo BNB; false if demo is off or the balance is short. */
export function buyListing(listing: Listing, bnbUsd: number) {
  if (!(bnbUsd > 0) || !spendDemoBnb(listing.priceUsd / bnbUsd)) return false;
  const price = stockOf(listing.ticker)?.price;
  addCard({ coin: listing.coin, coinName: listing.coinName, size: listing.size, set: listing.set, ticker: listing.ticker, rarity: listing.rarity, usd: listing.usd, shares: price ? listing.usd / price : 0 });
  cache = [...readBought(), listing.id];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep in memory */ }
  listeners.forEach((l) => l());
  return true;
}

/** Forgets demo NFT purchases (demo reset). */
export function clearBoughtListings() {
  cache = [];
  try { localStorage.setItem(KEY, "[]"); } catch { /* keep in memory */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Listings still for sale (bought ones drop off). */
export function useListings() {
  const bought = useSyncExternalStore(subscribe, readBought, () => NONE);
  return DEMO_LISTINGS.filter((l) => !bought.includes(l.id));
}

/** Your listed cards, shaped like listings. */
export const ownListing = (c: OwnedCard): Listing => ({
  id: `mine-${c.id}`, coin: c.coin, coinName: c.coinName, size: c.size, set: c.set, ticker: c.ticker, rarity: c.rarity, usd: c.usd, priceUsd: c.listedUsd ?? c.usd, seller: "You",
});
