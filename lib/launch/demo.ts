"use client";

import { useSyncExternalStore } from "react";
import { clearCollection } from "@/lib/launch/collection";
import { clearDemoLaunches } from "@/lib/launch/demo-launch";
import { readDemo, serverDemo, subscribeDemo, writeDemo, type DemoSnapshot } from "@/lib/demo-store";

/*
 * The launch feature's view of the app's demo wallet (lib/demo-store, the same one the rest of the app and the header's
 * demo chip use): its BNB and USDT, plus coins bought in launch trades, kept as `token:<slug>` balances so they show in
 * holdings. Same API as before (startDemo, spendDemoBnb, tradeDemo, …), now one wallet for the whole app.
 */

/** `assets`: launched coins (`token:<slug>`) and any other balance in the demo wallet besides BNB and USDT. */
export type DemoState = { active: boolean; bnb: number; usdt: number; assets?: Record<string, number> };

const views = new WeakMap<DemoSnapshot, DemoState>();
/** A stable view per snapshot, so useSyncExternalStore sees the same object until the wallet changes. */
function view(snap: DemoSnapshot): DemoState {
  let v = views.get(snap);
  if (!v) {
    const { BNB = 0, USDT = 0, ...assets } = snap.state.balances;
    v = { active: snap.active, bnb: BNB, usdt: USDT, assets };
    views.set(snap, v);
  }
  return v;
}

const read = () => view(readDemo());
/** Writes new balances into the shared demo wallet. */
function setBalances(next: Record<string, number>) {
  const snap = readDemo();
  writeDemo({ ...snap, state: { ...snap.state, balances: next } });
}
const balances = () => readDemo().state.balances;

/** Start or resume demo mode. */
export const startDemo = () => writeDemo({ ...readDemo(), active: true });
/** Leave demo mode; the demo wallet stays saved. */
export const exitDemo = () => writeDemo({ ...readDemo(), active: false });
/** Forget simulated launches and their cards (the wallet itself resets from the app's Reset demo). */
export function resetDemo() {
  clearCollection();
  clearDemoLaunches();
}

/** Pays from the demo wallet; false if demo is off or the balance is short. */
export function spendDemoBnb(amount: number) {
  const s = read();
  if (!s.active || !(amount > 0) || amount > s.bnb + 1e-12) return false;
  setBalances({ ...balances(), BNB: Math.max(0, s.bnb - amount) });
  return true;
}

/** Pays BNB into the demo wallet (staking rewards); false if demo is off. */
export function earnDemoBnb(amount: number) {
  const s = read();
  if (!s.active || !(amount > 0)) return false;
  setBalances({ ...balances(), BNB: s.bnb + amount });
  return true;
}

/** Adds an asset to the demo wallet (e.g. `token:<slug>` from a presale); false if demo is off. */
export function creditDemoAsset(asset: string, amount: number) {
  const s = read();
  if (!s.active || !(amount > 0)) return false;
  const b = balances();
  setBalances({ ...b, [asset]: (b[asset] ?? 0) + amount });
  return true;
}

/**
 * Trades in the demo wallet at the given USD prices. Buy spends `amount` BNB for the asset; sell sells `amount` of the
 * asset for BNB. False if demo is off or the balance is short.
 */
export function tradeDemo(side: "buy" | "sell", asset: string, amount: number, assetUsd: number, bnbUsd: number) {
  const s = read();
  if (!s.active || !(amount > 0) || !(assetUsd > 0) || !(bnbUsd > 0)) return false;
  const b = { ...balances() };
  if (side === "buy") {
    if (amount > s.bnb + 1e-12) return false;
    b.BNB = Math.max(0, s.bnb - amount);
    b[asset] = (b[asset] ?? 0) + (amount * bnbUsd) / assetUsd;
  } else {
    if (amount > (b[asset] ?? 0) + 1e-12) return false;
    b[asset] = Math.max(0, (b[asset] ?? 0) - amount);
    b.BNB = s.bnb + (amount * assetUsd) / bnbUsd;
  }
  setBalances(b);
  return true;
}

const serverView = () => view(serverDemo());
export const useDemo = () => useSyncExternalStore(subscribeDemo, read, serverView);
