"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Minus, Plus, X } from "lucide-react";
import { SealedPack } from "@/components/pack-shop";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { PACK_COVER, SET_FOR_SIZE, type ArtSet } from "@/lib/cards";
import { addCard } from "@/lib/collection";
import { spendDemoBnb, startDemo, useDemo } from "@/lib/demo";
import { DEFAULT_RISKS, DEFAULT_SIZES, RARITIES, RARITY_DOT, tierReturn, type PackSize, type RiskId, type RiskTier } from "@/lib/pack";
import { PRICED_STOCKS } from "@/lib/stocks";
import { coinCardArt, customPack, isCustom } from "@/lib/design";
import type { MarketCoin } from "@/lib/market";
import { amount, usd } from "@/lib/format";
import { cleanButton, cleanDialog, cn, dialogClose, dialogHeader } from "@/components/clean-ui";

/*
 * Classic collections: packs not backed by any coin. Pick a size (Starter / Standard / Grail, each its own art set)
 * and a risk tier, pay from the demo wallet, open, and get a card holding one stock at Atlas prices. Simulated in this
 * browser. The built-in classic line draws from every priced stock (collection slug "classic"); a classic collection
 * published from Launch (config.kind === "classic") uses its own sizes, risk tiers, basket and design. Classic cards
 * can't be staked (staking is paid from a coin's trading tax).
 */

export const CLASSIC_SLUG = "classic";
export const CLASSIC_NAME = "Classic";
export const CLASSIC_SIZES: PackSize[] = DEFAULT_SIZES;

/** Every stock Atlas prices, equally likely. */
const BASKET = PRICED_STOCKS.filter((s) => s.price).map((s) => ({ ticker: s.ticker, weight: 1 }));
const isPriced = (ticker: string) => PRICED_STOCKS.some((s) => s.ticker === ticker && s.price);

/** What one classic shop sells: the built-in line, or a published classic collection. */
type Line = { slug: string; name: string; sizes: PackSize[]; risks: RiskTier[]; basket: { ticker: string; weight: number }[]; coin?: MarketCoin };

export function lineOf(coin?: MarketCoin): Line {
  if (!coin) return { slug: CLASSIC_SLUG, name: CLASSIC_NAME, sizes: CLASSIC_SIZES, risks: DEFAULT_RISKS, basket: BASKET };
  const c = coin.config;
  const all = c.sizes?.length ? c.sizes : DEFAULT_SIZES;
  const offered = all.filter((s) => coin.packs.some((p) => p.size === s.id));
  const basket = coin.basket.filter((b) => b.weight > 0 && isPriced(b.ticker));
  return {
    slug: coin.slug, name: coin.name, coin,
    sizes: offered.length ? offered : all,
    risks: c.risks?.length === DEFAULT_RISKS.length ? c.risks : DEFAULT_RISKS,
    basket: basket.length ? basket : BASKET,
  };
}

/** Picks a basket stock by weight. */
function drawStock(basket: Line["basket"]) {
  let roll = Math.random() * basket.reduce((s, b) => s + b.weight, 0);
  return (basket.find((b) => (roll -= b.weight) < 0) ?? basket[0]).ticker;
}

/** Card art set for a rarity: the collection's per-rarity set when custom, else the pack size's set. */
const cardSet = (line: Line, size: PackSize, rarity: number): ArtSet =>
  (isCustom(line.coin?.config) ? line.coin?.config.cards[rarity]?.set : undefined) ?? setOf(size);
/** Used only if the BNB price feed can't be reached, so the demo still works. */
const FALLBACK_BNB_USD = 600;

const solid = cn(cleanButton.solid, "px-5 disabled:hover:bg-black disabled:hover:text-white");
const outline = cn(cleanButton.outline, "px-5");
const stepperButton = "grid size-11 place-items-center disabled:cursor-default disabled:opacity-30";
/** Carousel arrows, level with the centred pack. */
const stepButton = "absolute top-[168px] z-[3] grid size-11 place-items-center rounded-full border border-border-strong bg-white text-black transition-colors hover:border-black phone:top-[188px] desk:top-[238px]";
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

const setOf = (size: PackSize): ArtSet => SET_FOR_SIZE[size.id] ?? "fable";
const CLASSIC_COLOR = { bg: "#111111", ink: "#ffffff" };
/** The set's cover art under a dark wash, so the pack's labels stay readable. */
export const classicCoverStyle = (size: PackSize): CSSProperties => ({
  background: `linear-gradient(180deg, rgb(0 0 0 / .3), rgb(0 0 0 / .6)), url("${PACK_COVER[setOf(size)]}") center / cover, #111`,
  color: "#fff",
});

/** A sealed classic pack: the collection's own design, or the size's art-set cover. */
export function ClassicPack({ size, coin, className, style }: { size: PackSize; coin?: MarketCoin; className?: string; style?: CSSProperties }) {
  const custom = customPack(coin?.config);
  if (coin && custom) return <SealedPack size={size} coin={coin.name} color={custom.color} className={className} style={{ ...custom.style, ...style }} />;
  return <SealedPack size={size} coin={coin?.name ?? CLASSIC_NAME} color={CLASSIC_COLOR} className={className} style={{ ...classicCoverStyle(size), ...style }} />;
}

/** Latest Atlas prices by ticker; reference prices until (or unless) the feed answers. */
function useStockPrices() {
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(PRICED_STOCKS.map((s) => [s.ticker, s.price ?? 0])));
  useEffect(() => {
    let live = true;
    fetch(`/api/atlas?ids=${PRICED_STOCKS.map((s) => s.feedId).join(",")}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { quotes?: { id: number; price: number }[] }) => {
        if (!live || !Array.isArray(d.quotes)) return;
        setPrices((cur) => {
          const next = { ...cur };
          for (const q of d.quotes!) {
            const s = PRICED_STOCKS.find((x) => x.feedId === q.id);
            if (s && q.price > 0) next[s.ticker] = q.price;
          }
          return next;
        });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return prices;
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

function OddsDialog({ line, size, risk, onClose }: { line: Line; size: PackSize; risk: RiskTier; onClose: () => void }) {
  const total = risk.tiers.reduce((s, t) => s + t.odds, 0);
  return (
    <Dialog title={`Odds · ${size.name} · ${risk.name}`} onClose={onClose} className="w-[min(520px,calc(100%-24px))]">
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
        <p className="num mt-4 text-sm text-muted">Avg {pct(tierReturn(risk))} · {line.basket.length} stocks · simulated</p>
      </div>
    </Dialog>
  );
}

type Pull = { rarity: number; value: number; ticker: string; shares: number };

function drawRarity(r: RiskTier) {
  let roll = Math.random() * r.tiers.reduce((s, t) => s + t.odds, 0);
  const i = r.tiers.findIndex((t) => (roll -= t.odds) < 0);
  return i === -1 ? 0 : i;
}

function RevealDialog({ line, size, risk, count, prices, onClose }: { line: Line; size: PackSize; risk: RiskTier; count: number; prices: Record<string, number>; onClose: () => void }) {
  const [left, setLeft] = useState(count);
  const [phase, setPhase] = useState<"ready" | "opening" | "revealed">("ready");
  const [pull, setPull] = useState<Pull | null>(null);

  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("revealed"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100);
    return () => clearTimeout(t);
  }, [phase]);

  function open() {
    if (left < 1) return;
    const rarity = drawRarity(risk);
    const value = size.price * risk.tiers[rarity].mult;
    const ticker = drawStock(line.basket);
    const price = prices[ticker];
    const shares = price ? value / price : 0;
    setPull({ rarity, value, ticker, shares });
    // Simulated: the card goes into this browser's collection.
    addCard({ coin: line.slug, coinName: line.name, size: size.id, set: cardSet(line, size, rarity), ticker, rarity, usd: value, shares });
    setLeft((n) => n - 1);
    setPhase("opening");
  }

  return (
    <Dialog title={`${size.name} · ${risk.name} · simulated`} onClose={onClose} className="w-[min(440px,calc(100%-32px))]">
      <div className="relative isolate grid min-h-[220px] place-items-center overflow-hidden bg-surface-muted py-4 phone:min-h-[260px] phone:py-5" aria-hidden="true">
        {phase === "revealed" && pull ? (
          <div className="w-[140px] animate-[card-unveil_.65s_ease-out_both] phone:w-[160px]">
            <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px] shadow-[0_12px_24px_-12px_rgba(0,0,0,.4)]">
              <StockCardFront art={coinCardArt(line.coin, { coin: line.slug, ticker: pull.ticker, rarity: pull.rarity, set: cardSet(line, size, pull.rarity) })} rarity={pull.rarity} brand={line.name} decorative sizes="160px" className="w-full" />
              <Holo rarity={pull.rarity} />
              <span className="holo-glare" aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div className={cn("w-[190px] [zoom:0.62] phone:[zoom:0.72]", phase === "opening" && "animate-[pack-shake_.18s_ease-in-out_5_alternate,pack-fade_.3s_.9s_forwards]")}>
            <ClassicPack size={size} coin={line.coin} />
          </div>
        )}
        <span className="absolute -z-10 size-[220px] rounded-full bg-[radial-gradient(circle,#ffffff22,transparent_70%)]" />
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] phone:p-5">
        <div role="status" aria-live="polite">
          <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">
            {phase === "ready" ? `${left} ${left === 1 ? "pack" : "packs"} ready` : phase === "opening" ? "Opening…" : <span className="capitalize">{RARITIES[pull!.rarity]}</span>}
          </h2>
          {phase === "revealed" && pull && <p className="num mt-1 text-sm text-muted">Holds {usd(pull.value)} · {amount(pull.shares, 4)} {pull.ticker}</p>}
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

export function ClassicPackShop({ initialSize, collection }: { initialSize?: string; collection?: MarketCoin }) {
  const demo = useDemo();
  const prices = useStockPrices();
  const line = lineOf(collection);
  const { sizes, risks } = line;

  const startAt = sizes.findIndex((s) => s.id === initialSize);
  const [index, setIndex] = useState(startAt >= 0 ? startAt : Math.min(1, sizes.length - 1));
  const [prevIndex, setPrevIndex] = useState(index);
  // Hold and drag a pack sideways to change it; a tap opens the odds.
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const [riskId, setRiskId] = useState<RiskId>("low");
  const [quantity, setQuantity] = useState(1);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const [bought, setBought] = useState<{ count: number; key: number } | null>(null);
  const tiltPack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/bnb").then((r) => r.json())
      .then((d) => setBnbUsd(typeof d.price === "number" && d.price > 0 ? d.price : FALLBACK_BNB_USD))
      .catch(() => setBnbUsd(FALLBACK_BNB_USD));
  }, []);

  const size = sizes[index];
  const risk = risks.find((r) => r.id === riskId) ?? risks[0];
  const totalUsd = size.price * quantity;
  const totalBnb = bnbUsd ? totalUsd / bnbUsd : null;
  const short = demo.active && totalBnb !== null && totalBnb > demo.bnb + 1e-12;

  function buy() {
    if (totalBnb === null || !spendDemoBnb(totalBnb)) return;
    setBought({ count: quantity, key: Date.now() });
    setQuantity(1);
  }

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
                  <ClassicPack
                    size={s}
                    coin={line.coin}
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

      <div className="min-w-0 pb-8 desk:pt-[60px]" aria-live="polite">
        <div className="mb-5 desk:mb-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[22px] leading-[1.2] font-normal tracking-tight">{size.name}</h2>
            <span className="num shrink-0 text-sm text-muted">[ {String(index + 1).padStart(2, "0")} / {String(sizes.length).padStart(2, "0")} · {usd(size.price, 0)} ]</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-base text-muted">{line.name} · {line.basket.length} stocks</p>
            <button type="button" aria-haspopup="dialog" className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-base underline-offset-4 hover:underline" onClick={() => setShowOdds(true)}>
              Odds <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1.5 desk:mb-6" role="group" aria-label="Pack risk">
          {risks.map((r) => (
            <button key={r.id} type="button" aria-pressed={riskId === r.id} onClick={() => setRiskId(r.id)}
              className="flex min-h-16 min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-black aria-pressed:border-black">
              <strong className="text-base font-normal">{r.name}</strong>
              <span className="num text-[12px] leading-snug text-muted phone:text-[13px]">Avg {pct(tierReturn(r))}</span>
            </button>
          ))}
        </div>

        {/* Phones: price and Buy stick to the bottom of the screen, just above the tab bar. */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 max-desk:sticky max-desk:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[var(--gutter)] max-desk:bg-white max-desk:px-[var(--gutter)] max-desk:py-3">
          <div className="min-w-0">
            <strong className="num block truncate text-[20px] leading-none font-normal tracking-[-0.02em] phone:text-[26px]">{totalBnb === null ? "…" : amount(totalBnb, 4)} <span className="text-sm tracking-normal text-muted">BNB</span></strong>
            <p className="num mt-1.5 truncate text-[13px] text-muted">≈ {usd(totalUsd, 0)} · simulated</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {demo.active && (
              <div className="flex h-11 shrink-0 items-center rounded-md border border-border">
                <button type="button" className={stepperButton} aria-label="Fewer packs" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="size-4" /></button>
                <span className="num w-[30px] text-center text-base" aria-label="Pack quantity">{quantity}</span>
                <button type="button" className={stepperButton} aria-label="More packs" disabled={quantity >= 10} onClick={() => setQuantity((q) => Math.min(10, q + 1))}><Plus className="size-4" /></button>
              </div>
            )}
            {demo.active ? (
              <button type="button" className={cn(solid, "shrink-0 gap-2 px-4")} disabled={totalBnb === null || short} onClick={buy}>{short ? "Low balance" : "Buy"}</button>
            ) : (
              <button type="button" className={cn(solid, "shrink-0 gap-2 px-4")} onClick={startDemo}>Try the demo <ArrowUpRight className="size-4" /></button>
            )}
          </div>
        </div>
      </div>

      {showOdds && <OddsDialog line={line} size={size} risk={risk} onClose={() => setShowOdds(false)} />}
      {bought && <RevealDialog key={bought.key} line={line} size={size} risk={risk} count={bought.count} prices={prices} onClose={() => setBought(null)} />}
    </div>
  );
}
