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

export type DemoState = { active: boolean; bnb: number };

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
  write({ active: read().active, bnb: DEMO_START_BNB });
}
/** Pays from the demo wallet; false if demo is off or the balance is short. */
export function spendDemoBnb(amount: number) {
  const s = read();
  if (!s.active || !(amount > 0) || amount > s.bnb + 1e-12) return false;
  write({ ...s, bnb: Math.max(0, s.bnb - amount) });
  return true;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useDemo = () => useSyncExternalStore(subscribe, read, () => OFF);
