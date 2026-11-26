"use client";

import { useSyncExternalStore } from "react";
import { MARKET_COINS, slugify, toCoin, type MarketCoin } from "@/lib/market";
import type { PackConfig } from "@/lib/pack";

/* Packs launched from the Launch flow, saved in this browser and listed on the marketplace beside the seed packs. */


const KEY = "bsctemp.published-packs.v1";
type Published = { slug: string; config: PackConfig; publishedAt: number };
const listeners = new Set<() => void>();
let cache: Published[] | null = null;
const NONE: Published[] = [];

function readPublished(): Published[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}

/** Publishes the studio's pack; returns its slug. A new launch starts with an empty pool (Low packs only). */
export function publishPack(config: PackConfig) {
  // "classic" is the built-in classic packs page (/app/packs/classic).
  const taken = new Set(["classic", ...MARKET_COINS.map((c) => c.slug), ...readPublished().map((p) => p.slug)]);
  const base = slugify(config.name);
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  // Keep the coin picture, cover and card images only if they're the small shrunk ones.
  const small = (v: string | null | undefined, max: number) => (v && v.length < max ? v : null);
  const image = small(config.image, 60_000);
  // Optional links: keep only short, non-empty ones.
  const links = Object.fromEntries(Object.entries(config.links ?? {}).map(([k, v]) => [k, v?.trim()]).filter(([, v]) => v && v.length <= 200));
  const clean: PackConfig = { ...config, image, tagline: (config.tagline ?? "").slice(0, 200), links: Object.keys(links).length ? links : undefined, cover: small(config.cover, 60_000), cards: config.cards.map((d) => ({ ...d, image: small(d.image, 40_000) })) };
  cache = [...readPublished(), { slug, config: clean, publishedAt: Date.now() }];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep in memory */ }
  listeners.forEach((l) => l());
  return slug;
}

/** Removes coins launched in this browser in demo mode; coins that exist on-chain stay. */
export function clearDemoCoins() {
  cache = readPublished().filter((p) => p.config.onchain);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep in memory */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Seed packs plus the ones published in this browser (new launches: empty pool, newest first). */
export function useMarketCoins(): MarketCoin[] {
  const published = useSyncExternalStore(subscribe, readPublished, () => NONE);
  return [
    ...MARKET_COINS,
    ...published.map((p) => toCoin(p.config, { poolUsd: 0, volumeUsd: 0, ageDays: 0 }, false, p.slug)),
  ];
}
