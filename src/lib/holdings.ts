"use client";

import { useEffect, useMemo, useState } from "react";
import { useCollection } from "@/lib/collection";
import { useDemo } from "@/lib/demo";
import { stockOf } from "@/lib/stocks";

/*
 * What the demo wallet holds: BNB, the bStocks paid out by redeemed cards, and the bStocks still sealed inside the
 * cards you keep. Valued at live prices: BNB from Chainlink (/api/bnb), bStocks from signed Atlas prices (/api/atlas).
 */

export type Holding = { key: string; label: string; name: string; ticker: string | null; amount: number; price: number | null };

export function useHoldings() {
  const demo = useDemo();
  const cards = useCollection();
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [prices, setPrices] = useState<Map<number, number>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Feeds for every stock the collection touches.
  const feedIds = useMemo(() => [...new Set(cards.map((c) => stockOf(c.ticker)?.feedId).filter((id): id is number => typeof id === "number"))].sort((a, b) => a - b), [cards]);
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

  const holdings: Holding[] = [
    { key: "bnb", label: "BNB", name: "BNB Chain testnet", ticker: null, amount: demo.bnb, price: bnbUsd },
    ...[...redeemed].map(([ticker, amount]) => ({ key: ticker, label: `${ticker}B`, name: stockOf(ticker)?.name ?? ticker, ticker, amount, price: priceOf(ticker) })),
  ];

  // Cards you keep: the bStocks inside them, at today's price.
  const held = cards.filter((c) => !c.redeemedAt);
  const inCards = held.reduce((s, c) => s + c.shares * (priceOf(c.ticker) ?? 0), 0);

  const walletValue = holdings.reduce((s, h) => s + (h.price === null ? 0 : h.amount * h.price), 0);
  return { loaded, holdings, inCards, cardCount: held.length, total: walletValue + inCards };
}
