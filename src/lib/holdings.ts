"use client";

import { useEffect, useMemo, useState } from "react";
import { useCollection } from "@/lib/collection";
import { useDemo } from "@/lib/demo";
import { stockOf } from "@/lib/stocks";
import { demoTokenPrice } from "@/lib/market";
import { useMarketCoins } from "@/lib/published-packs";
import { simTokenPrice, useDemoLaunches } from "@/lib/demo-launch";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { bscTestnet } from "viem/chains";
import { TEST_USD, TRADE_STOCKS } from "@/lib/trade-market";

/** Tokens read from a connected wallet on BSC testnet: Flap test USD, then every stock on the trade market. */
const LIVE_TOKENS: { key: string; ticker: string | null; address: `0x${string}` }[] = [
  { key: "usd", ticker: null, address: TEST_USD },
  ...Object.entries(TRADE_STOCKS).map(([ticker, address]) => ({ key: ticker, ticker, address })),
];

/*
 * What the demo wallet holds: BNB, bStocks and tokens bought in Trade, the bStocks paid out by redeemed cards, and the
 * bStocks still sealed inside the cards you keep. Valued at live prices: BNB from the Atlas BNB/USD feed (/api/bnb), bStocks from signed Atlas prices (/api/atlas).
 */

export type Holding = { key: string; label: string; name: string; ticker: string | null; amount: number; price: number | null; image?: string | null };

export function useHoldings() {
  const demo = useDemo();
  // A connected wallet (with demo off) shows what it really holds on BSC testnet.
  const { address } = useAccount();
  const live = Boolean(address) && !demo.active;
  const tbnb = useBalance({ address, chainId: bscTestnet.id, query: { enabled: live, refetchInterval: 15_000 } });
  const tokenReads = useReadContracts({
    allowFailure: true,
    contracts: LIVE_TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf" as const, args: [address!] as const, chainId: bscTestnet.id })),
    query: { enabled: live, refetchInterval: 15_000 },
  });
  const liveAmounts = useMemo(() => {
    const out: Record<string, number> = {};
    LIVE_TOKENS.forEach((t, i) => {
      const row = tokenReads.data?.[i];
      if (row?.status === "success") out[t.key] = Number(formatUnits(row.result as bigint, 18));
    });
    return out;
  }, [tokenReads.data]);
  const cards = useCollection();
  const coins = useMarketCoins();
  const sims = useDemoLaunches();
  const assets = useMemo(() => demo.assets ?? {}, [demo.assets]);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [prices, setPrices] = useState<Map<number, number>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Feeds for every stock the collection touches.
  const stockTickers = useMemo(() => [
    ...cards.map((c) => c.ticker),
    ...Object.keys(assets).filter((k) => !k.startsWith("token:")),
    ...(live ? Object.keys(liveAmounts).filter((k) => k !== "usd" && liveAmounts[k] > 0) : []),
  ], [cards, assets, live, liveAmounts]);
  const feedIds = useMemo(() => [...new Set(stockTickers.map((t) => stockOf(t)?.feedId).filter((id): id is number => typeof id === "number"))].sort((a, b) => a - b), [stockTickers]);
  const feedKey = feedIds.join(",");

  useEffect(() => {
    let live = true;
    const bnb = fetch("/api/bnb").then((r) => r.json()).then((d) => { if (live && typeof d.price === "number") setBnbUsd(d.price); }).catch(() => {});
    const atlas = feedKey
      ? fetch(`/api/atlas?ids=${feedKey}`).then((r) => r.json()).then((d: { quotes?: { id: number; price: number }[] }) => {
          if (live && Array.isArray(d.quotes)) setPrices(new Map(d.quotes.map((q) => [q.id, q.price])));
        }).catch(() => {})
      : Promise.resolve();
    Promise.all([bnb, atlas]).finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [feedKey]);

  const priceOf = (ticker: string) => {
    const id = stockOf(ticker)?.feedId;
    return id != null ? prices.get(id) ?? null : null;
  };

  // Redeemed cards: their bStocks are in the wallet, summed per stock.
  const redeemed = new Map<string, number>();
  for (const c of cards) if (c.redeemedAt) redeemed.set(c.ticker, (redeemed.get(c.ticker) ?? 0) + c.shares);
  // Bought in Trade.
  for (const [k, amount] of Object.entries(assets)) if (!k.startsWith("token:") && amount > 0) redeemed.set(k, (redeemed.get(k) ?? 0) + amount);
  const tokens = Object.entries(assets).flatMap(([k, amount]) => {
    const coin = k.startsWith("token:") && amount > 0 ? coins.find((c) => c.slug === k.slice(6)) : undefined;
    return coin ? [{ key: k, label: coin.config.ticker || coin.name, name: coin.name, image: coin.config.image, ticker: null, amount, price: simTokenPrice(sims, coin) ?? demoTokenPrice(coin) }] : [];
  });

  const liveHoldings: Holding[] = [
    { key: "bnb", label: "tBNB", name: "BNB Chain testnet", ticker: null, amount: tbnb.data ? Number(formatUnits(tbnb.data.value, 18)) : 0, price: bnbUsd },
    ...((liveAmounts.usd ?? 0) > 0 ? [{ key: "usdt", label: "Test USD", name: "Flap test USD", ticker: null, amount: liveAmounts.usd, price: 1 }] : []),
    ...LIVE_TOKENS.filter((t) => t.ticker && (liveAmounts[t.key] ?? 0) > 0).map((t) => ({ key: t.key, label: t.ticker!, name: stockOf(t.ticker!)?.name ?? t.ticker!, ticker: t.ticker, amount: liveAmounts[t.key], price: priceOf(t.ticker!) })),
  ];

  const holdings: Holding[] = live ? liveHoldings : [
    { key: "bnb", label: "BNB", name: "BNB Chain testnet", ticker: null, amount: demo.bnb, price: bnbUsd },
    ...(demo.active && demo.usdt > 0 ? [{ key: "usdt", label: "USDT", name: "Demo USDT", ticker: null, amount: demo.usdt, price: 1 }] : []),
    ...[...redeemed].map(([ticker, amount]) => ({ key: ticker, label: ticker, name: stockOf(ticker)?.name ?? ticker, ticker, amount, price: priceOf(ticker) })),
    ...tokens,
  ];

  // Cards you keep: the bStocks inside them, at today's price.
  const held = cards.filter((c) => !c.redeemedAt);
  const inCards = held.reduce((s, c) => s + c.shares * (priceOf(c.ticker) ?? 0), 0);

  const walletValue = holdings.reduce((s, h) => s + (h.price === null ? 0 : h.amount * h.price), 0);
  return { loaded: loaded && (!live || (tbnb.data !== undefined && tokenReads.data !== undefined)), holdings, inCards, cardCount: held.length, walletValue, live };
}
