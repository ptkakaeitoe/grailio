"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRightIcon, CheckIcon } from "@phosphor-icons/react/ssr";

import { cleanButton, cn } from "@/components/clean-ui";
import { CoinAvatar, TickerBadge } from "@/components/launch/coin-avatar";
import { CoinLoop } from "./coin-loop";
import { coverStyle } from "@/components/launch/launch-design";
import { SealedPack } from "@/components/launch/pack-shop";
import { StockLogo } from "@/components/launch/stock-logo";
import { sectionLabel } from "@/components/market-parts";
import { TokenIcon } from "@/components/token-icon";
import { packSizeOf } from "@/lib/launch/demo-launch";

import type { CoinPack } from "./types";

/*
 * The top of the coin pack page, in mainnet's pack-page style: the coin itself (the backbone token: name, ticker,
 * launchpad, phase, contract and its market numbers), the three-step launch strip, and the left column with the
 * pack art and the stocks it draws from.
 */

const fmtUsd = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return "—";
  if (n > 0 && n < 0.01) return `$${n.toPrecision(3)}`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};
const badge = "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 text-[13px]";
const PHASE_LABEL = { presale: "Presale", live: "Live", refund: "Refunds open" } as const;

export function CoinHeader({ pack }: { pack: CoinPack }) {
  const { coin } = pack;
  const stats: [string, string][] = [
    ["Price", fmtUsd(pack.priceUsd)],
    ["Mcap", fmtUsd(pack.mcapUsd)],
    ["Liquidity", fmtUsd(pack.liquidityUsd)],
    ["Stock pool", fmtUsd(pack.stockPoolUsd)],
  ];
  return (
    <header>
      {/* The route page above already has the "All packs" link. */}
      <div className="flex flex-col gap-6 desk:flex-row desk:items-end desk:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[clamp(28px,4vw,40px)] leading-[1.1] font-light tracking-[-0.03em]">{coin.name}</p>
              <TickerBadge ticker={pack.ticker} tone={coin.tone} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {pack.launchpad ? (
                <span className={badge}>
                  <TokenIcon symbol={pack.launchpad === "Flap" ? "FLAP" : "FOUR"} className="size-4" /> {pack.launchpad}
                </span>
              ) : null}
              {pack.simulated && <span className={cn(badge, "text-muted")}>Simulated</span>}
              <span className={cn(badge, pack.phase === "live" ? "border-up/40 text-up" : pack.phase === "refund" ? "border-down/40 text-down" : "")}>
                <span className={cn("size-1.5 rounded-full", pack.phase === "live" ? "bg-up" : pack.phase === "refund" ? "bg-down" : "bg-black")} aria-hidden="true" />
                {PHASE_LABEL[pack.phase]}
              </span>
              {pack.explorerUrl && (
                <a href={pack.explorerUrl} target="_blank" rel="noreferrer" className={cn(badge, "text-muted transition-colors hover:border-black hover:text-black")}>
                  {pack.tokenAddress ? `${pack.tokenAddress.slice(0, 6)}…${pack.tokenAddress.slice(-4)}` : "Contract"} <ArrowUpRightIcon weight="bold" className="size-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
        <Link href={`/trade/token/${coin.slug}`} className={cn(cleanButton.outline, "shrink-0 justify-between gap-3 lowercase")}>
          trade {pack.ticker} <ArrowUpRightIcon weight="bold" aria-hidden="true" />
        </Link>
      </div>
      <dl className="mt-6 grid grid-cols-2 border-y border-border desk:grid-cols-4">
        {stats.map(([label, value], i) => (
          <div key={label} className={cn("min-w-0 py-3 desk:px-5", i % 2 === 1 && "max-desk:pl-5 border-l border-border", i >= 2 && "max-desk:border-t border-border", i > 0 && "desk:border-l", i === 0 && "desk:pl-0")}>
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="mt-0.5 truncate text-[20px] leading-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {pack.error && <p className="mt-3 text-sm text-down" role="alert">{pack.error}</p>}
    </header>
  );
}

/** ① Presale → ② Launch → ③ Packs open. */
export function PhaseSteps({ pack }: { pack: CoinPack }) {
  const p = pack.presale;
  const launched = pack.phase === "live";
  const refund = pack.phase === "refund";
  const steps = [
    { title: "Presale", note: refund ? "Didn't sell out · refunds open" : `${p.packsSold} / ${p.packsForSale} packs sold`, done: launched, current: pack.phase === "presale" || refund },
    { title: "Launch", note: launched ? "Liquidity and pool funded" : "When the last pack sells", done: launched, current: false },
    { title: "Packs open", note: launched ? "Medium and High unlock as the pool grows" : "Low first, then Medium and High", done: false, current: launched },
  ];
  return (
    <ol className="mt-6 grid list-none grid-cols-3 gap-1.5 p-0" aria-label="Launch steps">
      {steps.map((s, i) => (
        <li
          key={s.title}
          aria-current={s.current ? "step" : undefined}
          className={cn(
            "flex min-w-0 items-start gap-2 rounded-md border p-2.5 phone:gap-3 phone:p-3",
            s.current ? (refund && i === 0 ? "border-down/50" : "border-black") : "border-border",
            !s.current && !s.done && "text-muted",
          )}
        >
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[12px] tabular-nums", s.done ? "border-black bg-black text-white" : s.current ? "border-black" : "border-border")}>
            {s.done ? <CheckIcon weight="bold" className="size-3.5" aria-label="done" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{s.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted tabular-nums max-phone:hidden">{s.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Left column: the coin's sealed pack (tilts with the mouse), the stocks it draws from and the coin → pool → packs loop. */
/** The price printed on the pack: the presale price while in presale, else the Low tier's, in the quote token. */
function packPriceLabel(pack: CoinPack): string | undefined {
  const price = pack.phase === "presale" ? pack.presale.price : pack.tiers[0]?.price;
  if (!price) return undefined;
  if (pack.quote === "USD") return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { maximumFractionDigits: 4 }) + " " + pack.quote.toUpperCase();
}

export function PackColumn({ pack }: { pack: CoinPack }) {
  const { coin } = pack;
  const size = packSizeOf(coin);
  const color = coin.packs.find((p) => p.size === size.id)?.color;
  const custom = coin.config.design === "custom";
  const ref = useRef<HTMLDivElement>(null);
  function tiltTo(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const b = el.getBoundingClientRect();
    el.style.setProperty("--px", String((e.clientX - b.left) / b.width));
    el.style.setProperty("--py", String((e.clientY - b.top) / b.height));
    el.dataset.active = "";
  }
  function untilt() {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--px");
    el.style.removeProperty("--py");
    delete el.dataset.active;
  }
  return (
    <div className="min-w-0">
      <div className="grid place-items-center rounded-md bg-surface-muted/40 px-6 py-10 desk:py-14">
        <div ref={ref} onPointerMove={tiltTo} onPointerLeave={untilt} className="pack-tilt relative w-[min(260px,62vw)]">
          <SealedPack size={size} coin={coin.name} color={color} priceLabel={packPriceLabel(pack)} style={custom ? coverStyle(coin.config.tone, coin.config.pattern, coin.config.cover) : undefined} />
          <span className="holo-glare rounded-[4px]" aria-hidden="true" />
        </div>
      </div>
      {pack.basket.length > 0 && (
        <div className="mt-6">
          <p className={cn(sectionLabel, "text-sm")}>Draws from</p>
          <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0" aria-label="Stocks in the pool">
            {pack.basket.map((b) => (
              <li key={b.ticker} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm">
                <StockLogo ticker={b.ticker} size={16} />
                {b.ticker}
                <span className="text-muted tabular-nums">{b.weight}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6">
        <CoinLoop pack={pack} />
      </div>
    </div>
  );
}
