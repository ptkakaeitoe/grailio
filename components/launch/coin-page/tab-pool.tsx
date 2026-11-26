"use client";

import { CheckIcon, LockSimpleIcon } from "@phosphor-icons/react/ssr";

import { sectionLabel } from "@/components/market-parts";

import { money } from "./tab-format";
import type { CoinPack } from "./types";

const PARTS = [
  { key: "pool", label: "Stock pool", tone: "bg-black" },
  { key: "stakers", label: "Card stakers", tone: "bg-black/60" },
  { key: "creator", label: "Creator", tone: "bg-black/35" },
  { key: "platform", label: "Platform", tone: "bg-black/15" },
] as const;

/** The coin's stock pool: its size, where the trading tax goes, and which pack risks it has opened. */
export function TabPool({ pack }: { pack: CoinPack }) {
  const rawTotal = PARTS.reduce((t, p) => t + pack.taxSplit[p.key], 0);
  const total = rawTotal || 100;
  return (
    <div className="grid grid-cols-1 gap-8 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desk:gap-12">
      <div>
        <p className={sectionLabel}>Stock pool</p>
        <p className="mt-1 text-[40px] leading-[1.15] tracking-tight tabular-nums">{pack.stockPoolUsd === null ? "—" : money(pack.stockPoolUsd)}</p>
        <p className="mt-2 text-sm text-muted">Pays pack prizes in stocks. Bigger prizes unlock as it grows.</p>

        <p className="mt-8 mb-3 text-sm text-muted">Trading tax</p>
        {rawTotal === 0 ? (
          <p className="text-sm text-muted">This coin has no trading tax. Its presale raise funds the pool.</p>
        ) : <>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={PARTS.map((p) => `${p.label} ${pack.taxSplit[p.key]}%`).join(", ")}>
          {PARTS.map((p) => (
            <span key={p.key} className={p.tone} style={{ width: `${(pack.taxSplit[p.key] / total) * 100}%` }} />
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 desk:grid-cols-4">
          {PARTS.map((p) => (
            <div key={p.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted"><span className={`size-2 rounded-full ${p.tone}`} aria-hidden="true" />{p.label}</dt>
              <dd className="mt-0.5 tabular-nums">{pack.taxSplit[p.key]}%</dd>
              {pack.taxCollectedUsd && <dd className="text-[13px] text-muted tabular-nums">{money(pack.taxCollectedUsd[p.key])}</dd>}
            </div>
          ))}
        </dl>
        </>}
      </div>

      <div>
        <p className={sectionLabel}>Pack risks</p>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {pack.tiers.map((t) => {
            const open = t.left === null || t.left > 0;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={open ? "grid size-6 place-items-center rounded-full bg-black text-white" : "grid size-6 place-items-center rounded-full border border-border text-muted"} aria-hidden="true">
                    {open ? <CheckIcon weight="bold" className="size-3.5" /> : <LockSimpleIcon weight="bold" className="size-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block">{t.name}</span>
                    {!open && t.lockedReason && <span className="block truncate text-[13px] text-muted">{t.lockedReason}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{t.left === null ? "Open" : t.left > 0 ? `${t.left} left` : "Locked"}</span>
              </li>
            );
          })}
          {pack.tiers.length === 0 && <li className="py-3 text-sm text-muted">Pack risks open after launch.</li>}
        </ul>
      </div>
    </div>
  );
}
