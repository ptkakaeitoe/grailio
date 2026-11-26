"use client";

import { useEffect, useState } from "react";
import { cleanButton, cn } from "@/components/clean-ui";
import { useCollection, type OwnedCard } from "@/lib/launch/collection";
import { useDemo } from "@/lib/launch/demo";
import { STREAM_MS, claimRewards, earnedNow, stakeCards, unstakeCards, type LaunchSim } from "@/lib/launch/demo-launch";
import { useMarketCoins } from "@/lib/launch/published-packs";
import { RARITIES, RARITY_DOT } from "@/lib/launch/pack";
import { usd } from "@/lib/launch/format";
import type { MarketCoin } from "@/lib/launch/market";

/** Collection slug of coinless classic cards (see classic-pack-shop). */
const CLASSIC_SLUG = "classic";

/*
 * Card staking for one coin in demo mode: staked cards earn the stakers' 30% of the trading tax by card value, streamed
 * over 7 days in the vault (a minute here). Staked cards can't be redeemed or listed until unstaked.
 */

const rowButton = "inline-flex min-h-11 min-w-[88px] shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm transition-colors hover:border-black";

/** Used only if the BNB price feed can't be reached, so the demo still works. */
const FALLBACK_BNB_USD = 600;
let bnbPrice: Promise<number> | null = null;
/** The BNB price, fetched once per page load and shared. */
export function useBnbUsd() {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    bnbPrice ??= fetch("/api/bnb").then((r) => r.json()).then((d) => (typeof d.price === "number" && d.price > 0 ? d.price : FALLBACK_BNB_USD)).catch(() => FALLBACK_BNB_USD);
    let live = true;
    void bnbPrice.then((p) => { if (live) setPrice(p); });
    return () => { live = false; };
  }, []);
  return price;
}

/** Re-renders every `ms` while `on`, for the streaming rewards. */
export function useNow(on: boolean, ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return now;
}

export function StakePanel({ market, sim, bnbUsd }: { market: MarketCoin; sim: LaunchSim; bnbUsd: number | null }) {
  const demo = useDemo();
  const all = useCollection();
  const cards = all.filter((c) => c.coin === market.slug && !c.redeemedAt && !c.onchain).reverse();
  const [on, setOn] = useState(false);
  const now = useNow(on);
  const streaming = sim.stake.weight > 0 && sim.stake.finish > now;
  if (streaming !== on) setOn(streaming);
  const claimable = earnedNow(sim, now);
  const staked = cards.filter((c) => c.stakedAt);
  const free = cards.filter((c) => !c.stakedAt);
  const canPay = demo.active && Boolean(bnbUsd);

  return (
    <section className="mt-8 border-t border-border pt-5" aria-labelledby="stake-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="stake-title" className="text-base font-normal">Staking <span className="text-muted">· simulated</span></h3>
        <span className="text-[12px] text-muted">7 days = {Math.round(STREAM_MS / 1000)}s</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Claimable</p>
          <p className="tabular-nums truncate text-[22px] leading-tight">{usd(claimable, claimable > 0 && claimable < 1 ? 4 : 2)}</p>
          <p className="tabular-nums mt-0.5 truncate text-[12px] text-muted">
            Staked {usd(sim.stake.weight)}{sim.stake.queued > 0 && sim.stake.weight === 0 ? ` · ${usd(sim.stake.queued)} waiting` : ""}{sim.stake.claimed > 0 ? ` · claimed ${usd(sim.stake.claimed)}` : ""}
          </p>
        </div>
        <button type="button" className={cn(cleanButton.solid, "shrink-0 px-5 disabled:hover:bg-black disabled:hover:text-white")} disabled={!canPay || claimable <= 0}
          onClick={() => bnbUsd && claimRewards(market, bnbUsd)}>Claim</button>
      </div>

      {cards.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No {market.name} cards yet</p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col">
            {[...staked, ...free].map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: RARITY_DOT[RARITIES[c.rarity]] }} aria-hidden="true" />
                  <span className="truncate"><span className="capitalize">{RARITIES[c.rarity]}</span> · {c.ticker} · <span className="tabular-nums">{usd(c.usd)}</span></span>
                </span>
                {c.stakedAt ? (
                  <button type="button" className={cn(rowButton, "border-black")} disabled={!canPay} onClick={() => bnbUsd && unstakeCards(market, [c], bnbUsd)} aria-label={`Unstake card ${c.id}`}>Unstake</button>
                ) : (
                  <button type="button" className={rowButton} disabled={!demo.active || c.usd <= 0} onClick={() => stakeCards(market, [c])} aria-label={`Stake card ${c.id}`}>Stake</button>
                )}
              </li>
            ))}
          </ul>
          {free.length > 1 && (
            <button type="button" className={cn(cleanButton.outline, "mt-3 w-full justify-center")} disabled={!demo.active} onClick={() => stakeCards(market, free)}>Stake all · {free.length}</button>
          )}
        </>
      )}
    </section>
  );
}

/** The simulated coin a card can be staked in (none for on-chain cards and coins). */
function useStakeCoin(card: OwnedCard) {
  const coin = useMarketCoins().find((c) => c.slug === card.coin);
  return !card.onchain && coin && !coin.config.onchain ? coin : null;
}

/** Collection: Stake / Unstake for one card. */
export function CardStakeButton({ card, className }: { card: OwnedCard; className?: string }) {
  const coin = useStakeCoin(card);
  const bnbUsd = useBnbUsd();
  if (card.redeemedAt || card.onchain) return null;
  // Classic cards have no coin, so no trading tax to stake for.
  if (card.coin === CLASSIC_SLUG || coin?.config.kind === "classic") return <span className={cn(rowButton, "w-full cursor-default border-dashed text-muted hover:border-border", className)}>Not stakeable</span>;
  if (!coin) return <span className={cn(rowButton, "w-full cursor-default border-dashed text-muted hover:border-border", className)}>Coin no longer listed</span>;
  return card.stakedAt ? (
    <button type="button" className={cn(rowButton, "w-full border-black", className)} disabled={!bnbUsd} onClick={() => bnbUsd && unstakeCards(coin, [card], bnbUsd)}>Unstake</button>
  ) : (
    <button type="button" className={cn(rowButton, "w-full", className)} disabled={card.usd <= 0} onClick={() => stakeCards(coin, [card])}>Stake</button>
  );
}
