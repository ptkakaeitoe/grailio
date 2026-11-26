"use client";

import { ArrowUpRightIcon, LockSimpleIcon, MinusIcon, PlusIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";

import { cleanButton, cn, RARITY_DOT } from "@/components/clean-ui";
import { sectionLabel, sectionTitle } from "@/components/market-parts";
import { RARITY_NAMES } from "@/lib/contracts";
import { usd } from "@/lib/launch/format";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";

import type { CoinPack, CoinTier, RiskTier } from "./types";

/*
 * The coin pack page's right column, laid out like mainnet's pack panel: during the presale a presale card (progress,
 * what one pack gives, where the raise goes) and the buy row; after launch the Low / Medium / High tabs, the selected
 * tier's odds grid and the buy row. Reads only the CoinPack shape, so simulated, Four.meme and Flap coins look the same.
 */

const amount = (n: number, max = 4) => n.toLocaleString("en-US", { maximumFractionDigits: max });
const quoteText = (n: number, quote: string) => `${amount(n, n >= 100 ? 0 : 4)} ${quote}`;

/** Card rarity from a payout multiple (same cut-offs as the pack reveal). */
const rarityOf = (mult: number) => (mult >= 2 ? 3 : mult >= 1.2 ? 2 : mult >= 1 ? 1 : 0);

/** Ten equally likely outcomes → chance and average payout per rarity. */
function oddsOf(outcomes: number[]) {
  return RARITY_NAMES.map((_, r) => {
    const hits = outcomes.filter((m) => rarityOf(m) === r);
    return { chance: outcomes.length ? hits.length / outcomes.length : 0, avg: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : 0 };
  });
}

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [deadline]);
  if (!deadline || !now) return null;
  const left = Math.max(0, deadline - now);
  const d = Math.floor(left / 86_400_000), h = Math.floor((left % 86_400_000) / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return left === 0 ? "ended" : d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** Runs a pack action with a busy label and toasts the outcome. Returns false when it failed. */
function useRunner() {
  const [busy, setBusy] = useState<string | null>(null);
  async function run(label: string, fn: (() => Promise<void>) | undefined, success?: string) {
    if (!fn || busy) return false;
    setBusy(label);
    try {
      await fn();
      if (success) showToast({ kind: "success", title: success });
      return true;
    } catch (e) {
      showToast({ kind: "error", title: `${label} failed`, detail: txErrorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function Stepper({ value, max, onChange, disabled }: { value: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  const b = "grid size-11 place-items-center transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center rounded-md border border-border" role="group" aria-label="Quantity">
      <button type="button" className={b} aria-label="Fewer packs" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><MinusIcon weight="bold" className="size-4" /></button>
      <span className="w-8 text-center text-base tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={b} aria-label="More packs" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}><PlusIcon weight="bold" className="size-4" /></button>
    </div>
  );
}

/** Quantity, total and the primary button: shared by the presale and the live packs. */
function BuyRow({ pack, unitPrice, unitUsd, max, quantity, setQuantity, buyLabel, busy, disabled, onBuy }: {
  pack: CoinPack; unitPrice: number; unitUsd: number | null; max: number; quantity: number; setQuantity: (n: number) => void;
  buyLabel: string; busy: string | null; disabled: boolean; onBuy: () => void;
}) {
  const total = unitPrice * quantity;
  const short = pack.balance !== null && total > pack.balance + 1e-12;
  // A simulated coin with the demo off: the button starts the demo (actions.connect) instead of buying.
  const gate = pack.needsWallet || (pack.simulated && !pack.ready);
  const label = pack.needsWallet ? "Connect wallet" : gate ? "Try the demo" : busy ?? (short ? `Not enough ${pack.quote}` : buyLabel);
  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[28px] leading-none tracking-[-0.02em] tabular-nums">{quoteText(total, pack.quote)}</p>
          <p className="mt-1.5 text-sm text-muted tabular-nums">
            {unitUsd !== null && <>≈ {usd(unitUsd * quantity)}</>}
            {pack.balance !== null && <>{unitUsd !== null && " · "}Balance {quoteText(pack.balance, pack.quote)}</>}
          </p>
        </div>
        <Stepper value={quantity} max={Math.max(1, max)} onChange={setQuantity} disabled={pack.needsWallet || max < 1} />
      </div>
      <button
        type="button"
        className={cn(cleanButton.solid, "mt-4 w-full justify-between")}
        disabled={gate ? !pack.actions.connect : disabled || short || Boolean(busy) || max < 1}
        onClick={() => (gate ? pack.actions.connect?.() : onBuy())}
      >
        {label} <ArrowUpRightIcon weight="bold" className="arrow-nudge" aria-hidden="true" />
      </button>
    </div>
  );
}

/** A thin two-part bar with labels underneath. */
function SplitBar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        {parts.map((p) => <span key={p.label} className="h-full" style={{ width: `${(p.value / total) * 100}%`, background: p.tone }} />)}
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[13px] text-muted tabular-nums">
        {parts.map((p) => <span key={p.label}><span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: p.tone }} />{p.label} {usd(p.value, 0)}</span>)}
      </div>
    </div>
  );
}

function PresaleView({ pack }: { pack: CoinPack }) {
  const p = pack.presale;
  const [quantity, setQuantity] = useState(1);
  const { busy, run } = useRunner();
  const countdown = useCountdown(p.deadline);
  const left = Math.max(0, p.packsForSale - p.packsSold);
  const q = Math.min(quantity, Math.max(1, left));
  const pct = p.packsForSale ? (p.packsSold / p.packsForSale) * 100 : 0;
  const raised = p.packsSold * p.price, goal = p.packsForSale * p.price;
  const usdOf = (n: number) => (p.priceUsd !== null && p.price > 0 ? (n / p.price) * p.priceUsd : null);

  return (
    <>
      <div className="rounded-md border border-border p-4 phone:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base">{p.packsSold} / {p.packsForSale} packs sold</span>
          <span className="text-sm text-muted tabular-nums">{countdown ?? `${left} left`}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Presale packs sold" aria-valuemin={0} aria-valuemax={p.packsForSale} aria-valuenow={p.packsSold}>
          <div className="h-full rounded-full bg-black transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted tabular-nums">
          Raised {quoteText(raised, pack.quote)} of {quoteText(goal, pack.quote)}
          {usdOf(goal) !== null && <> · {usd(usdOf(raised)!, 0)} of {usd(usdOf(goal)!, 0)}</>}
        </p>

        <p className="mt-5 text-base">1 pack = {amount(p.coinsPerPack, 0)} {pack.ticker} + 1 presale card</p>
        <p className="mt-1 text-sm text-muted tabular-nums">{quoteText(p.price, pack.quote)} per pack{p.priceUsd !== null && <> · ≈ {usd(p.priceUsd)}</>}</p>
        {p.deadline && <p className="mt-1 text-sm text-muted">Refund if it doesn&apos;t sell out.</p>}

        {(p.toLiquidityUsd !== null || p.toPoolUsd !== null) && (
          <div className="mt-5">
            <p className="mb-2 text-[13px] text-muted">At launch the raise goes to</p>
            <SplitBar parts={[
              { label: "Liquidity", value: p.toLiquidityUsd ?? 0, tone: "var(--color-black, #f5f5f5)" },
              { label: "Stock pool", value: p.toPoolUsd ?? 0, tone: RARITY_DOT[3] },
            ]} />
          </div>
        )}
      </div>

      {p.mine > 0 && <p className="mt-4 text-sm text-muted tabular-nums">Your presale packs: <span className="text-black">{p.mine}</span></p>}

      <BuyRow
        pack={pack} unitPrice={p.price} unitUsd={p.priceUsd} max={left} quantity={q} setQuantity={setQuantity}
        buyLabel={q === 1 ? "Buy pack" : `Buy ${q} packs`} busy={busy} disabled={!pack.ready || !pack.actions.buyPresale || left < 1}
        onBuy={() => { void run("Buying", () => pack.actions.buyPresale!(q), q === 1 ? "Presale pack bought" : `${q} presale packs bought`).then((ok) => ok && setQuantity(1)); }}
      />
    </>
  );
}

function RefundView({ pack }: { pack: CoinPack }) {
  const { busy, run } = useRunner();
  const p = pack.presale;
  return (
    <div className="rounded-md border border-border p-4 phone:p-5">
      <p className="text-base">The presale didn&apos;t sell out ({p.packsSold} / {p.packsForSale}).</p>
      <p className="mt-1 text-sm text-muted">Every buyer gets their money back.</p>
      {p.mine > 0 ? (
        <button type="button" className={cn(cleanButton.solid, "mt-5 w-full justify-between")} disabled={Boolean(busy) || !pack.actions.refund}
          onClick={() => { void run("Refunding", pack.actions.refund, "Refunded"); }}>
          {busy ?? `Refund ${p.mine} ${p.mine === 1 ? "pack" : "packs"} · ${quoteText(p.mine * p.price, pack.quote)}`} <ArrowUpRightIcon weight="bold" className="arrow-nudge" aria-hidden="true" />
        </button>
      ) : <p className="mt-4 text-sm text-muted">You have no presale packs to refund.</p>}
    </div>
  );
}

function TierTabs({ tiers, value, onChange }: { tiers: CoinTier[]; value: RiskTier; onChange: (t: RiskTier) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Risk">
      {tiers.map((t) => {
        const locked = t.left === 0;
        return (
          <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)} title={locked ? t.lockedReason ?? "Sold out" : undefined}
            className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-black aria-pressed:border-black">
            <strong className="text-base font-normal">{t.name}</strong>
            <span className="flex items-center gap-1 truncate text-[13px] text-muted tabular-nums">
              {locked ? <><LockSimpleIcon className="size-3.5" aria-hidden="true" /> {t.lockedReason ? "Locked" : "Sold out"}</>
                : t.left === null ? <span aria-label="Unlimited">∞</span> : <>{t.left} left</>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OddsGrid({ tier, quote }: { tier: CoinTier; quote: string }) {
  const odds = oddsOf(tier.outcomes);
  return (
    <dl className="grid grid-cols-2 gap-1.5 phone:grid-cols-4" aria-label={`${tier.name} risk odds`}>
      {RARITY_NAMES.map((name, r) => (
        <div key={name} className={cn("flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-muted px-3 py-2.5", odds[r].chance === 0 && "opacity-40")}>
          <dt className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: RARITY_DOT[r] }} aria-hidden="true" />
            <span className="truncate">{name}</span>
          </dt>
          <dd className="text-base tabular-nums">{Math.round(odds[r].chance * 100)}%</dd>
          <dd className="truncate text-[13px] text-muted tabular-nums">
            {odds[r].chance === 0 ? "—" : tier.priceUsd !== null ? usd(odds[r].avg * tier.priceUsd) : `${amount(odds[r].avg * tier.price)} ${quote}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LiveView({ pack }: { pack: CoinPack }) {
  const firstOpen = pack.tiers.find((t) => t.left !== 0)?.id ?? 0;
  const [tierId, setTierId] = useState<RiskTier>(firstOpen);
  const [quantity, setQuantity] = useState(1);
  const { busy, run } = useRunner();
  const tier = pack.tiers.find((t) => t.id === tierId) ?? pack.tiers[0];
  const presaleLeft = pack.presale.mine;
  if (!tier) return <p className="text-sm text-muted">No packs yet.</p>;
  const max = tier.left === null ? 20 : tier.left;
  const q = Math.min(quantity, Math.max(1, max));

  return (
    <>
      {(presaleLeft > 0 || pack.actions.claimCoins) && (
        <div className="mb-6 flex flex-col gap-2">
          {presaleLeft > 0 && pack.actions.openPresale && (
            <button type="button" className={cn(cleanButton.solid, "w-full justify-between")} disabled={Boolean(busy)}
              onClick={() => { void run("Opening", pack.actions.openPresale); }}>
              {busy === "Opening" ? "Opening…" : `Open presale packs (${presaleLeft})`} <ArrowUpRightIcon weight="bold" className="arrow-nudge" aria-hidden="true" />
            </button>
          )}
          {pack.actions.claimCoins && (
            <button type="button" className={cn(cleanButton.outline, "w-full justify-between")} disabled={Boolean(busy)}
              onClick={() => { void run("Claiming", pack.actions.claimCoins, `${pack.ticker} claimed`); }}>
              {busy === "Claiming" ? "Claiming…" : `Claim your ${pack.ticker}`} <ArrowUpRightIcon weight="bold" className="arrow-nudge" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <TierTabs tiers={pack.tiers} value={tier.id} onChange={(t) => { setTierId(t); setQuantity(1); }} />
      {tier.left === 0 && tier.lockedReason && <p className="mt-2 text-sm text-muted">{tier.lockedReason}</p>}
      {tier.outcomes.length > 0 && <div className="mt-4"><OddsGrid tier={tier} quote={pack.quote} /></div>}

      {tier.unopened > 0 && pack.actions.openTier && (
        <button type="button" className={cn(cleanButton.outline, "mt-4 w-full justify-between")} disabled={Boolean(busy)}
          onClick={() => { void run("Opening", () => pack.actions.openTier!(tier.id)); }}>
          {busy === "Opening" ? "Opening…" : `Open packs (${tier.unopened})`} <ArrowUpRightIcon weight="bold" className="arrow-nudge" aria-hidden="true" />
        </button>
      )}

      <BuyRow
        pack={pack} unitPrice={tier.price} unitUsd={tier.priceUsd} max={max} quantity={q} setQuantity={setQuantity}
        buyLabel={q === 1 ? `Buy ${tier.name} pack` : `Buy ${q} packs`} busy={busy}
        disabled={!pack.ready || !pack.actions.buyTier || tier.left === 0}
        onBuy={() => { void run("Buying", () => pack.actions.buyTier!(tier.id, q), q === 1 ? `${tier.name} pack bought` : `${q} ${tier.name} packs bought`).then((ok) => ok && setQuantity(1)); }}
      />
    </>
  );
}

/** Right column of the coin pack page: presale, refund or live packs. */
/** The card you just opened: rarity, stock, what it holds. Dismissed with ×. */
function PullCard({ pack }: { pack: CoinPack }) {
  const p = pack.lastPull;
  if (!p) return null;
  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-md border border-border-strong p-4" role="status" aria-live="polite">
      <div className="min-w-0">
        <p className="text-[13px] text-muted">You pulled</p>
        <p className="mt-1 flex items-center gap-2 text-lg">
          <span className="size-2 rounded-full" style={{ background: RARITY_DOT[p.rarity] ?? RARITY_DOT[0] }} aria-hidden="true" />
          {RARITY_NAMES[p.rarity] ?? "Card"} · {p.ticker}
        </p>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {p.valueUsd !== null ? `Holds ${usd(p.valueUsd)}` : "Card minted"}{p.amount ? ` · ${p.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${p.ticker}` : ""} · {p.note}
        </p>
      </div>
      {pack.clearPull && <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:text-black" aria-label="Dismiss" onClick={pack.clearPull}><XIcon className="size-4" /></button>}
    </div>
  );
}

export function BuyPanel({ pack }: { pack: CoinPack }) {
  const title = pack.phase === "presale" ? "Presale" : pack.phase === "refund" ? "Refund" : "Packs";
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className={sectionTitle}>{title}</h2>
        <span className="flex items-center gap-2">
          {pack.simulated && <span className="rounded-[4px] bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">Simulated</span>}
          {pack.phase === "live" && pack.stockPoolUsd !== null && <span className={sectionLabel}>[ pool {usd(pack.stockPoolUsd, 0)} ]</span>}
        </span>
      </div>
      <PullCard pack={pack} />
      {pack.loading ? <p className="text-sm text-muted" role="status">Loading…</p>
        : pack.error ? <p className="text-sm text-down" role="alert">{pack.error}</p>
        : pack.phase === "presale" ? <PresaleView pack={pack} />
        : pack.phase === "refund" ? <RefundView pack={pack} />
        : <LiveView pack={pack} />}
    </section>
  );
}
