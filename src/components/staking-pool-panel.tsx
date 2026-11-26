"use client";

import Link from "next/link";
import { useState } from "react";
import { cleanButton, cn } from "@/components/clean-ui";
import { CardStakeButton, useBnbUsd, useNow } from "@/components/stake-panel";
import { StockCardFront } from "@/components/stock-card-front";
import { useCardArt } from "@/lib/design";
import { useCollection, type OwnedCard } from "@/lib/collection";
import { useDemo } from "@/lib/demo";
import { STREAM_DAYS, STREAM_MS, claimRewards, simOf, stakeStats, useDemoLaunches } from "@/lib/demo-launch";
import { useMarketCoins } from "@/lib/published-packs";
import { usd } from "@/lib/format";
import { RARITIES } from "@/lib/pack";
import type { MarketCoin } from "@/lib/market";

/*
 * Collection staking (demo): one panel for every simulated coin you hold cards in. Each coin's vault streams its
 * stakers' tax share linearly over 7 days (STREAM_MS here), split by card value; you are the only staker in the demo.
 */

const money = (n: number) => usd(n, n > 0 && n < 1 ? 4 : 2);
const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: n < 0.01 ? 2 : 1 })}%`;

type CoinRow = { coin: MarketCoin; cards: number; staked: number; myWeight: number; stakedCards: OwnedCard[]; stats: ReturnType<typeof stakeStats> };

/** Collection: the combined staking panel, fed from the demo staking store. */
export function CollectionStaking() {
  const demo = useDemo();
  const all = useDemoLaunches();
  const coins = useMarketCoins();
  const cards = useCollection();
  const bnbUsd = useBnbUsd();
  const [on, setOn] = useState(false);
  const now = useNow(on);

  const rows: CoinRow[] = coins
    .filter((c) => !c.config.onchain && c.config.kind !== "classic")
    .map((coin) => {
      const held = cards.filter((c) => c.coin === coin.slug && !c.redeemedAt && !c.onchain);
      const staked = held.filter((c) => c.stakedAt);
      return { coin, cards: held.length, staked: staked.length, myWeight: staked.reduce((t, c) => t + c.usd, 0), stakedCards: staked, stats: stakeStats(simOf(all, coin), now) };
    })
    .filter((r) => r.cards > 0 || r.stats.totalWeight > 0 || r.stats.claimable > 0);

  const streaming = rows.some((r) => r.stats.streaming > 0);
  if (streaming !== on) setOn(streaming);
  if (!demo.active) return null;
  if (rows.length === 0) {
    return (
      <section aria-label="Staking" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
        <p className="text-sm"><span>Staking</span> <span className="text-muted">· no stakeable cards yet</span></p>
        <Link href="/app/packs" className={cn(cleanButton.small, "min-h-9")}>Open a pack</Link>
      </section>
    );
  }

  return (
    <StakingPoolPanel
      rows={rows}
      claim={{
        disabled: !bnbUsd || rows.every((r) => r.stats.claimable <= 0),
        onClick: () => bnbUsd && rows.forEach((r) => r.stats.claimable > 0 && claimRewards(r.coin, bnbUsd)),
      }}
    />
  );
}

/**
 * Compact staking strip: what you can claim (and Claim), four headline numbers, then each staked card with what it
 * earns per simulated day and Unstake.
 */
export function StakingPoolPanel({ rows, claim }: { rows: CoinRow[]; claim: { onClick: () => void; disabled: boolean } }) {
  const cardArt = useCardArt();
  const sum = (f: (r: CoinRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  const claimable = sum((r) => r.stats.claimable);
  const pool = sum((r) => r.stats.streaming + r.stats.queued);
  const perDay = sum((r) => r.stats.perDay);
  const totalWeight = sum((r) => r.stats.totalWeight);
  const myWeight = sum((r) => r.myWeight);
  const share = totalWeight > 0 ? Math.min(1, myWeight / totalWeight) : 0;
  // Each staked card earns its coin's payout in proportion to its value.
  const staked = rows.flatMap((r) => r.stakedCards.map((card) => ({
    card,
    coin: r.coin,
    earns: r.stats.totalWeight > 0 ? (r.stats.perDay * card.usd) / r.stats.totalWeight : 0,
  })));

  const stats = [
    { label: "Pool", value: money(pool) },
    { label: "Pays out", value: `${money(perDay)}/day` },
    { label: "Your share", value: myWeight > 0 ? pct(share) : "—" },
    { label: "You earn", value: myWeight > 0 ? `${money(perDay * share)}/day` : "—" },
  ];

  return (
    <section className="mb-8 rounded-md border border-border" aria-labelledby="staking-title">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="min-w-0">
          <h2 id="staking-title" className="text-sm text-muted">Staking · {STREAM_DAYS} days = {Math.round(STREAM_MS / 1000)}s</h2>
          <p className="num text-[22px] leading-tight">{money(claimable)} <span className="text-sm text-muted">claimable</span></p>
        </div>
        <dl className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-1">
          {stats.map((st) => (
            <div key={st.label} className="min-w-0">
              <dt className="text-[12px] text-muted">{st.label}</dt>
              <dd className="num text-sm">{st.value}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className={cn(cleanButton.solid, "min-h-10 shrink-0 px-5 disabled:hover:bg-black disabled:hover:text-white")} disabled={claim.disabled} onClick={claim.onClick}>
          Claim
        </button>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="mb-2 text-[13px] text-muted">{staked.length > 0 ? `Staked cards · ${staked.length}` : "No cards staked. Stake a card below to earn its coin's trading tax."}</p>
        {staked.length > 0 && (
          <ul className="flex gap-2.5 overflow-x-auto pb-1">
            {staked.map(({ card, coin, earns }) => (
              <li key={card.id} className="flex w-[220px] shrink-0 items-center gap-2.5 rounded-md border border-border p-2">
                <span className="relative block w-10 shrink-0 overflow-hidden rounded-[3px]">
                  <StockCardFront art={cardArt(card)} rarity={card.rarity} brand={card.coinName} decorative sizes="40px" className="w-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">#{card.id} · {card.ticker}</span>
                  <span className="block truncate text-[12px] capitalize text-muted">{RARITIES[card.rarity]} · {coin.name}</span>
                  <span className="num block truncate text-[12px]">{money(card.usd)} · <span className="text-up">{money(earns)}/day</span></span>
                </span>
                <CardStakeButton card={card} className="!min-h-8 !w-auto shrink-0 px-2.5 text-[12px]" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
