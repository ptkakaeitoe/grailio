"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Lock, Minus, Plus, TrendingUp, X } from "lucide-react";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { SET_FOR_SIZE, cardArt } from "@/lib/cards";
import { addCard } from "@/lib/collection";
import { stockOf } from "@/lib/stocks";
import {
  DEFAULT_RISKS, DEFAULT_SIZES, DEFAULT_UNLOCKS, DEMO_TOKENS_PER_BNB, RARITIES, RARITY_DOT,
  canSell, tierReturn, unlockAt, usePack, type PackSize, type RiskId, type RiskTier,
} from "@/lib/pack";
import { amount, usd } from "@/lib/format";
import { cleanButton, cleanDialog, cn, dialogClose, dialogHeader } from "@/components/clean-ui";
import type { MarketCoin, PackColor } from "@/lib/market";
import type { RiskDecision } from "@/lib/risk";
import { RiskPanel } from "@/components/risk-panel";

/*
 * The app's pack shop, laid out like the stonks app's pack panel: a carousel of sealed packs on the left
 * (one per size), and on the right the risk picker, odds, checkout and the opening reveal.
 * Purchases are simulated until the contracts are on testnet. Mobile first: on phones it reads top to bottom (pack,
 * risk picker, risk check, checkout) and the price and Buy button stick above the tab bar.
 * Used for one coin's page in the pack marketplace (/app/packs/[coin]); without a coin it shows the local pack draft.
 */

/** Demo stock pool for the local draft (no coin given). Medium is unlocked (pool passed $1,000); High unlocks at $5,000. */
const DEMO_POOL_USD = 1240;

/** Flat pack colors per size (the stonks pack palette). */
const PALETTE: Record<string, { bg: string; ink: string; halo: string }> = {
  starter: { bg: "#ec746e", ink: "#000000", halo: "#ec746e55" },
  standard: { bg: "#202020", ink: "#74fc84", halo: "#74fc8444" },
  grail: { bg: "#8f1a12", ink: "#f6d4cf", halo: "#8f1a1255" },
};
export const SUBTITLE: Record<string, string> = { starter: "Your first pull", standard: "The everyday pack", grail: "For the chase" };

const solid = cn(cleanButton.solid, "px-5 disabled:hover:bg-black disabled:hover:text-white");
const outline = cn(cleanButton.outline, "px-5");
const stepperButton = "grid size-11 place-items-center disabled:cursor-default disabled:opacity-30";
/** Carousel arrows, level with the centred pack (340px tall on phones, 380px from 481px, 520px from 801px). */
/** The Cournot risk check panel is hidden for now; flip this to bring it back. */
const SHOW_RISK_CHECK = false;
const stepButton = "absolute top-[168px] z-[3] grid size-11 place-items-center rounded-full border border-border-strong bg-white text-black transition-colors hover:border-black phone:top-[188px] desk:top-[238px]";
const seal = "h-[15px] bg-[repeating-linear-gradient(90deg,transparent_0_3px,currentColor_3px_4px)] opacity-20";
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function SealedPack({ size, coin, color, className, style }: { size: PackSize; coin: string; color?: PackColor; className?: string; style?: CSSProperties }) {
  const p = color ?? PALETTE[size.id] ?? PALETTE.standard;
  const shape = size.id === "grail" ? "rounded-[45%_45%_6px_6px]" : "rounded-full";
  return (
    <div className={cn("relative flex flex-col rounded-[4px] shadow-[0_18px_30px_-18px_#000a]", className)} style={{ background: p.bg, color: p.ink, ...style }}>
      <div className={seal} />
      <div className="flex flex-col items-center px-5 pt-[30px] pb-5">
        <span className="max-w-full truncate text-[13px] tracking-[0.12em] uppercase">{coin}</span>
        <span className="mt-[9px] text-[7px] tracking-[0.14em] opacity-75">STOCK PACK · {usd(size.price, 0)}</span>
        <div className={cn("relative my-7 grid size-[112px] place-items-center border border-current before:absolute before:inset-[5px] before:rounded-[inherit] before:border before:border-current before:opacity-40 [&_svg]:size-[44%]", shape)}>
          <TrendingUp strokeWidth={1.5} />
        </div>
        <span className="text-[34px] tracking-[-0.02em]">{size.name}</span>
        <span className="mt-1.5 text-[10px] opacity-80">{SUBTITLE[size.id] ?? ""}</span>
        <div className="mt-6 flex w-full justify-between gap-2 border-t border-current/35 pt-3 text-[6px] opacity-75">
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
        <button type="button" className={cn(dialogClose, "size-11")} onClick={onClose} aria-label="Close"><X className="size-[18px]" /></button>
      </header>
      {children}
    </dialog>
  );
}

function OddsDialog({ size, risk, onClose }: { size: PackSize; risk: RiskTier; onClose: () => void }) {
  const total = risk.tiers.reduce((s, t) => s + t.odds, 0);
  return (
    <Dialog title={`Odds · ${size.name} · ${risk.name} risk`} onClose={onClose} className="w-[min(520px,calc(100%-24px))]">
      <div className="p-5 phone:p-6">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr><th className="border-b border-border py-3 font-normal">Rarity</th><th className="border-b border-border py-3 font-normal">Odds</th><th className="border-b border-border py-3 text-right font-normal">Card holds</th></tr>
          </thead>
          <tbody className="num">
            {risk.tiers.map((t, i) => (
              <tr key={RARITIES[i]}>
                <td className="border-b border-border py-3 capitalize"><span className="mr-2 inline-block size-1.5 rounded-full align-middle" style={{ background: RARITY_DOT[RARITIES[i]] }} />{RARITIES[i]}</td>
                <td className="border-b border-border py-3">{pct(t.odds / total)}</td>
                <td className="border-b border-border py-3 text-right">{usd(size.price * t.mult)} <span className="text-muted">({t.mult}×)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm leading-relaxed text-muted">Pays back {pct(tierReturn(risk))} on average, in bStocks. Burn the card to redeem them.</p>
      </div>
    </Dialog>
  );
}

type Pull = { rarity: number; value: number; ticker: string };

/** Picks a basket stock by weight. */
function drawStock(basket: { ticker: string; weight: number }[]) {
  let roll = Math.random() * basket.reduce((s, b) => s + b.weight, 0);
  return (basket.find((b) => (roll -= b.weight) < 0) ?? basket[0])?.ticker ?? "";
}

function drawRarity(r: RiskTier) {
  let roll = Math.random() * r.tiers.reduce((s, t) => s + t.odds, 0);
  const i = r.tiers.findIndex((t) => (roll -= t.odds) < 0);
  return i === -1 ? 0 : i;
}

function RevealDialog({ size, risk, count, coin, coinSlug, color, basket, onClose }: { size: PackSize; risk: RiskTier; count: number; coin: string; coinSlug: string; color?: PackColor; basket: { ticker: string; weight: number }[]; onClose: () => void }) {
  const [left, setLeft] = useState(count);
  const [phase, setPhase] = useState<"ready" | "opening" | "revealed">("ready");
  const [pull, setPull] = useState<Pull | null>(null);
  const halo = color ? `${color.bg}55` : (PALETTE[size.id] ?? PALETTE.standard).halo;

  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("revealed"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100);
    return () => clearTimeout(t);
  }, [phase]);

  function open() {
    if (left < 1) return;
    const rarity = drawRarity(risk);
    const value = size.price * risk.tiers[rarity].mult;
    const ticker = drawStock(basket);
    setPull({ rarity, value, ticker });
    // Simulated until the vault is on testnet: the card goes into this browser's collection.
    const price = stockOf(ticker)?.price;
    addCard({ coin: coinSlug, coinName: coin, size: size.id, set: SET_FOR_SIZE[size.id] ?? "fable", ticker, rarity, usd: value, shares: price ? value / price : 0 });
    setLeft((n) => n - 1);
    setPhase("opening");
  }

  return (
    <Dialog title={`${size.name} · ${risk.name} risk · simulated`} onClose={onClose} className="w-[min(440px,calc(100%-32px))]">
      <div className="relative isolate grid min-h-[220px] place-items-center overflow-hidden bg-surface-muted py-4 phone:min-h-[260px] phone:py-5" aria-hidden="true">
        {phase === "revealed" && pull ? (
          <div className="w-[140px] animate-[card-unveil_.65s_ease-out_both] phone:w-[160px]">
            <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px] shadow-[0_12px_24px_-12px_rgba(0,0,0,.4)]">
              <StockCardFront art={cardArt(pull.ticker, pull.rarity, SET_FOR_SIZE[size.id] ?? "fable")} rarity={pull.rarity} brand={coin} decorative sizes="160px" className="w-full" />
              <Holo rarity={pull.rarity} />
              <span className="holo-glare" aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div className={cn("w-[190px] [zoom:0.62] phone:[zoom:0.72]", phase === "opening" && "animate-[pack-shake_.18s_ease-in-out_5_alternate,pack-fade_.3s_.9s_forwards]")}>
            <SealedPack size={size} coin={coin} color={color} />
          </div>
        )}
        <span className="absolute -z-10 size-[220px] rounded-full" style={{ background: `radial-gradient(circle, ${halo}, transparent 70%)` }} />
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] phone:p-5">
        <div role="status" aria-live="polite">
          <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">
            {phase === "ready" ? `${left} ${left === 1 ? "pack" : "packs"} ready` : phase === "opening" ? "Opening…" : <span className="capitalize">{RARITIES[pull!.rarity]}</span>}
          </h2>
          {phase === "revealed" && pull && <p className="num mt-1 text-sm text-muted">Holds {usd(pull.value)} of {pull.ticker ? `${pull.ticker}B` : "bStocks"} · {risk.tiers[pull.rarity].mult}× the price</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {phase !== "opening" && (
            <button type="button" className={cn(solid, "w-full justify-between")} disabled={left < 1} onClick={open}>
              {phase === "ready" ? "Open pack" : left > 0 ? `Open another · ${left} left` : "No packs left"} <ArrowUpRight className="size-4" />
            </button>
          )}
          {phase === "revealed" && <Link href="/app/collection" className={cn(outline, "w-full justify-between")} onClick={onClose}>View collection <ArrowUpRight className="size-4" /></Link>}
        </div>
      </div>
    </Dialog>
  );
}

export function PackShop({ market, initialSize }: { market?: MarketCoin; initialSize?: string } = {}) {
  const draft = usePack();
  // A marketplace pack uses its own design from the Launch flow; without one, the local draft.
  const c = market?.config ?? draft;
  const allSizes = c.sizes?.length ? c.sizes : DEFAULT_SIZES;
  // A marketplace coin sells only the sizes it launched with, in its own colors.
  const sizes = market ? allSizes.filter((s) => market.packs.some((p) => p.size === s.id)) : allSizes;
  const colorOf = (id: string) => market?.packs.find((p) => p.size === id)?.color;
  const poolUsd = market?.poolUsd ?? DEMO_POOL_USD;
  const risks = c.risks?.length ? c.risks : DEFAULT_RISKS;
  const unlocks = c.unlocks ?? DEFAULT_UNLOCKS;
  const coin = market?.name ?? (c.name || "Your meme");

  const startAt = sizes.findIndex((s) => s.id === initialSize);
  const [index, setIndex] = useState(startAt >= 0 ? startAt : Math.min(1, sizes.length - 1));
  const [prevIndex, setPrevIndex] = useState(index);
  // Hold and drag a pack sideways to change it (graily's carousel); a tap opens the odds.
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const [riskId, setRiskId] = useState<RiskId>("low");
  const [currency, setCurrency] = useState<"bnb" | "coin">("bnb");
  const [quantity, setQuantity] = useState(1);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const [bought, setBought] = useState<number | null>(null);
  const [riskDecision, setRiskDecision] = useState<RiskDecision | null>(null);
  const tiltPack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json()).then((d) => typeof d.price === "number" && d.price > 0 && setBnbUsd(d.price)).catch(() => {});
  }, []);

  const size = sizes[index];
  const risk = risks.find((r) => r.id === riskId) ?? risks[0];
  const unlocked = (r: RiskTier) => poolUsd >= unlockAt(unlocks, r.id);
  // The Cournot risk check can pause Medium and High; Low is self-funded and always sells.
  const riskOpen = (r: RiskTier) => r.id === "low" || !riskDecision || (r.id === "high" ? riskDecision.highOpen : riskDecision.mediumOpen);
  const sellable = unlocked(risk) && riskOpen(risk) && canSell(risk, size.price * quantity, poolUsd);
  const totalUsd = size.price * quantity;
  const totalBnb = bnbUsd ? totalUsd / bnbUsd : null;
  const total = totalBnb === null ? null : currency === "bnb" ? totalBnb : totalBnb * DEMO_TOKENS_PER_BNB;
  const nextUnlock = risks.filter((r) => !unlocked(r)).sort((a, b) => unlockAt(unlocks, a.id) - unlockAt(unlocks, b.id))[0];

  const goTo = (next: number) => {
    const target = ((next % sizes.length) + sizes.length) % sizes.length;
    if (target === index) return;
    setPrevIndex(index);
    setIndex(target);
  };

  const SWIPE_PX = 60, CLICK_PX = 6, FREE_DRAG_PX = 160;
  function onPointerDown(e: React.PointerEvent) {
    if (!e.isPrimary || e.button !== 0) return;
    untilt();
    dragFrom.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom.current === null) return tiltTo(e);
    const dx = e.clientX - dragFrom.current, d = Math.abs(dx);
    // Past FREE_DRAG_PX the pack still follows, with resistance.
    setDrag(Math.sign(dx) * (d <= FREE_DRAG_PX ? d : FREE_DRAG_PX + (d - FREE_DRAG_PX) * 0.3));
  }
  function onPointerUp() {
    if (dragFrom.current === null) return;
    if (Math.abs(drag) > SWIPE_PX && sizes.length > 1) goTo(index + (drag < 0 ? 1 : -1));
    else if (Math.abs(drag) < CLICK_PX) setShowOdds(true);
    dragFrom.current = null;
    setDragging(false);
    setDrag(0);
  }
  function onPointerCancel() { dragFrom.current = null; setDragging(false); setDrag(0); }

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
    <div className="grid grid-cols-1 items-start gap-4 desk:grid-cols-2 desk:gap-12">
      <div className="relative flex min-w-0 touch-pan-y flex-col items-center overflow-hidden pb-2 select-none desk:pb-5">
        <button type="button" className={cn(stepButton, "left-2", sizes.length < 2 && "hidden")} onClick={() => goTo(index - 1)} aria-label={`Show the ${sizes[(index - 1 + sizes.length) % sizes.length].name} pack`}><ArrowLeft className="size-5" /></button>
        <div className="relative h-[380px] w-full overflow-hidden phone:h-[420px] desk:h-[520px]">
          {sizes.map((s, i) => {
            const n = sizes.length;
            const offset = n === 1 ? 0 : ((i - index + 1 + n) % n) - 1;
            const before = n === 1 ? 0 : ((i - prevIndex + 1 + n) % n) - 1;
            const motion = dragging || Math.abs(offset - before) > 1 ? "none" : undefined;
            const current = offset === 0;
            return (
              <div
                key={s.id}
                className={cn("pointer-events-none absolute inset-0 grid place-items-center transition-transform duration-[550ms] ease-[cubic-bezier(.22,.75,.25,1)]", current && "z-[1]")}
                style={{ transform: `translateX(calc(${offset} * (50% + 200px) + ${drag}px))`, transition: motion }}
                aria-hidden={!current}
              >
                <div
                  ref={current ? tiltPack : undefined}
                  role="img"
                  aria-label={`${s.name} pack`}
                  className={cn("pack-tilt relative w-[260px] max-w-[68%] touch-pan-y max-desk:scale-[0.8]", current && cn("pointer-events-auto", dragging ? "cursor-grabbing" : "cursor-grab"))}
                  {...(current && { onPointerDown, onPointerMove, onPointerUp, onPointerLeave: untilt, onLostPointerCapture: onPointerUp, onPointerCancel })}
                >
                  <SealedPack
                    size={s}
                    coin={coin}
                    color={colorOf(s.id)}
                    className="origin-[center_65%] transition-transform duration-[550ms] ease-[cubic-bezier(.22,.75,.25,1)]"
                    style={{ transform: `rotate(${offset * 18 + drag / 18}deg)`, transition: motion }}
                  />
                  <span className="holo-glare rounded-[4px]" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className={cn(stepButton, "right-2", sizes.length < 2 && "hidden")} onClick={() => goTo(index + 1)} aria-label={`Show the ${sizes[(index + 1) % sizes.length].name} pack`}><ArrowRight className="size-5" /></button>
        <div className={cn("flex", sizes.length < 2 && "hidden")} role="group" aria-label="Pack size">
          {sizes.map((s, i) => (
            <button key={s.id} type="button" aria-pressed={i === index} aria-label={s.name} onClick={() => goTo(i)}
              className="relative size-11 after:absolute after:inset-[18px] after:rounded-full after:border after:border-border-strong aria-pressed:after:border-black aria-pressed:after:bg-black desk:size-8 desk:after:inset-3" />
          ))}
        </div>
      </div>

      {/* Desktop: starts level with the top of the pack (centred 400px tall in the 520px carousel, so 60px down). */}
      <div className="min-w-0 pb-8 desk:pt-[60px]" aria-live="polite">
        <div className="mb-5 desk:mb-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">{size.name}</h2>
            <span className="num shrink-0 text-sm text-muted">[ {String(index + 1).padStart(2, "0")} / {String(sizes.length).padStart(2, "0")} · {usd(size.price, 0)} ]</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 text-base text-muted">{SUBTITLE[size.id] ?? ""}</p>
            <button type="button" aria-haspopup="dialog" className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-base underline-offset-4 hover:underline" onClick={() => setShowOdds(true)}>
              Odds &amp; rewards <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Pack risk">
          {risks.map((r) => {
            const open = unlocked(r);
            const paused = open && !riskOpen(r);
            return (
              <button key={r.id} type="button" aria-pressed={riskId === r.id} disabled={!open || paused} onClick={() => setRiskId(r.id)}
                className="flex min-h-16 min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-black aria-pressed:border-black disabled:cursor-not-allowed disabled:border-dashed disabled:hover:border-border">
                <strong className="flex items-center gap-1.5 text-base font-normal">{(!open || paused) && <Lock className="size-3.5 shrink-0 text-muted" />}{r.name}</strong>
                <span className="text-[12px] leading-snug text-muted phone:text-[13px]">{!open ? `Pool ${usd(unlockAt(unlocks, r.id), 0)}` : paused ? "Paused by risk check" : `Pays ${pct(tierReturn(r))} avg`}</span>
              </button>
            );
          })}
        </div>
        <p className="num mb-5 text-[13px] text-muted desk:mb-6">
          Stock pool {usd(poolUsd, 0)}{nextUnlock ? ` · ${nextUnlock.name} unlocks at ${usd(unlockAt(unlocks, nextUnlock.id), 0)}` : " · all tiers unlocked"}
        </p>
        {SHOW_RISK_CHECK && market?.seed && <RiskPanel coin={market.slug} onDecision={setRiskDecision} />}

        <div className="flex items-center justify-between gap-4">
          <details className="group relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
            <summary aria-label={`Pay with ${currency === "bnb" ? "BNB" : coin}`} className="flex h-11 max-w-[180px] cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 text-base transition-colors hover:border-border-strong group-open:border-black [&::-webkit-details-marker]:hidden">
              <span className="truncate">{currency === "bnb" ? "BNB" : coin}</span>
              <ChevronDown className="ml-1 size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute top-[calc(100%+8px)] left-0 z-30 w-[220px] animate-[popover-in_.15s_ease-out] rounded-md border border-border bg-white/90 p-1.5 shadow-[0_12px_30px_#0000004d] backdrop-blur-[14px]" role="group" aria-label="Payment">
              {([["bnb", "BNB"], ["coin", coin]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={currency === id} className="flex min-h-11 w-full items-center rounded px-2.5 py-2 text-sm transition-colors hover:bg-surface-muted aria-pressed:bg-surface-muted desk:min-h-9"
                  onClick={(e) => { setCurrency(id); const d = e.currentTarget.closest("details"); if (d) d.open = false; }}>{label}</button>
              ))}
            </div>
          </details>
          <div className="flex h-11 items-center rounded-md border border-border">
            <button type="button" className={stepperButton} aria-label="Fewer packs" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="size-4" /></button>
            <span className="num w-[34px] text-center text-base" aria-label="Pack quantity">{quantity}</span>
            <button type="button" className={stepperButton} aria-label="More packs" disabled={quantity >= 10} onClick={() => setQuantity((q) => Math.min(10, q + 1))}><Plus className="size-4" /></button>
          </div>
        </div>

        {/* Phones: price and Buy stick to the bottom of the screen, just above the tab bar, so buying needs no scrolling. */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-6 phone:gap-4 max-desk:sticky max-desk:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[var(--gutter)] max-desk:bg-white max-desk:px-[var(--gutter)] max-desk:py-3">
          <div className="min-w-0">
            <strong className="block truncate text-[24px] leading-none font-normal tracking-[-0.02em] phone:text-[28px]">
              <span className="num">{total === null ? "…" : amount(total, currency === "bnb" ? 4 : 0)}</span> <span className="text-sm tracking-normal text-muted">{currency === "bnb" ? "BNB" : coin}</span>
            </strong>
            <p className="num mt-2 text-[13px] text-muted">≈ {usd(totalUsd, 0)} · simulated</p>
          </div>
          <button type="button" className={cn(solid, "shrink-0 gap-2 phone:gap-3")} disabled={!sellable} onClick={() => setBought(quantity)}>
            {!unlocked(risk) ? "Locked" : !sellable ? "Paused" : `Buy ${quantity === 1 ? "pack" : `${quantity} packs`}`} <ArrowUpRight className="size-4" />
          </button>
        </div>
        {unlocked(risk) && !riskOpen(risk) && <p className="mt-3.5 text-sm leading-relaxed text-muted" role="status">The risk check paused {risk.name} packs. Low is still on sale.</p>}
        {unlocked(risk) && riskOpen(risk) && !sellable && <p className="mt-3.5 text-sm leading-relaxed text-muted" role="status">The pool can&apos;t cover this pack&apos;s top prize yet. Try fewer packs or Low risk.</p>}
      </div>

      {showOdds && <OddsDialog size={size} risk={risk} onClose={() => setShowOdds(false)} />}
      {bought !== null && <RevealDialog size={size} risk={risk} count={bought} coin={coin} color={colorOf(size.id)} basket={market?.basket ?? c.basket} coinSlug={market?.slug ?? "draft"} onClose={() => setBought(null)} />}
    </div>
  );
}
