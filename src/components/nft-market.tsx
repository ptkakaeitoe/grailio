"use client";

import { useEffect, useState } from "react";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { cn } from "@/components/clean-ui";
import { TradeToolbar } from "@/components/trade-toolbar";
import { useCardArt } from "@/lib/design";
import { listCard, useCollection } from "@/lib/collection";
import { startDemo, useDemo } from "@/lib/demo";
import { buyListing, ownListing, useListings, type Listing } from "@/lib/nft-market";
import { RARITIES } from "@/lib/pack";
import { showToast } from "@/lib/toast";
import { usd } from "@/lib/format";

const action = "inline-flex min-h-10 w-full items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Pack cards for sale: your listings first, then other collectors'. Buying pays from the demo wallet. Same toolbar as
 * the other Trade tabs (All, Yours, search), then the card grid.
 */
export function NftMarket() {
  const demo = useDemo();
  const listings = useListings();
  const cardArt = useCardArt();
  const mine = useCollection().filter((c) => c.listedUsd && !c.redeemedAt);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [view, setView] = useState<"all" | "mine">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => { if (typeof d.price === "number" && d.price > 0) setBnbUsd(d.price); }).catch(() => {});
  }, []);

  const buy = (l: Listing) => {
    if (!demo.active) { startDemo(); return; }
    if (!bnbUsd) return;
    if (buyListing(l, bnbUsd)) showToast({ kind: "success", title: `${cardArt(l).name} is yours`, detail: "Added to your collection · simulated" });
    else showToast({ kind: "error", title: "Not enough demo BNB" });
  };

  const all = [...mine.map((c) => ({ listing: ownListing(c), ownId: c.id })), ...listings.map((l) => ({ listing: l, ownId: null as number | null }))];
  const q = query.trim().toLowerCase();
  const items = all.filter(({ listing: l, ownId }) =>
    (view === "all" || ownId !== null) && (!q || [l.coinName, l.ticker, cardArt(l).name].some((t) => t.toLowerCase().includes(q))));
  const cheapest = all.length ? Math.min(...all.map(({ listing }) => listing.priceUsd)) : null;

  const status = (
    <>
      <span>{all.length} cards for sale</span>
      {cheapest !== null && <><span aria-hidden="true">·</span><span>from {usd(cheapest)}</span></>}
      <span aria-hidden="true">·</span>
      <span>paid in BNB</span>
    </>
  );

  return (
    <div className="flex flex-col gap-5 desk:gap-6">
      <TradeToolbar
        views={[["all", "All"], ["mine", "Yours"]] as const}
        view={view}
        onView={setView}
        status={status}
        query={query}
        onQuery={setQuery}
        placeholder="Search cards"
        searchLabel="Search cards by name, coin or ticker"
      />
      {items.length === 0 && (
        <p className="border-y border-border py-12 text-center text-sm text-muted">{view === "mine" ? "You haven't listed any cards." : "No cards match."}</p>
      )}
      <ul className="grid grid-cols-2 gap-x-3.5 gap-y-7 phone:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] desk:gap-x-6 desk:gap-y-10">
        {items.map(({ listing: l, ownId }) => {
          const art = cardArt(l);
          return (
            <li key={l.id} className="min-w-0">
              <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px]">
                <StockCardFront art={art} rarity={l.rarity} brand={l.coinName} decorative sizes="(max-width: 480px) 45vw, 200px" className="w-full" />
                <Holo rarity={l.rarity} />
                <span className="holo-glare" aria-hidden="true" />
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm capitalize text-muted">{RARITIES[l.rarity]} · {l.ticker}</span>
                <span className="shrink-0 text-base tabular-nums">{usd(l.priceUsd)}</span>
              </div>
              <p className="mb-2 truncate text-[13px] text-muted">Holds {usd(l.usd)} · {ownId !== null ? "yours" : l.seller}</p>
              {ownId !== null ? (
                <button type="button" className={cn(action, "border border-border hover:border-black")} onClick={() => listCard(ownId, 0)}>Unlist</button>
              ) : (
                <button type="button" className={cn(action, "bg-black text-white hover:opacity-90")} disabled={demo.active && !bnbUsd} onClick={() => buy(l)}>
                  {demo.active ? (bnbUsd ? `Buy · ${(l.priceUsd / bnbUsd).toFixed(4)} BNB` : "Loading…") : "Try the demo"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
