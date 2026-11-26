"use client";

import { useSyncExternalStore } from "react";
import { clearCollection } from "@/lib/collection";

/*
 * Demo mode, like graily's: a demo wallet saved in this browser, so anyone can buy, open and redeem packs without
 * connecting a wallet. Until the vault contract is on BSC testnet this is the only way to buy. Leaving demo keeps the
 * demo wallet for next time; Reset starts it over.
 */

/** Starting demo balance, in BNB. */
export const DEMO_START_BNB = 0.5;

/** `assets`: bStocks (by ticker, e.g. TSLA) and launched tokens (by pack slug) bought in Trade. */
export type DemoState = { active: boolean; bnb: number; assets?: Record<string, number> };

const KEY = "bsctemp.demo.v1";
const OFF: DemoState = { active: false, bnb: DEMO_START_BNB };
const listeners = new Set<() => void>();
let cache: DemoState | null = null;

function read(): DemoState {
  if (cache) return cache;
  try { cache = { ...OFF, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { cache = OFF; }
  return cache!;
}

function write(next: DemoState) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep it in memory */ }
  listeners.forEach((l) => l());
}

/** Start or resume demo mode. */
export const startDemo = () => write({ ...read(), active: true });
/** Leave demo mode; the demo wallet stays saved. */
export const exitDemo = () => write({ ...read(), active: false });
/** Wipe the demo wallet and cards and start fresh. */
export function resetDemo() {
  clearCollection();
  write({ active: read().active, bnb: DEMO_START_BNB, assets: {} });
}
/** Pays from the demo wallet; false if demo is off or the balance is short. */
export function spendDemoBnb(amount: number) {
  const s = read();
  if (!s.active || !(amount > 0) || amount > s.bnb + 1e-12) return false;
  write({ ...s, bnb: Math.max(0, s.bnb - amount) });
  return true;
}

/**
 * Trades in the demo wallet at the given USD prices. Buy spends `amount` BNB for the asset; sell sells `amount` of the
 * asset for BNB. False if demo is off or the balance is short.
 */
export function tradeDemo(side: "buy" | "sell", asset: string, amount: number, assetUsd: number, bnbUsd: number) {
  const s = read();
  if (!s.active || !(amount > 0) || !(assetUsd > 0) || !(bnbUsd > 0)) return false;
  const assets = { ...(s.assets ?? {}) };
  if (side === "buy") {
    if (amount > s.bnb + 1e-12) return false;
    assets[asset] = (assets[asset] ?? 0) + (amount * bnbUsd) / assetUsd;
    write({ ...s, bnb: Math.max(0, s.bnb - amount), assets });
  } else {
    if (amount > (assets[asset] ?? 0) + 1e-12) return false;
    assets[asset] = Math.max(0, (assets[asset] ?? 0) - amount);
    write({ ...s, bnb: s.bnb + (amount * assetUsd) / bnbUsd, assets });
  }
  return true;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useDemo = () => useSyncExternalStore(subscribe, read, () => OFF);
