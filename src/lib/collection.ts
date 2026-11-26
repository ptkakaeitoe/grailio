"use client";

import { useSyncExternalStore } from "react";
import type { ArtSet } from "@/lib/cards";

/*
 * Your cards, simulated in this browser until the vault contract is on BSC testnet: every opened pack adds a card;
 * redeeming burns it and records the bStocks it paid out. Same idea as collectX's demo collection.
 */

export type OwnedCard = {
  id: number;
  coin: string;
  coinName: string;
  size: string;
  set: ArtSet;
  /** bStock ticker the card holds (e.g. "TSLA"). */
  ticker: string;
  rarity: number;
  /** Value the card holds, in USD, when it was opened. */
  usd: number;
  /** Shares of the bStock at the reference price when it was opened. */
  shares: number;
  openedAt: number;
  redeemedAt?: number;
  /** Asking price (USD) while listed for sale. */
  listedUsd?: number;
  /** On-chain card (BSC testnet): its pack vault, NFT id and the bStock amount it holds (wei). */
  onchain?: { vault: `0x${string}`; cardId: string; amount: string };
};

const KEY = "bsctemp.collection.v1";
const listeners = new Set<() => void>();
let cache: OwnedCard[] | null = null;
const EMPTY: OwnedCard[] = [];

function load(): OwnedCard[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}

function save(next: OwnedCard[]) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep it in memory */ }
  listeners.forEach((l) => l());
}

export function addCard(card: Omit<OwnedCard, "id" | "openedAt">) {
  const all = load();
  save([...all, { ...card, id: (all.at(-1)?.id ?? 0) + 1, openedAt: Date.now() }]);
}

export function redeemCard(id: number) {
  save(load().map((c) => (c.id === id && !c.redeemedAt ? { ...c, redeemedAt: Date.now(), listedUsd: undefined } : c)));
}

/** Lists a kept card for sale at a price (USD); 0 or less takes it off sale. */
export function listCard(id: number, usd: number) {
  save(load().map((c) => (c.id === id && !c.redeemedAt ? { ...c, listedUsd: usd > 0 ? Math.round(usd * 100) / 100 : undefined } : c)));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useCollection = () => useSyncExternalStore(subscribe, load, () => EMPTY);

/** Removes every card (demo reset). */
export const clearCollection = () => save([]);
