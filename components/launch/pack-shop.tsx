"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRightIcon, LockIcon, MinusIcon, PlusIcon, XIcon } from "@phosphor-icons/react/ssr";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { coverStyle, designedCard } from "@/components/launch/launch-design";
import { StakePanel } from "@/components/launch/stake-panel";
import { CoinPackLink } from "@/components/launch/coin-link";
import { SET_FOR_SIZE, cardArt } from "@/lib/launch/cards";
import { addCard } from "@/lib/launch/collection";
import { startDemo, useDemo } from "@/lib/launch/demo";
import {
  BUYERS_SUPPLY, SEED_SHARE, TABLES, launchMcap, presaleMcap, TAX_SPLIT, TIERS, buyPresale, buyTier, canBuyTier, openBought, openPresale, otherBuysPresale,
  packSizeOf, poolNeeded, presalePacksOf, simulateTax, topMult, useLaunchSim, type LaunchSim, type Opened, type Tier,
} from "@/lib/launch/demo-launch";
import { stockOf } from "@/lib/launch/stocks";
import { RARITIES, type PackSize } from "@/lib/launch/pack";
import { amount, usd } from "@/lib/launch/format";
import { cleanButton, cleanDialog, cn, dialogClose, dialogHeader } from "@/components/clean-ui";
import type { MarketCoin, PackColor } from "@/lib/launch/market";
import { EmblemGlyph } from "@/components/launch/coin-avatar";
import { coinArt } from "@/lib/launch/coin-art";

/*
 * One coin's pack page in demo mode (/packs/[coin]), simulating the pack launch model end to end (lib/demo-launch):
 * presale progress and presale packs, then the launched coin's Low / Medium / High packs, the stock pool, the
 * trading-tax split and card staking. Paid from the demo wallet. Mobile first: the buy bar sticks above the tab bar.
 */

/** Flat pack colors per size (the stonks pack palette). */
const PALETTE: Record<string, { bg: string; ink: string; halo: string }> = {
  starter: { bg: "#ec746e", ink: "#000000", halo: "#ec746e55" },
  standard: { bg: "#202020", ink: "#74fc84", halo: "#74fc8444" },
  grail: { bg: "#8f1a12", ink: "#f6d4cf", halo: "#8f1a1255" },
};
export const SUBTITLE: Record<string, string> = { starter: "Your first pull", standard: "The everyday pack", grail: "For the chase" };

/** Used only if the BNB price feed can't be reached, so the demo still works. */
const FALLBACK_BNB_USD = 600;
const solid = cn(cleanButton.solid, "px-5 disabled:hover:bg-black disabled:hover:text-white");
const outline = cn(cleanButton.outline, "px-5");
const stepperButton = "grid size-11 place-items-center disabled:cursor-default disabled:opacity-30";
const seal = "h-[15px] bg-[repeating-linear-gradient(90deg,transparent_0_3px,currentColor_3px_4px)] opacity-20";
const statLabel = "text-[13px] text-muted";
const statValue = "tabular-nums mt-0.5 block truncate text-base";
const pctOf = (v: number) => `${Math.round(v * 100)}%`;
const sticky = "mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 max-desk:sticky max-desk:bottom-[calc(0px+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[18px] max-desk:bg-white max-desk:px-[18px] max-desk:py-3";

export function SealedPack({ size, coin, color, className, style, priceLabel }: { size: PackSize; coin: string; color?: PackColor; className?: string; style?: CSSProperties; /** e.g. "0.005 TBNB"; defaults to the configured USD price. */ priceLabel?: string }) {
  const p = color ?? PALETTE[size.id] ?? PALETTE.standard;
  const shape = size.id === "grail" ? "rounded-[45%_45%_6px_6px]" : "rounded-full";
  return (
    <div className={cn("relative flex flex-col rounded-[4px] shadow-[0_18px_30px_-18px_#000a]", !className?.includes("h-full") && "aspect-[5/7]", className)} style={{ background: p.bg, color: p.ink, ...style }}>
      <div className={seal} />
      <div className="flex flex-1 flex-col items-center justify-between px-5 pt-5 pb-4">
        <span className="max-w-full truncate text-[13px] tracking-[0.12em] uppercase">{coin}</span>
        <span className="mt-[9px] text-[7px] tracking-[0.14em] opacity-75">STOCK PACK · {priceLabel ?? usd(size.price, 0)}</span>
        <div className={cn("relative my-4 grid size-[84px] place-items-center border border-current before:absolute before:inset-[5px] before:rounded-[inherit] before:border before:border-current before:opacity-40 [&_svg]:size-[44%]", shape)}>
          <svg viewBox="0 0 100 100" aria-hidden="true"><EmblemGlyph emblem={coinArt(coin).emblem} tilt={coinArt(coin).tilt} /></svg>
        </div>
        <span className="text-[28px] leading-none tracking-[-0.02em]">{size.name}</span>
        <span className="mt-1.5 text-[10px] opacity-80">{SUBTITLE[size.id] ?? ""}</span>
        <div className="mt-4 flex w-full justify-between gap-2 border-t border-current/35 pt-3 text-[6px] opacity-75">
          <span>SEALED / STOCK PACK</span>
          <span>BSC TESTNET</span>
        </div>
      </div>
      <div className={seal} />
    </div>
  );
}

/** Native <dialog> shell: centred, blurred backdrop, closes on Escape or a click outside. */
function Dialog({ title, onClose, className, children }: { title: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const prev = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => { el?.close(); document.body.style.overflow = prev; };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={cn(cleanDialog, className)}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) onClose();
      }}
    >
      <header className={dialogHeader}>
        <span className="min-w-0 truncate text-sm text-muted">[ {title} ]</span>
        <button type="button" className={cn(dialogClose, "size-11")} onClick={onClose} aria-label="Close"><XIcon weight="bold" className="size-[18px]" /></button>
      </header>
      {children}
    </dialog>
  );
}

/** Ten equally likely outcomes per tier, grouped. Presale packs: their share of the presale reserve × the Medium spread / 0.9. */
function OddsDialog({ price, onClose }: { price: number; onClose: () => void }) {
  const rows = (t: number[]) => [...new Set(t)].map((m) => ({ m, odds: t.filter((x) => x === m).length / t.length }));
  return (
    <Dialog title="Odds · simulated" onClose={onClose} className="w-[min(520px,calc(100%-24px))]">
      <div className="flex flex-col gap-5 p-5 phone:p-6">
        {TIERS.map((t) => (
          <section key={t.id}>
            <h3 className="mb-1 flex justify-between text-base font-normal"><span>{t.name}</span><span className="tabular-nums text-sm text-muted">avg {pctOf(TABLES[t.id].reduce((a, b) => a + b, 0) / 10)}</span></h3>
            <table className="tabular-nums w-full text-sm">
              <tbody>
                {rows(TABLES[t.id]).map((r) => (
                  <tr key={r.m}><td className="border-b border-border py-2">{pctOf(r.m)}</td><td className="border-b border-border py-2 text-muted">{pctOf(r.odds)}</td><td className="border-b border-border py-2 text-right">{usd(price * r.m)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <p className="text-sm text-muted">Presale packs: share of the presale prizes × {TABLES[1].map((m) => Math.round((m / 0.9) * 100) / 100).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</p>
      </div>
    </Dialog>
  );
}

type Pull = { rarity: number; value: number; ticker: string; note: string };

/** Picks a basket stock by weight. */
function drawStock(basket: { ticker: string; weight: number }[]) {
  let roll = Math.random() * basket.reduce((s, b) => s + b.weight, 0);
  return (basket.find((b) => (roll -= b.weight) < 0) ?? basket[0])?.ticker ?? "";
}

/** Card rarity from the roll (a multiple of the price, or of the presale share). */
const rarityOf = (mult: number) => (mult >= 2 ? 3 : mult >= 1.2 ? 2 : mult >= 1 ? 1 : 0);

function RevealDialog({ title, count, size, market, onOpen, onClose }: { title: string; count: number; size: PackSize; market: MarketCoin; onOpen: () => Pull | null; onClose: () => void }) {
  const [left, setLeft] = useState(count);
  const [phase, setPhase] = useState<"ready" | "opening" | "revealed">("ready");
  const [pull, setPull] = useState<Pull | null>(null);
  const color = market.packs.find((p) => p.size === size.id)?.color;
  const custom = market.config.design === "custom";
  const halo = color ? `${color.bg}55` : (PALETTE[size.id] ?? PALETTE.standard).halo;

  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("revealed"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100);
    return () => clearTimeout(t);
  }, [phase]);

  function open() {
    if (left < 1) return;
    const next = onOpen();
    if (!next) { setLeft(0); return; }
    setPull(next);
    setLeft((n) => n - 1);
    setPhase("opening");
  }

  const art = pull && (custom ? designedCard(market.config.cards[pull.rarity], pull.rarity, pull.ticker, size.id) : cardArt(pull.ticker, pull.rarity, SET_FOR_SIZE[size.id] ?? "fable"));
  return (
    <Dialog title={`${title} · simulated`} onClose={onClose} className="w-[min(440px,calc(100%-32px))]">
      <div className="relative isolate grid min-h-[220px] place-items-center overflow-hidden bg-surface-muted py-4 phone:min-h-[260px] phone:py-5" aria-hidden="true">
        {phase === "revealed" && pull && art ? (
          <div className="w-[140px] animate-[card-unveil_.65s_ease-out_both] phone:w-[160px]">
            <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px] shadow-[0_12px_24px_-12px_rgba(0,0,0,.4)]">
              <StockCardFront art={art} rarity={pull.rarity} brand={market.name} decorative sizes="160px" className="w-full" />
              <Holo rarity={pull.rarity} />
              <span className="holo-glare" aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div className={cn("w-[190px] [zoom:0.62] phone:[zoom:0.72]", phase === "opening" && "animate-[pack-shake_.18s_ease-in-out_5_alternate,pack-fade_.3s_.9s_forwards]")}>
            <SealedPack size={size} coin={market.name} color={color} style={custom ? coverStyle(market.config.tone, market.config.pattern, market.config.cover) : undefined} />
          </div>
        )}
        <span className="absolute -z-10 size-[220px] rounded-full" style={{ background: `radial-gradient(circle, ${halo}, transparent 70%)` }} />
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] phone:p-5">
        <div role="status" aria-live="polite">
          <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">
            {phase === "ready" ? `${left} ${left === 1 ? "pack" : "packs"} ready` : phase === "opening" ? "Opening…" : <span className="capitalize">{RARITIES[pull!.rarity]}</span>}
          </h2>
          {phase === "revealed" && pull && <p className="tabular-nums mt-1 text-sm text-muted">Holds {usd(pull.value)} of {pull.ticker || "stocks"} · {pull.note}</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {phase !== "opening" && (
            <button type="button" className={cn(solid, "w-full justify-between")} disabled={left < 1} onClick={open}>
              {phase === "ready" ? "Open pack" : left > 0 ? `Open another · ${left} left` : "No packs left"} <ArrowUpRightIcon weight="bold" className="size-4" />
            </button>
          )}
          {phase === "revealed" && <Link href="/collection" className={cn(outline, "w-full justify-between")} onClick={onClose}>View collection <ArrowUpRightIcon weight="bold" className="size-4" /></Link>}
        </div>
      </div>
    </Dialog>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-11 shrink-0 items-center rounded-md border border-border">
      <button type="button" className={stepperButton} aria-label="Fewer packs" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><MinusIcon weight="bold" className="size-4" /></button>
      <span className="tabular-nums w-[30px] text-center text-base" aria-label="Pack quantity">{value}</span>
      <button type="button" className={stepperButton} aria-label="More packs" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><PlusIcon weight="bold" className="size-4" /></button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className={statLabel}>{label}</dt><dd className={statValue}>{value}</dd></div>;
}

/** Price in BNB and USD, the quantity stepper and the action; sticks above the tab bar on phones. */
function BuyBar({ totalUsd, bnbUsd, quantity, max, setQuantity, label, disabled, onBuy }: {
  totalUsd: number; bnbUsd: number | null; quantity: number; max: number; setQuantity: (n: number) => void; label: string; disabled: boolean; onBuy: () => void;
}) {
  const demo = useDemo();
  return (
    <div className={sticky}>
      <div className="min-w-0">
        <strong className="tabular-nums block truncate text-[20px] leading-none font-normal tracking-[-0.02em] phone:text-[26px]">{bnbUsd ? amount(totalUsd / bnbUsd, 4) : "…"}</strong>
        <p className="tabular-nums mt-1.5 truncate text-[13px] text-muted">BNB · ≈ {usd(totalUsd, 0)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {demo.active && <Stepper value={quantity} max={Math.max(1, max)} onChange={setQuantity} />}
        {demo.active ? (
          <button type="button" className={cn(solid, "shrink-0 gap-2 px-4")} disabled={disabled} onClick={onBuy}>{label}</button>
        ) : (
          <button type="button" className={cn(solid, "shrink-0 gap-2 px-4")} onClick={startDemo}>Try the demo <ArrowUpRightIcon weight="bold" className="size-4" /></button>
        )}
      </div>
    </div>
  );
}

function PresalePanel({ market, sim, bnbUsd }: { market: MarketCoin; sim: LaunchSim; bnbUsd: number | null }) {
  const demo = useDemo();
  const [quantity, setQuantity] = useState(1);
  const [filling, setFilling] = useState(false);
  const left = sim.packsForSale - sim.packsSold;
  const raise = sim.price * sim.packsForSale;
  const q = Math.min(quantity, Math.max(1, left));
  const short = demo.active && bnbUsd !== null && (q * sim.price) / bnbUsd > demo.bnb + 1e-12;

  // Simulated other buyers take a pack every 400ms until it sells out.
  useEffect(() => {
    if (!filling) return;
    const t = setInterval(() => { if (!otherBuysPresale(market)) setFilling(false); }, 400);
    return () => clearInterval(t);
  }, [filling, market]);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">Presale</h2>
        <span className="tabular-nums text-sm text-muted">[ {sim.packsSold} / {sim.packsForSale} sold ]</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Presale packs sold" aria-valuemin={0} aria-valuemax={sim.packsForSale} aria-valuenow={sim.packsSold}>
        <div className="h-full rounded-full bg-black transition-[width] duration-300" style={{ width: `${(sim.packsSold / sim.packsForSale) * 100}%` }} />
      </div>
      <p className="tabular-nums mt-2 text-sm text-muted">Raised {usd(sim.packsSold * sim.price, 0)} of {usd(raise, 0)} · simulated</p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <Stat label="Your packs" value={String(sim.mine)} />
        <Stat label="Pack" value={usd(sim.price, 0)} />
        <Stat label="Left" value={String(left)} />
      </dl>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="You buy at" value={`${usd(presaleMcap(raise), 0)} mcap`} />
        <Stat label="Launches at" value={`${usd(launchMcap(raise), 0)} mcap`} />
      </dl>
      <p className="mt-5 text-[13px] text-muted">At launch</p>
      <dl className="mt-2 grid grid-cols-3 gap-3 rounded-md border border-border p-3">
        <Stat label="Liquidity" value={usd(raise * (1 - SEED_SHARE), 0)} />
        <Stat label="Presale prizes" value={usd(raise * SEED_SHARE, 0)} />
        <Stat label="Your coins" value={amount((sim.mine * BUYERS_SUPPLY) / sim.packsForSale, 0)} />
      </dl>

      <button type="button" className={cn(outline, "mt-5 w-full justify-between")} disabled={filling || left < 1} onClick={() => setFilling(true)}>
        {filling ? "Other buyers joining…" : "Simulate other buyers"} <ArrowUpRightIcon weight="bold" className="size-4" />
      </button>

      <BuyBar
        totalUsd={q * sim.price} bnbUsd={bnbUsd} quantity={q} max={left} setQuantity={setQuantity}
        label={short ? "Not enough BNB" : q === 1 ? "Buy pack" : `Buy ${q}`}
        disabled={!bnbUsd || left < 1 || short || filling}
        onBuy={() => { if (bnbUsd) buyPresale(market, q, bnbUsd); setQuantity(1); }}
      />
    </>
  );
}

function LivePanel({ market, sim, bnbUsd, onOpen }: { market: MarketCoin; sim: LaunchSim; bnbUsd: number | null; onOpen: (kind: Tier | "presale", count: number) => void }) {
  const demo = useDemo();
  const [tier, setTier] = useState<Tier>(0);
  const [quantity, setQuantity] = useState(1);
  const presale = presalePacksOf(sim);
  const ok = canBuyTier(sim, tier, quantity);
  const short = demo.active && bnbUsd !== null && (quantity * sim.price) / bnbUsd > demo.bnb + 1e-12;
  const taxTotal = sim.tax.pool + sim.tax.stakers + sim.tax.creator + sim.tax.platform;
  const unopened = TIERS.filter((t) => sim.bought[t.id] > 0);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">Live</h2>
        <span className="tabular-nums text-sm text-muted">[ presale sold out ]</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 phone:grid-cols-4">
        <Stat label="Stock pool" value={usd(sim.pool)} />
        <Stat label="Liquidity" value={usd(sim.liquidity, 0)} />
        <Stat label="Presale prizes" value={usd(sim.presaleReserve)} />
        <Stat label="Your coins" value={amount(sim.tokens, 0)} />
      </dl>

      {(presale > 0 || unopened.length > 0) && (
        <div className="mt-5 flex flex-col gap-1.5">
          {presale > 0 && (
            <button type="button" className={cn(solid, "w-full justify-between")} onClick={() => onOpen("presale", presale)}>
              Open presale packs · {presale} <ArrowUpRightIcon weight="bold" className="size-4" />
            </button>
          )}
          {unopened.map((t) => (
            <button key={t.id} type="button" className={cn(outline, "w-full justify-between")} onClick={() => onOpen(t.id, sim.bought[t.id])}>
              Open {t.name} · {sim.bought[t.id]} <ArrowUpRightIcon weight="bold" className="size-4" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-1.5" role="group" aria-label="Pack risk">
        {TIERS.map((t) => {
          const open = canBuyTier(sim, t.id, 1);
          const lo = Math.min(...TABLES[t.id]), hi = topMult(t.id);
          return (
            <button key={t.id} type="button" aria-pressed={tier === t.id} disabled={!open} onClick={() => { setTier(t.id); setQuantity(1); }}
              className="flex min-h-16 min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-black aria-pressed:border-black disabled:cursor-not-allowed disabled:border-dashed disabled:hover:border-border">
              <strong className="flex items-center gap-1.5 text-base font-normal">{!open && <LockIcon weight="bold" className="size-3.5 shrink-0 text-muted" />}{t.name}</strong>
              <span className="tabular-nums text-[12px] leading-snug text-muted phone:text-[13px]">{!open ? `Pool ${usd(poolNeeded(sim, t.id), 0)}` : lo === hi ? `Pays ${pctOf(lo)}` : `${pctOf(lo)}–${pctOf(hi)}`}</span>
            </button>
          );
        })}
      </div>

      <BuyBar
        totalUsd={quantity * sim.price} bnbUsd={bnbUsd} quantity={quantity} max={10} setQuantity={setQuantity}
        label={!ok ? "Pool too small" : short ? "Not enough BNB" : quantity === 1 ? "Buy pack" : `Buy ${quantity}`}
        disabled={!bnbUsd || !ok || short}
        onBuy={() => { if (bnbUsd && buyTier(market, tier, quantity, bnbUsd)) { onOpen(tier, sim.bought[tier] + quantity); setQuantity(1); } }}
      />

      <section className="mt-8 border-t border-border pt-5" aria-labelledby="tax-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="tax-title" className="text-base font-normal">Trading tax <span className="text-muted">· simulated</span></h3>
          <button type="button" className={cn(cleanButton.small, "min-h-11")} onClick={() => simulateTax(market, Math.round((3 + Math.random() * 5) * 100) / 100)}>Simulate trading</button>
        </div>
        <ul className="mt-3 flex flex-col">
          {([["Stock pool", "pool"], ["Card stakers", "stakers"], ["Creator", "creator"], ["Platform", "platform"]] as const).map(([label, k]) => (
            <li key={k} className="tabular-nums flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span><span className="inline-block w-10 text-muted">{pctOf(TAX_SPLIT[k])}</span>{label}</span>
              <span>{usd(sim.tax[k])}</span>
            </li>
          ))}
          <li className="tabular-nums flex justify-between py-2.5 text-sm text-muted"><span>Total</span><span>{usd(taxTotal)}</span></li>
        </ul>
      </section>

      <StakePanel market={market} sim={sim} bnbUsd={bnbUsd} />
    </>
  );
}

export function PackShop({ market }: { market: MarketCoin }) {
  const sim = useLaunchSim(market);
  const size = packSizeOf(market);
  const color = market.packs.find((p) => p.size === size.id)?.color;
  const custom = market.config.design === "custom";
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const [opening, setOpening] = useState<{ kind: Tier | "presale"; count: number } | null>(null);
  const tiltPack = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json())
      .then((d) => setBnbUsd(typeof d.price === "number" && d.price > 0 ? d.price : FALLBACK_BNB_USD))
      .catch(() => setBnbUsd(FALLBACK_BNB_USD));
  }, []);

  function onOpen(): Pull | null {
    if (!opening) return null;
    const res: Opened | null = opening.kind === "presale" ? openPresale(market) : openBought(market, opening.kind);
    if (!res) return null;
    const rarity = rarityOf(res.roll);
    const ticker = drawStock(market.basket);
    const set = (custom ? market.config.cards[rarity]?.set : undefined) ?? SET_FOR_SIZE[size.id] ?? "fable";
    const price = stockOf(ticker)?.price;
    addCard({ coin: market.slug, coinName: market.name, size: size.id, set, ticker, rarity, usd: res.value, shares: price ? res.value / price : 0 });
    const note = opening.kind === "presale" ? `${amount(res.roll, 2)}× its share` : `${pctOf(res.roll)} of the price`;
    return { rarity, value: res.value, ticker, note };
  }

  function tiltTo(e: React.PointerEvent) {
    const el = tiltPack.current;
    if (!el || e.pointerType !== "mouse") return;
    const b = el.getBoundingClientRect();
    el.style.setProperty("--px", String((e.clientX - b.left) / b.width));
    el.style.setProperty("--py", String((e.clientY - b.top) / b.height));
    el.dataset.active = "";
  }
  function untilt() {
    const el = tiltPack.current;
    if (!el) return;
    el.style.removeProperty("--px");
    el.style.removeProperty("--py");
    delete el.dataset.active;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-2 desk:gap-12">
      {/* Phones: a small pack beside the name, so the presale progress shows without scrolling. */}
      <div className="flex items-center gap-4 desk:flex-col desk:justify-center desk:gap-6 desk:py-10">
        <button ref={tiltPack} type="button" aria-label="Odds" aria-haspopup="dialog" onClick={() => setShowOdds(true)} onPointerMove={tiltTo} onPointerLeave={untilt}
          className="pack-tilt relative w-[190px] shrink-0 [zoom:0.5] desk:[zoom:1.2]">
          <SealedPack size={size} coin={market.name} color={color} style={custom ? coverStyle(market.config.tone, market.config.pattern, market.config.cover) : undefined} />
          <span className="holo-glare rounded-[4px]" aria-hidden="true" />
        </button>
        <div className="min-w-0 desk:text-center">
          <p className="truncate text-[22px] leading-tight">{market.name}</p>
          <p className="tabular-nums mt-1 text-sm text-muted">{sim.phase === "presale" ? "Presale" : "Live"} · {usd(sim.price, 0)} pack · simulated</p>
          <button type="button" aria-haspopup="dialog" className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm underline-offset-4 hover:underline" onClick={() => setShowOdds(true)}>
            Odds <ArrowUpRightIcon weight="bold" className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-w-0 pb-8 desk:pt-10" aria-live="polite">
        <CoinPackLink market={market} page="packs" />
        <div className="mt-6" />
        {sim.phase === "presale"
          ? <PresalePanel market={market} sim={sim} bnbUsd={bnbUsd} />
          : <LivePanel market={market} sim={sim} bnbUsd={bnbUsd} onOpen={(kind, count) => setOpening({ kind, count })} />}
      </div>

      {showOdds && <OddsDialog price={sim.price} onClose={() => setShowOdds(false)} />}
      {opening && (
        <RevealDialog
          key={`${String(opening.kind)}-${opening.count}`}
          title={opening.kind === "presale" ? "Presale pack" : `${TIERS[opening.kind].name} risk`}
          count={opening.count} size={size} market={market} onOpen={onOpen} onClose={() => setOpening(null)}
        />
      )}
    </div>
  );
}
