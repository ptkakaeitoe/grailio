"use client";

import { useSyncExternalStore } from "react";
import { setStaked, type OwnedCard } from "@/lib/collection";
import { creditDemoAsset, earnDemoBnb, spendDemoBnb } from "@/lib/demo";
import { DEFAULT_SIZES, type PackSize } from "@/lib/pack";
import type { MarketCoin } from "@/lib/market";

/*
 * Demo mode's pack launch, simulated in this browser with the same numbers as the contracts
 * (contracts/src/packs/PackLauncher.sol, PackVault.sol, PackTypes.sol):
 *  - Presale: PRESALE_PACKS packs at one pack price. The sale that sells the last pack launches the coin:
 *    70% of the raise seeds liquidity, 30% becomes the presale reserve, and buyers split 50% of the supply by packs.
 *  - Presale packs pay (reserve left / presale packs left) x a Medium roll / 0.9; the last one gets what remains.
 *  - Bought packs (Low / Medium / High at the pack price): buying sets the top prize aside; the margin, or the
 *    shortfall, moves the stock pool. Medium and High sell only while the pool covers (top prize - price).
 *  - Trading tax splits 50% pool / 30% card stakers / 15% creator / 5% platform. Stakers' share streams by card value
 *    over 7 days, accelerated here to STREAM_MS.
 * All amounts are USD; the demo wallet pays and receives BNB at the live BNB price.
 */

export const PRESALE_PACKS = 10;
export const SEED_SHARE = 0.3;
export const TOTAL_SUPPLY = 1_000_000;
export const BUYERS_SUPPLY = TOTAL_SUPPLY * 0.5;
/** Market cap a presale buyer pays (coins net of the card's share of the raise) and the pool opens at: equal at 50/50. */
export const presaleMcap = (raise: number) => (raise * (1 - SEED_SHARE)) / (BUYERS_SUPPLY / TOTAL_SUPPLY);
export const launchMcap = (raise: number) => (raise * (1 - SEED_SHARE)) / (1 - BUYERS_SUPPLY / TOTAL_SUPPLY);
export const TAX_SPLIT = { pool: 0.5, stakers: 0.3, creator: 0.15, platform: 0.05 } as const;
/** The vault streams stakers' rewards over 7 days; the demo streams them over a minute. */
export const STREAM_MS = 60_000;

export type Tier = 0 | 1 | 2;
export const TIERS: { id: Tier; name: string }[] = [{ id: 0, name: "Low" }, { id: 1, name: "Medium" }, { id: 2, name: "High" }];
/** What a pack pays, as a multiple of the pack price: ten equally likely outcomes (PackOdds.table). */
export const TABLES: Record<Tier, number[]> = {
  0: [0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95],
  1: [0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.5, 1.5],
  2: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 2.1, 3],
};
const MEDIUM_AVG = 0.9;
export const topMult = (tier: Tier) => Math.max(...TABLES[tier]);

export type LaunchSim = {
  phase: "presale" | "live";
  price: number;
  packsForSale: number;
  packsSold: number;
  /** Presale packs you bought. */
  mine: number;
  liquidity: number;
  presaleReserve: number;
  /** Unopened presale packs, everyone's. */
  presaleLeft: number;
  /** Presale packs you opened. */
  presaleOpened: number;
  /** Coins credited to you at launch. */
  tokens: number;
  pool: number;
  reserved: number;
  /** Your unopened bought packs per tier. */
  bought: [number, number, number];
  /** Trading tax received so far, by destination. */
  tax: { pool: number; stakers: number; creator: number; platform: number };
  /** Stakers' stream (you are the only staker in the demo). */
  stake: { pot: number; queued: number; rate: number; finish: number; last: number; earned: number; weight: number; claimed: number };
};

const KEY = "bsctemp.demo-launch.v1";
const listeners = new Set<() => void>();
let cache: Record<string, LaunchSim> | null = null;
const NONE: Record<string, LaunchSim> = {};

function load(): Record<string, LaunchSim> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { cache = {}; }
  return cache!;
}

function save(next: Record<string, LaunchSim>) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep it in memory */ }
  listeners.forEach((l) => l());
}

/** The coin's one pack: its Standard size (or its first), which sets the pack price. */
export function packSizeOf(coin: MarketCoin): PackSize {
  const sizes = coin.config.sizes?.length ? coin.config.sizes : DEFAULT_SIZES;
  const offered = sizes.filter((s) => coin.packs.some((p) => p.size === s.id));
  const list = offered.length ? offered : sizes;
  return list.find((s) => s.id === "standard") ?? list[0];
}

const EMPTY_STAKE: LaunchSim["stake"] = { pot: 0, queued: 0, rate: 0, finish: 0, last: 0, earned: 0, weight: 0, claimed: 0 };

/** A new launch starts in presale; seed coins are already live with their listed pool. */
function initial(coin: MarketCoin): LaunchSim {
  const price = packSizeOf(coin).price;
  const raise = price * PRESALE_PACKS;
  const base: LaunchSim = {
    phase: "presale", price, packsForSale: PRESALE_PACKS, packsSold: 0, mine: 0, liquidity: 0, presaleReserve: 0, presaleLeft: 0,
    presaleOpened: 0, tokens: 0, pool: 0, reserved: 0, bought: [0, 0, 0], tax: { pool: 0, stakers: 0, creator: 0, platform: 0 }, stake: EMPTY_STAKE,
  };
  if (!coin.seed) return base;
  return { ...base, phase: "live", packsSold: PRESALE_PACKS, liquidity: raise * (1 - SEED_SHARE), pool: coin.poolUsd };
}

export const simOf = (all: Record<string, LaunchSim>, coin: MarketCoin) => all[coin.slug] ?? initial(coin);

/** A demo-launched coin's token price: its launch mcap over the supply; null before launch or for seed coins. */
export const simTokenPrice = (all: Record<string, LaunchSim>, coin: MarketCoin) => {
  const s = all[coin.slug];
  return s?.phase === "live" ? launchMcap(s.price * s.packsForSale) / TOTAL_SUPPLY : null;
};

function update(coin: MarketCoin, fn: (s: LaunchSim) => LaunchSim | null) {
  const all = load();
  const next = fn(simOf(all, coin));
  if (next) save({ ...all, [coin.slug]: next });
  return next;
}

/* ---------- presale ---------- */

/** Sells the last pack: launch. Your share of the buyers' supply goes to the demo wallet. */
function launch(coin: MarketCoin, s: LaunchSim): LaunchSim {
  const raise = s.price * s.packsForSale;
  const tokens = (s.mine * BUYERS_SUPPLY) / s.packsForSale;
  if (tokens > 0) creditDemoAsset(`token:${coin.slug}`, tokens);
  return { ...s, phase: "live", liquidity: raise * (1 - SEED_SHARE), presaleReserve: raise * SEED_SHARE, presaleLeft: s.packsForSale, tokens };
}

/** Buy presale packs from the demo wallet. */
export function buyPresale(coin: MarketCoin, quantity: number, bnbUsd: number) {
  const s = simOf(load(), coin);
  const q = Math.min(quantity, s.packsForSale - s.packsSold);
  if (s.phase !== "presale" || q < 1 || !(bnbUsd > 0)) return false;
  if (!spendDemoBnb((q * s.price) / bnbUsd)) return false;
  update(coin, (cur) => {
    const next = { ...cur, packsSold: cur.packsSold + q, mine: cur.mine + q };
    return next.packsSold >= next.packsForSale ? launch(coin, next) : next;
  });
  return true;
}

/** Simulated other buyers take one presale pack. */
export function otherBuysPresale(coin: MarketCoin) {
  return update(coin, (s) => {
    if (s.phase !== "presale" || s.packsSold >= s.packsForSale) return null;
    const next = { ...s, packsSold: s.packsSold + 1 };
    return next.packsSold >= next.packsForSale ? launch(coin, next) : next;
  });
}

export const presalePacksOf = (s: LaunchSim) => (s.phase === "live" && s.presaleLeft > 0 ? Math.max(0, s.mine - s.presaleOpened) : 0);

export type Opened = { value: number; roll: number };
const rollOf = (tier: Tier) => TABLES[tier][Math.floor(Math.random() * 10)];

/** Open one of your presale packs: its share of the presale reserve times a Medium roll scaled to 1x. */
export function openPresale(coin: MarketCoin): Opened | null {
  let out: Opened | null = null;
  update(coin, (s) => {
    if (presalePacksOf(s) < 1) return null;
    const roll = rollOf(1);
    const left = s.presaleLeft;
    const value = left <= 1 ? s.presaleReserve : Math.min(s.presaleReserve, (s.presaleReserve / left) * (roll / MEDIUM_AVG));
    out = { value, roll: roll / MEDIUM_AVG };
    return { ...s, presaleReserve: Math.max(0, s.presaleReserve - value), presaleLeft: Math.max(0, left - 1), presaleOpened: s.presaleOpened + 1 };
  });
  return out;
}

/* ---------- packs after launch ---------- */

/** How much of the pool `quantity` packs of a tier need (top prizes beyond what they cost). */
export const poolNeeded = (s: LaunchSim, tier: Tier, quantity = 1) => Math.max(0, (topMult(tier) - 1) * s.price * quantity);
export const canBuyTier = (s: LaunchSim, tier: Tier, quantity = 1) => s.phase === "live" && s.pool + 1e-9 >= poolNeeded(s, tier, quantity);

/** PackVault.buy: pay the price, set the top prizes aside, the margin (or the shortfall) moves the pool. */
export function buyTier(coin: MarketCoin, tier: Tier, quantity: number, bnbUsd: number) {
  const s = simOf(load(), coin);
  if (quantity < 1 || !canBuyTier(s, tier, quantity) || !(bnbUsd > 0)) return false;
  if (!spendDemoBnb((quantity * s.price) / bnbUsd)) return false;
  update(coin, (cur) => {
    const cost = cur.price * quantity;
    const top = topMult(tier) * cur.price * quantity;
    const bought = [...cur.bought] as LaunchSim["bought"];
    bought[tier] += quantity;
    return { ...cur, pool: Math.max(0, cur.pool - top + cost), reserved: cur.reserved + top, bought };
  });
  return true;
}

/** PackVault.reveal: the roll's value comes out of the set-aside top prize; the rest returns to the pool. */
export function openBought(coin: MarketCoin, tier: Tier): Opened | null {
  let out: Opened | null = null;
  update(coin, (s) => {
    if (s.bought[tier] < 1) return null;
    const roll = rollOf(tier);
    const top = topMult(tier) * s.price;
    const value = roll * s.price;
    out = { value, roll };
    const bought = [...s.bought] as LaunchSim["bought"];
    bought[tier] -= 1;
    return { ...s, bought, reserved: Math.max(0, s.reserved - top), pool: s.pool + top - value };
  });
  return out;
}

/* ---------- tax and staking ---------- */

function accrue(st: LaunchSim["stake"], now: number): LaunchSim["stake"] {
  const t = Math.min(now, st.finish);
  if (t <= st.last) return st;
  const streamed = (t - st.last) * st.rate;
  return st.weight > 0 ? { ...st, earned: st.earned + streamed, last: t } : { ...st, queued: st.queued + streamed, last: t };
}

/** Restart the stream with `add`, whatever is still streaming, and anything queued (once something is staked). */
function restream(st: LaunchSim["stake"], add: number, now: number): LaunchSim["stake"] {
  if (st.weight <= 0) return { ...st, queued: st.queued + add };
  const amount = add + st.queued + (now < st.finish ? (st.finish - now) * st.rate : 0);
  if (amount <= 0) return { ...st, queued: 0 };
  return { ...st, queued: 0, rate: amount / STREAM_MS, last: now, finish: now + STREAM_MS };
}

/** Rewards you could claim right now. */
export function earnedNow(s: LaunchSim, now: number) {
  const st = s.stake;
  if (st.weight <= 0) return Math.min(st.earned, st.pot);
  const t = Math.min(now, st.finish);
  return Math.min(st.pot, st.earned + (t > st.last ? (t - st.last) * st.rate : 0));
}

/** Days the vault streams over (STREAM_MS in the demo), and one simulated vault day in demo time. */
export const STREAM_DAYS = 7;
export const DAY_MS = STREAM_MS / STREAM_DAYS;

/**
 * Read-only staking numbers for one coin at `now` (no state change). `streaming`: rewards still to stream out;
 * `perDay`: what streams per simulated vault day; `daysLeft`: simulated days until the stream ends; `queued`: rewards
 * waiting for a first staker; `totalWeight`: all staked value (you are the only staker in the demo).
 */
export function stakeStats(s: LaunchSim, now: number) {
  const st = s.stake;
  const left = now < st.finish ? (st.finish - now) * st.rate : 0;
  const live = st.weight > 0 && left > 0;
  return {
    streaming: live ? left : 0,
    perDay: live ? st.rate * DAY_MS : 0,
    daysLeft: live ? (st.finish - now) / DAY_MS : 0,
    queued: st.queued + (live ? 0 : left),
    totalWeight: st.weight,
    claimable: earnedNow(s, now),
  };
}

/** Simulated trading tax arrives and is split 50 / 30 / 15 / 5. */
export function simulateTax(coin: MarketCoin, amountUsd: number) {
  const now = Date.now();
  update(coin, (s) => {
    if (s.phase !== "live" || !(amountUsd > 0)) return null;
    const toStakers = amountUsd * TAX_SPLIT.stakers, toCreator = amountUsd * TAX_SPLIT.creator, toPlatform = amountUsd * TAX_SPLIT.platform;
    const toPool = amountUsd - toStakers - toCreator - toPlatform;
    const stake = restream({ ...accrue(s.stake, now), pot: s.stake.pot + toStakers }, toStakers, now);
    return {
      ...s, pool: s.pool + toPool, stake,
      tax: { pool: s.tax.pool + toPool, stakers: s.tax.stakers + toStakers, creator: s.tax.creator + toCreator, platform: s.tax.platform + toPlatform },
    };
  });
}

function pay(st: LaunchSim["stake"], bnbUsd: number): LaunchSim["stake"] {
  const amount = Math.min(st.earned, st.pot);
  if (amount <= 0 || !(bnbUsd > 0) || !earnDemoBnb(amount / bnbUsd)) return st;
  return { ...st, earned: st.earned - amount, pot: st.pot - amount, claimed: st.claimed + amount };
}

/** Stake cards: each weighs its value. */
export function stakeCards(coin: MarketCoin, cards: OwnedCard[]) {
  const picked = cards.filter((c) => c.coin === coin.slug && !c.redeemedAt && !c.stakedAt && c.usd > 0);
  if (!picked.length) return;
  const now = Date.now();
  update(coin, (s) => {
    let stake: LaunchSim["stake"] = { ...accrue(s.stake, now), weight: s.stake.weight + picked.reduce((t, c) => t + c.usd, 0) };
    if (stake.queued > 0) stake = restream(stake, 0, now);
    return { ...s, stake };
  });
  setStaked(picked.map((c) => c.id), true);
}

/** Unstake cards and collect rewards. */
export function unstakeCards(coin: MarketCoin, cards: OwnedCard[], bnbUsd: number) {
  const picked = cards.filter((c) => c.coin === coin.slug && c.stakedAt && !c.redeemedAt);
  if (!picked.length) return;
  const now = Date.now();
  update(coin, (s) => {
    const accrued = accrue(s.stake, now);
    const weight = Math.max(0, accrued.weight - picked.reduce((t, c) => t + c.usd, 0));
    return { ...s, stake: pay({ ...accrued, weight: weight < 1e-9 ? 0 : weight }, bnbUsd) };
  });
  setStaked(picked.map((c) => c.id), false);
}

/** Claim rewards into the demo wallet. */
export function claimRewards(coin: MarketCoin, bnbUsd: number) {
  const now = Date.now();
  update(coin, (s) => ({ ...s, stake: pay(accrue(s.stake, now), bnbUsd) }));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useDemoLaunches = () => useSyncExternalStore(subscribe, load, () => NONE);
/** The simulated launch of one coin. */
export function useLaunchSim(coin: MarketCoin) {
  return simOf(useDemoLaunches(), coin);
}

/** Forgets every simulated launch (demo reset). */
export const clearDemoLaunches = () => save({});
