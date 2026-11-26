"use client";

import { simTokenPrice, useDemoLaunches } from "@/lib/launch/demo-launch";
import { demoTokenPrice } from "@/lib/launch/market";
import { useMarketCoins } from "@/lib/launch/published-packs";

/** A launched coin held in the demo wallet, in the shape the holdings list uses. */
export type LaunchedHolding = { key: string; label: string; color: string; value: number; price: number | null };

/**
 * Testnet: launched coins in the demo wallet (`token:<slug>` balances), priced at their simulated price, for the
 * holdings list. Pass null (mainnet, or no demo) to get none; the hook always runs so hook order never changes.
 */
export function useLaunchedHoldings(balances: Record<string, number> | null): LaunchedHolding[] {
  const coins = useMarketCoins();
  const sims = useDemoLaunches();
  if (!balances) return [];
  return Object.entries(balances).flatMap(([key, value]) => {
    if (!key.startsWith("token:") || !(value > 0)) return [];
    const coin = coins.find((c) => c.slug === key.slice(6));
    if (!coin) return [];
    return [{ key, label: coin.config.ticker || coin.name, color: coin.tone, value, price: simTokenPrice(sims, coin) ?? demoTokenPrice(coin) }];
  });
}
