"use client";

import Link from "next/link";
import { useState } from "react";
import { cleanButton, cn } from "@/components/clean-ui";
import { useBnbUsd, useNow } from "@/components/stake-panel";
import { useCollection } from "@/lib/collection";
import { useDemo } from "@/lib/demo";
import { STREAM_DAYS, STREAM_MS, claimRewards, simOf, stakeStats, useDemoLaunches } from "@/lib/demo-launch";
import { useMarketCoins } from "@/lib/published-packs";
import { usd } from "@/lib/format";
import type { MarketCoin } from "@/lib/market";

/*
 * Collection staking (demo): one panel for every simulated coin you hold cards in. Each coin's vault streams its
 * stakers' tax share linearly over 7 days (STREAM_MS here), split by card value; you are the only staker in the demo.
 */

const money = (n: number) => usd(n, n > 0 && n < 1 ? 4 : 2);
const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: n < 0.01 ? 2 : 1 })}%`;

type CoinRow = { coin: MarketCoin; cards: number; staked: number; myWeight: number; stats: ReturnType<typeof stakeStats> };

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
      return { coin, cards: held.length, staked: staked.length, myWeight: staked.reduce((t, c) => t + c.usd, 0), stats: stakeStats(simOf(all, coin), now) };
    })
    .filter((r) => r.cards > 0 || r.stats.totalWeight > 0 || r.stats.claimable > 0);

  const streaming = rows.some((r) => r.stats.streaming > 0);
  if (streaming !== on) setOn(streaming);
  if (!demo.active) return null;
  if (rows.length === 0) {
    return (
      <section aria-label="Staking" className="mb-6 rounded-md border border-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-normal">Staking · simulated</h2>
          <span className="text-[13px] text-muted">7 days = 60s</span>
        </div>
        <p className="mt-2 text-sm text-muted">No stakeable cards yet</p>
        <Link href="/app/packs" className={cn(cleanButton.outline, "mt-4 w-full justify-center")}>Open a pack</Link>
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
 * The pool waiting to pay stakers, its payout per simulated day, your share by card value and a 7-day projection
 * of the pool with no new tax, then your claimable rewards and Claim.
 */
export function StakingPoolPanel({ rows, claim }: { rows: CoinRow[]; claim: { onClick: () => void; disabled: boolean } }) {
  const sum = (f: (r: CoinRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  const claimable = sum((r) => r.stats.claimable);
  const pool = sum((r) => r.stats.streaming);
  const waiting = sum((r) => r.stats.queued);
  const perDay = sum((r) => r.stats.perDay);
  const totalWeight = sum((r) => r.stats.totalWeight);
  const myWeight = sum((r) => r.myWeight);
  const stakedCount = sum((r) => r.staked);
  const share = totalWeight > 0 ? Math.min(1, myWeight / totalWeight) : 0;

  const stats = [
    { label: "Pool", value: money(pool + waiting), note: waiting > 0 ? `${money(waiting)} waiting` : undefined },
    { label: "Pays out", value: `${money(perDay)}/day` },
    { label: "Your share", value: myWeight > 0 ? pct(share) : "—", note: myWeight > 0 ? `${money(myWeight)} of ${money(totalWeight)}` : "Stake a card" },
    { label: "You earn", value: myWeight > 0 ? `${money(perDay * share)}/day` : "—" },
  ];

  return (
    <section className="mb-8 rounded-md border border-border p-3 phone:p-4" aria-labelledby="staking-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="staking-title" className="text-base font-normal">Staking <span className="text-muted">· simulated</span></h2>
        <span className="text-[12px] text-muted">{STREAM_DAYS} days = {Math.round(STREAM_MS / 1000)}s</span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">Claimable{stakedCount > 0 && ` · ${stakedCount} staked`}</p>
          <p className="num truncate text-[22px] leading-tight tracking-[-0.01em]">{money(claimable)}</p>
        </div>
        <button type="button" className={cn(cleanButton.solid, "min-h-11 shrink-0 px-5 disabled:hover:bg-black disabled:hover:text-white")} disabled={claim.disabled} onClick={claim.onClick}>
          Claim
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 desk:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[13px] text-muted">{s.label}</dt>
            <dd className="num truncate">{s.value}</dd>
            {s.note && <dd className="truncate text-[12px] text-muted">{s.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-border">
        <p className="flex min-h-11 items-center text-[13px] text-muted">Per coin · next {STREAM_DAYS} days</p>
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.coin.slug} className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{r.coin.name}</p>
                <p className="num truncate text-[12px] text-muted">
                  {r.staked}/{r.cards} staked · {money(r.myWeight)}{r.stats.perDay > 0 ? ` · ${money(r.stats.perDay)}/day` : ""}
                </p>
              </div>
              <span className="num shrink-0 text-sm">{money(r.stats.claimable)}</span>
            </li>
          ))}
        </ul>
        <PoolChart rows={rows} share={share} />
      </div>
    </section>
  );
}

/** What each coin's stream has left after `d` simulated days, with no new tax: linear down to zero at its end. */
const leftAt = (rows: CoinRow[], d: number) => rows.reduce((t, r) => t + Math.max(0, r.stats.streaming - r.stats.perDay * d), 0);

/** The pool left over the next 7 simulated days with no new tax (linear stream), hoverable by day. */
function PoolChart({ rows, share }: { rows: CoinRow[]; share: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const pool = leftAt(rows, 0);
  const DAYS = STREAM_DAYS, STEPS = 70;
  const W = 600, H = 120, T = 8, B = 20;
  const x = (d: number) => (d / DAYS) * W;
  const y = (v: number) => T + (1 - (pool > 0 ? v / pool : 0)) * (H - T - B);
  const line = Array.from({ length: STEPS + 1 }, (_, i) => {
    const d = (i / STEPS) * DAYS;
    return `${i ? "L" : "M"}${x(d).toFixed(1)},${y(leftAt(rows, d)).toFixed(1)}`;
  }).join("");
  const area = `${line}L${x(DAYS)},${H - B}L${x(0)},${H - B}Z`;
  const left = hover === null ? pool : leftAt(rows, hover);
  const paid = pool - left;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(DAYS, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * DAYS))));
  }

  if (pool <= 0) return <p className="py-3 text-[13px] text-muted">Nothing streaming</p>;

  return (
    <figure className="mt-3 pb-1">
      <figcaption className="num text-[13px]" aria-live="polite">
        {hover === null
          ? `Pool ${money(pool)} · no new tax`
          : `Day ${hover} · ${money(left)} left · ${money(paid)} paid${share > 0 ? ` · you ${money(paid * share)}` : ""}`}
      </figcaption>
      <div className="relative mt-2 h-[120px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 block size-full touch-none"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${money(pool)} streams out linearly over the next ${DAYS} simulated days with no new tax.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <line key={d} x1={x(d)} x2={x(d)} y1={T} y2={H - B} stroke="var(--hair)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={area} fill="var(--ink)" fillOpacity={0.08} />
          <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
          <span key={d} aria-hidden="true" className={cn("pointer-events-none absolute bottom-0 text-[11px] leading-none text-muted tabular-nums", d > 0 && d < DAYS && "-translate-x-1/2", d === DAYS && "-translate-x-full")} style={{ left: `${(x(d) / W) * 100}%` }}>
            {d === 0 ? "now" : `${d}d`}
          </span>
        ))}
        {hover !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(left) / H) * 100}%` }}
          />
        )}
      </div>
    </figure>
  );
}
