"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, ImagePlus, RotateCcw, Scale, Shuffle, X } from "lucide-react";
import { PackArt, PackCard } from "@/components/pack-art";
import {
  CARD_ARTS, type CardDesign,
  BASKET_PRESETS, RARITIES, RARITY_DOT, TIER_PRESETS, TONES, balance, contents, evenSplit, expectedMult, oddsTotal,
  packPrice, problems, resetPack, setWeight, simulate, updatePack, usePack, type Currency, type Pattern, type PackConfig,
} from "@/lib/pack";
import { PRICED_STOCKS, STOCKS, stockOf } from "@/lib/stocks";
import { amount, usd } from "@/lib/format";
import { cleanButton, cleanChip, cleanField, cleanPanel, cn } from "@/components/clean-ui";
import { StockLogo } from "@/components/stock-logo";
import { compactUsd, useCmc } from "@/lib/use-cmc";

const MAX_STOCKS = 6;
const COLLAPSED = 30;
const TAXES = [1, 2, 3, 5, 10];
const PATTERNS: Pattern[] = ["stripes", "dots", "grid", "plain"];
const VOLUMES = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000];

/*
 * Graily's look: bracketed labels in the text font, two-tone headings, rounded-md bordered boxes. Mobile first: every
 * control is at least 44px tall on phones and inputs use 16px text (no iOS zoom on focus); desktop tightens a little.
 */
/** Filters and presets: graily's toggle chip, the pressed one filled. */
const chip = cn(cleanChip, "inline-flex min-h-11 shrink-0 items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border desk:min-h-9");
/** Settings choices: a boxed option like graily's risk picker, the chosen one outlined in ink. */
const option = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm transition-colors hover:border-border-strong aria-pressed:border-black aria-pressed:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35";
const field = cn(cleanField, "h-12 desk:h-11");
/** Number inputs in tight columns: no spinners, so the value has the room. */
const numField = cn(cleanField, "num px-2.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none");
const ghost = cn(cleanButton.small, "min-h-11 shrink-0 border-border-strong desk:min-h-10");
const iconButton = "grid size-12 shrink-0 place-items-center rounded-md border-[1.5px] border-border-strong text-black transition-colors hover:border-black hover:bg-black hover:text-white";
const subLabel = "mb-2 block text-sm text-muted";
const range = "range h-11 cursor-pointer desk:h-8";
const box = "overflow-hidden rounded-md border border-border";

/** Section opener: a thin rule, the bracketed step label on the left, a two-tone heading and intro beside it. */
function Section({ n, label, title, sub, intro, children }: { n: number; label: string; title: string; sub: string; intro: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-6 pb-10 desk:pb-14">
      <div className="mb-7 grid grid-cols-1 gap-3 desk:grid-cols-[132px_minmax(0,1fr)] desk:gap-6">
        <p className="text-sm text-black">[ {String(n).padStart(2, "0")} / {label} ]</p>
        <div>
          <h2 className="text-[26px] leading-[1.15] font-normal tracking-[-0.02em] phone:text-[32px]">
            {title}
            <br />
            <span className="text-muted">{sub}</span>
          </h2>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-muted">{intro}</p>
        </div>
      </div>
      <div className="min-w-0 desk:pl-[156px]">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

export function Studio() {
  const c = usePack();
  const [rarity, setRarity] = useState(2);
  const [stockQuery, setStockQuery] = useState("");
  const [stockKind, setStockKind] = useState<"all" | "stock" | "etf">("all");
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [byVolume, setByVolume] = useState(false);
  const cmc = useCmc();
  // Live preset: the four most traded bStocks on CoinMarketCap (24h volume) that Atlas can price.
  const mostTraded = PRICED_STOCKS.map((s) => ({ s, v: cmc.byTicker.get(s.ticker)?.volume24h ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 4).map((x) => x.s.ticker);
  const [serial, setSerial] = useState(1);
  const [cardError, setCardError] = useState<string | null>(null);
  const cardFileRef = useRef<HTMLInputElement>(null);
  const [volume, setVolume] = useState(3);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bnbUsd, setBnbUsd] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/bnb").then((r) => r.json()).then((j) => { if (alive && typeof j.price === "number") setBnbUsd(j.price); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const issues = problems(c);
  const picked = new Set(c.basket.map((b) => b.ticker));
  const sim = simulate(c, VOLUMES[volume]);
  const inside = contents(c, rarity);

  const toggleStock = (ticker: string) => {
    const next = picked.has(ticker) ? c.basket.filter((b) => b.ticker !== ticker).map((b) => b.ticker) : [...c.basket.map((b) => b.ticker), ticker];
    if (next.length > MAX_STOCKS) return;
    updatePack({ basket: next.length ? evenSplit(next) : [] });
  };

  const setSale = (patch: Partial<PackConfig["sale"]>) => updatePack((p) => ({ sale: { ...p.sale, ...patch } }));
  const toggleCurrency = (cur: Currency) =>
    setSale({ currencies: c.sale.currencies.includes(cur) ? c.sale.currencies.filter((x) => x !== cur) : [...c.sale.currencies, cur] });

  const setTier = (i: number, patch: Partial<PackConfig["tiers"][number]>) =>
    updatePack((p) => ({ tiers: p.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const setCard = (i: number, patch: Partial<CardDesign>) =>
    updatePack((p) => ({ cards: p.cards.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));

  const onCardImage = (file: File | undefined) => {
    setCardError(null);
    if (!file) return;
    if (file.size > 2_000_000) return setCardError("Pick an image under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => setCard(rarity, { image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const onImage = (file: File | undefined) => {
    setImageError(null);
    if (!file) return;
    if (file.size > 2_000_000) return setImageError("Pick an image under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => updatePack({ image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const previewOpen = () => {
    setOpening(true);
    // Draw a rarity with the configured odds, like the VRF will.
    let roll = Math.random() * oddsTotal(c.tiers);
    const hit = c.tiers.findIndex((t) => (roll -= t.odds) < 0);
    const nextSerial = 1 + Math.floor(Math.random() * 9999);
    setTimeout(() => { setOpening(false); setRarity(hit === -1 ? 0 : hit); setSerial(nextSerial); }, 900);
  };

  const copyConfig = async () => {
    const { image, ...rest } = c;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ...rest, image: image ? "(uploaded)" : null }, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };


  return (
    <div className="grid grid-cols-1 gap-10 wide:grid-cols-[minmax(0,1fr)_400px] wide:gap-12">
      <div className="min-w-0">
        <Section n={1} label="basket" title="Pick the stocks." sub="Fees buy them in this mix." intro="Trading fees buy these, in this mix. Up to six per pack, from every bStock live on BNB Chain. Greyed-out ones have no Atlas price yet, so the vault can't buy them.">
          <div className="mb-5 flex flex-wrap gap-1.5">
            {BASKET_PRESETS.map((p) => (
              <button key={p.id} className={chip} aria-pressed={JSON.stringify(p.basket) === JSON.stringify(c.basket)} onClick={() => updatePack({ basket: p.basket })}>{p.name}</button>
            ))}
            <button className={chip} disabled={!cmc.snap} onClick={() => updatePack({ basket: evenSplit(mostTraded) })} title="Top 4 bStocks by 24h volume on CoinMarketCap, right now">
              Most traded <span className="opacity-60">· CMC live</span>
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <input className={cn(field, "w-full uppercase placeholder:text-muted placeholder:normal-case phone:w-[240px]")} placeholder="Search bStocks" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} aria-label="Search bStocks" />
            <button className={chip} aria-pressed={byVolume} disabled={!cmc.snap} onClick={() => setByVolume((v) => !v)} title="Sort by 24h volume on CoinMarketCap">By volume</button>
            {([["all", "All"], ["stock", "Stocks"], ["etf", "ETFs"]] as const).map(([id, label]) => (
              <button key={id} className={chip} aria-pressed={stockKind === id} onClick={() => setStockKind(id)}>{label}</button>
            ))}
          </div>
          <p className="mb-4 text-[13px] text-muted">{STOCKS.length} live on BSC · {PRICED_STOCKS.length} priced by Atlas</p>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const q = stockQuery.trim().toUpperCase();
              const filtered = STOCKS.filter((s) => (stockKind === "all" || s.kind === stockKind) && (!q || s.ticker.includes(q) || s.name.toUpperCase().includes(q)));
              const list = byVolume ? [...filtered].sort((a, b) => (cmc.byTicker.get(b.ticker)?.volume24h ?? -1) - (cmc.byTicker.get(a.ticker)?.volume24h ?? -1)) : filtered;
              const shown = q || showAllStocks ? list : list.slice(0, COLLAPSED);
              return (
                <>
                  {shown.map((s) => {
                    const on = picked.has(s.ticker);
                    const priced = s.feedId !== null;
                    return (
                      <button key={s.ticker} aria-pressed={on} disabled={!on && (!priced || c.basket.length >= MAX_STOCKS)} onClick={() => toggleStock(s.ticker)}
                        className={cn(chip, "px-2.5")} title={priced ? `${s.name} · ${s.symbol}` : `${s.name}: no Atlas price feed yet, so the vault can't buy it`}>
                        <StockLogo ticker={s.ticker} size={18} />
                        <span>{s.ticker}</span>
                      </button>
                    );
                  })}
                  {!q && list.length > COLLAPSED && (
                    <button className={cn(chip, "text-muted")} onClick={() => setShowAllStocks((v) => !v)}>
                      {showAllStocks ? "Show fewer" : `+${list.length - COLLAPSED} more`}
                    </button>
                  )}
                  {shown.length === 0 && <span className="py-2 text-sm text-muted">No bStock matches.</span>}
                </>
              );
            })()}
          </div>

          {c.basket.length > 0 && (
            <div className={cn(box, "mt-6")}>
              {c.basket.map((b) => {
                const s = stockOf(b.ticker);
                return (
                  <div key={b.ticker} className="grid grid-cols-[minmax(0,1fr)_56px_44px] items-center gap-x-2 gap-y-1 border-b border-border py-3 pr-2 pl-4 last:border-b-0 desk:grid-cols-[minmax(0,150px)_1fr_64px_40px] desk:gap-x-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium"><StockLogo ticker={s.ticker} size={20} />{s.ticker}</p>
                      <p className="truncate text-[13px] text-muted">{s.name} · {s.price ? usd(s.price) : "no Atlas price"}</p>
                      {cmc.byTicker.get(s.ticker) && (() => {
                        const m = cmc.byTicker.get(s.ticker)!;
                        return (
                          <p className="num truncate text-[11px] text-muted" title="CoinMarketCap, live">
                            CMC vol {compactUsd(m.volume24h)} · mcap {compactUsd(m.marketCap)}
                            {m.change24h != null && <span className={m.change24h >= 0 ? " text-up" : " text-down"}> · {m.change24h > 0 ? "+" : ""}{m.change24h.toFixed(1)}%</span>}
                          </p>
                        );
                      })()}
                    </div>
                    <input type="range" className={cn(range, "order-last col-span-3 desk:order-none desk:col-span-1")} min={1} max={100} value={b.weight} disabled={c.basket.length === 1}
                      aria-label={`${s.ticker} weight`} onChange={(e) => updatePack({ basket: setWeight(c.basket, b.ticker, +e.target.value) })} />
                    <span className="num text-right text-base">{b.weight}%</span>
                    <button className="grid size-11 place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-black desk:size-10" aria-label={`Remove ${s.ticker}`} onClick={() => toggleStock(b.ticker)}><X className="size-4" /></button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-3 bg-surface-muted py-1 pr-2 pl-4 text-sm">
                <div className="flex h-2 w-40 min-w-0 overflow-hidden rounded-full" aria-hidden>
                  {c.basket.map((b) => <span key={b.ticker} style={{ width: `${b.weight}%`, background: stockOf(b.ticker).accent }} />)}
                </div>
                <button className="inline-flex min-h-11 items-center px-2 text-black underline-offset-4 hover:underline" onClick={() => updatePack({ basket: evenSplit(c.basket.map((b) => b.ticker)) })}>Even split</button>
              </div>
            </div>
          )}
        </Section>

        <Section n={2} label="look" title="Design the pack." sub="The sleeve holders open." intro="Name it after the memecoin. Holders see this sleeve before they open it.">
          <div className="grid grid-cols-1 gap-4 phone:grid-cols-[minmax(0,1fr)_160px]">
            <Field label="Pack name"><input className={field} value={c.name} maxLength={28} onChange={(e) => updatePack({ name: e.target.value })} /></Field>
            <Field label="Memecoin ticker"><input className={cn(field, "uppercase")} value={c.ticker} maxLength={10} onChange={(e) => updatePack({ ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></Field>
          </div>
          <div className="mt-4"><Field label="Tagline"><input className={field} value={c.tagline} maxLength={40} onChange={(e) => updatePack({ tagline: e.target.value })} /></Field></div>

          <div className="mt-6 grid grid-cols-1 gap-6 phone:grid-cols-2">
            <div>
              <p className={subLabel}>Color</p>
              <div className="flex flex-wrap items-center gap-2">
                {TONES.map((t) => (
                  <button key={t} aria-label={`Color ${t}`} aria-pressed={c.tone === t} onClick={() => updatePack({ tone: t })}
                    className={cn("size-11 rounded-full border-2 transition-transform desk:size-9", c.tone === t ? "scale-110 border-black" : "border-white ring-1 ring-border-strong")} style={{ background: t }} />
                ))}
                <label className="relative grid size-11 cursor-pointer place-items-center rounded-full border border-dashed border-border-strong text-sm text-muted transition-colors hover:border-black hover:text-black desk:size-9" title="Custom color">
                  <input type="color" value={c.tone} onChange={(e) => updatePack({ tone: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" />+
                </label>
              </div>
            </div>
            <div>
              <p className={subLabel}>Pattern</p>
              <div className="grid grid-cols-4 gap-1.5">
                {PATTERNS.map((p) => <button key={p} className={cn(option, "px-1 capitalize")} aria-pressed={!c.image && c.pattern === p} onClick={() => updatePack({ pattern: p, image: null })}>{p}</button>)}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
            <button className={ghost} onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" /> {c.image ? "Replace cover" : "Upload cover art"}</button>
            {c.image && <button className={ghost} onClick={() => updatePack({ image: null })}>Remove cover</button>}
            <span className={cn("basis-full text-[13px] phone:basis-auto", imageError ? "text-down" : "text-muted")}>{imageError ?? "Optional. Replaces the pattern; goes to IPFS at launch."}</span>
          </div>
        </Section>

        <Section n={3} label="cards" title="Design the cards." sub="One for each rarity." intro="Each rarity gets its own card: name, color and art. Every card also has a serial number that shifts its art, so no two cards look exactly alike.">
          <div className="grid grid-cols-2 gap-3 phone:grid-cols-4">
            {RARITIES.map((r, i) => (
              <button key={r} onClick={() => setRarity(i)} aria-pressed={rarity === i} aria-label={`Edit ${r} card`}
                className={cn("min-w-0 rounded-lg border-[1.5px] p-2 text-left transition-colors", rarity === i ? "border-black" : "border-border hover:border-border-strong")}>
                <PackCard c={c} rarity={r} value={c.packValue * c.tiers[i].mult} serial={serial} />
                <span className={cn("mt-2 flex items-center justify-center gap-1.5 text-sm capitalize", rarity === i ? "text-black" : "text-muted")}>
                  <i className="size-1.5 rounded-full" style={{ background: RARITY_DOT[r] }} aria-hidden />{r}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-border p-4 phone:p-5">
            <p className="mb-4 text-sm text-muted">Editing the <span className="text-black capitalize">{RARITIES[rarity]}</span> card</p>
            <div className="grid grid-cols-1 gap-4 phone:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Card name"><input className={field} value={c.cards[rarity].title} maxLength={16} onChange={(e) => setCard(rarity, { title: e.target.value })} /></Field>
              <div>
                <p className="mb-1.5 text-sm text-muted">Color</p>
                <label className="relative flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 transition-colors hover:border-black desk:h-11">
                  <span className="size-6 rounded-full" style={{ background: c.cards[rarity].color }} />
                  <span className="num text-sm">{c.cards[rarity].color}</span>
                  <input type="color" value={c.cards[rarity].color} onChange={(e) => setCard(rarity, { color: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Card color" />
                </label>
              </div>
            </div>
            <p className={cn(subLabel, "mt-5")}>Art</p>
            <div className="grid grid-cols-3 gap-1.5 phone:grid-cols-5">
              {CARD_ARTS.map((a) => <button key={a} className={cn(option, "px-1 capitalize")} aria-pressed={!c.cards[rarity].image && c.cards[rarity].art === a} onClick={() => setCard(rarity, { art: a, image: null })}>{a}</button>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <input ref={cardFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onCardImage(e.target.files?.[0])} />
              <button className={ghost} onClick={() => cardFileRef.current?.click()}><ImagePlus className="size-4" /> {c.cards[rarity].image ? "Replace card art" : "Upload card art"}</button>
              {c.cards[rarity].image && <button className={ghost} onClick={() => setCard(rarity, { image: null })}>Remove</button>}
              <span className={cn("basis-full text-[13px] phone:basis-auto", cardError ? "text-down" : "text-muted")}>{cardError ?? "Optional. Replaces the generated art for this rarity."}</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Same rarity, different serials</p>
              <button className={ghost} onClick={() => setSerial(1 + Math.floor(Math.random() * 9999))}><Shuffle className="size-4" /> Shuffle</button>
            </div>
            <div className="grid grid-cols-3 gap-3 desk:grid-cols-5">
              {[0, 1, 2, 3, 4].map((k) => (
                <PackCard key={k} c={c} rarity={RARITIES[rarity]} value={c.packValue * c.tiers[rarity].mult} serial={serial + k * 37} className={cn(k > 2 && "max-desk:hidden")} />
              ))}
            </div>
          </div>
        </Section>

        <Section n={4} label="rarity" title="Set the rarity tiers." sub="Balanced to the pack value." intro="Every pack draws a rarity. Rarer packs hold more stock, commons hold less, and on average a pack is worth exactly its value, so the vault never over- or under-spends.">
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {TIER_PRESETS.map((p) => (
              <button key={p.id} className={chip} aria-pressed={JSON.stringify(p.tiers) === JSON.stringify(c.tiers)} onClick={() => updatePack({ tiers: p.tiers })}>
                {p.name} <span className="opacity-60">· {p.blurb}</span>
              </button>
            ))}
          </div>
          <div className={box}>
            <div className="grid grid-cols-[minmax(0,1fr)_60px_76px_64px] gap-2 bg-surface-muted px-3 py-2 text-[13px] text-muted phone:px-4 desk:grid-cols-[1fr_96px_96px_88px] desk:gap-3">
              <span>Rarity</span><span>Odds %</span><span>Value ×</span><span className="text-right">Holds</span>
            </div>
            {RARITIES.map((r, i) => (
              <div key={r} className="grid grid-cols-[minmax(0,1fr)_60px_76px_64px] items-center gap-2 border-t border-border px-3 py-2 phone:px-4 desk:grid-cols-[1fr_96px_96px_88px] desk:gap-3">
                <button className="flex min-h-11 min-w-0 items-center gap-2 text-left text-sm capitalize" onClick={() => setRarity(i)}>
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: RARITY_DOT[r] }} aria-hidden /><span className="truncate">{r}</span>
                </button>
                <input type="number" className={numField} min={0} max={100} step={0.5} value={c.tiers[i].odds} aria-label={`${r} odds`} onChange={(e) => setTier(i, { odds: Math.max(0, +e.target.value) })} />
                <input type="number" className={numField} min={0} step={0.05} value={c.tiers[i].mult} aria-label={`${r} multiplier`} onChange={(e) => setTier(i, { mult: Math.max(0, +e.target.value) })} />
                <span className="num text-right text-[13px] desk:text-sm">{usd(c.packValue * c.tiers[i].mult)}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-surface-muted py-2 pr-2 pl-3 text-sm phone:pl-4">
              <span className={cn("num", Math.abs(oddsTotal(c.tiers) - 100) > 0.01 ? "text-down" : "text-muted")}>Odds {oddsTotal(c.tiers)}%</span>
              <span className={cn("num", Math.abs(expectedMult(c.tiers) - 1) > 0.01 ? "text-down" : "text-muted")}>Average {expectedMult(c.tiers).toFixed(3)}×</span>
              <button className={ghost} onClick={() => updatePack({ tiers: balance(c.tiers) })}><Scale className="size-4" /> Balance</button>
            </div>
          </div>
          <div className="mt-5 max-w-[260px]">
            <Field label="Pack value (USD)" hint="What an average pack holds. Each drop makes vault ÷ value packs.">
              <input type="number" className={cn(field, "num")} min={1} step={1} value={c.packValue} onChange={(e) => updatePack({ packValue: Math.max(0, +e.target.value) })} />
            </Field>
          </div>
        </Section>

        <Section n={5} label="fees & drops" title="Fund the packs." sub="Trading tax fills the vault." intro="The memecoin's trading tax fills the vault. When a drop triggers, the vault buys the basket, seals packs and sends them to holders by balance.">
          <p className={subLabel}>Launch on</p>
          <div className="mb-6 grid grid-cols-1 gap-1.5 phone:grid-cols-2">
            {([["flap", "Flap · Pool Launch"], ["four", "Four.meme · OpenFour"]] as const).map(([id, label]) => (
              <button key={id} className={cn(option, "min-h-12 justify-start px-4 text-base")} aria-pressed={c.launchpad === id} onClick={() => updatePack({ launchpad: id })}>{label}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 phone:grid-cols-2">
            {(["buyTax", "sellTax"] as const).map((k) => (
              <div key={k}>
                <p className={subLabel}>{k === "buyTax" ? "Buy tax" : "Sell tax"}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {TAXES.map((t) => <button key={t} className={cn(option, "num px-1")} aria-pressed={c[k] === t} onClick={() => updatePack({ [k]: t })}>{t}%</button>)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">Tax split</span>
              <span className="num"><span className="text-black">{c.stockShare}%</span> <span className="text-muted">stocks · {100 - c.stockShare}% creator</span></span>
            </div>
            <input type="range" className={range} min={50} max={100} step={5} value={c.stockShare} aria-label="Share of tax that buys stocks" onChange={(e) => updatePack({ stockShare: +e.target.value })} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 phone:grid-cols-2">
            <div className="min-w-0">
              <p className={subLabel}>Drop packs</p>
              <div className="flex flex-wrap gap-1.5">
                <button className={option} aria-pressed={c.trigger.kind === "vault"} onClick={() => updatePack({ trigger: { kind: "vault", usd: 500 } })}>When vault hits $</button>
                <button className={option} aria-pressed={c.trigger.kind === "daily"} onClick={() => updatePack({ trigger: { kind: "daily" } })}>Daily</button>
                <button className={option} aria-pressed={c.trigger.kind === "weekly"} onClick={() => updatePack({ trigger: { kind: "weekly" } })}>Weekly</button>
              </div>
              {c.trigger.kind === "vault" && (
                <input type="number" className={cn(field, "num mt-3 max-w-[200px]")} min={c.packValue} step={50} value={c.trigger.usd} aria-label="Vault threshold in USD"
                  onChange={(e) => updatePack({ trigger: { kind: "vault", usd: Math.max(0, +e.target.value) } })} />
              )}
            </div>
            <Field label="Minimum holding to qualify" hint="Tokens a wallet must hold at the snapshot.">
              <input type="number" className={cn(field, "num")} min={0} step={1000} value={c.minHolding} onChange={(e) => updatePack({ minHolding: Math.max(0, +e.target.value) })} />
            </Field>
          </div>
        </Section>

        <Section n={6} label="sale" title="Sell packs too." sub="Every sold pack is fully backed." intro="Besides the free drops to holders, anyone can buy a pack. The payment buys the same basket, so every sold pack is fully backed; the premium is the margin.">
          <label className="mb-6 flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-4 text-base transition-colors hover:border-border-strong has-[:checked]:border-black">
            <input type="checkbox" className="size-5 accent-[var(--ink)]" checked={c.sale.enabled} onChange={(e) => setSale({ enabled: e.target.checked })} />
            Open pack sales
          </label>
          {c.sale.enabled && (
            <>
              <p className={subLabel}>Accept</p>
              <div className="mb-6 grid grid-cols-2 gap-1.5 phone:max-w-[360px]">
                <button className={option} aria-pressed={c.sale.currencies.includes("bnb")} onClick={() => toggleCurrency("bnb")}>BNB</button>
                <button className={cn(option, "truncate")} aria-pressed={c.sale.currencies.includes("token")} onClick={() => toggleCurrency("token")}>${c.ticker || "TOKEN"}</button>
              </div>
              <div className="grid grid-cols-1 gap-6 phone:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted">Premium on top of pack value</span><span className="num">{c.sale.premium}%</span></div>
                  <input type="range" className={range} min={0} max={30} step={1} value={c.sale.premium} aria-label="Premium" onChange={(e) => setSale({ premium: +e.target.value })} />
                </div>
                <div className={cn(!c.sale.currencies.includes("token") && "opacity-40")}>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 text-muted">Discount when paying in ${c.ticker || "TOKEN"}</span><span className="num">{c.sale.tokenDiscount}%</span></div>
                  <input type="range" className={range} min={0} max={30} step={1} value={c.sale.tokenDiscount} disabled={!c.sale.currencies.includes("token")} aria-label="Token discount" onChange={(e) => setSale({ tokenDiscount: +e.target.value })} />
                </div>
              </div>
              <p className={cn(subLabel, "mt-6")}>Premium goes to</p>
              <div className="grid grid-cols-1 gap-1.5 phone:grid-cols-2">
                <button className={option} aria-pressed={c.sale.premiumTo === "creator"} onClick={() => setSale({ premiumTo: "creator" })}>Creator</button>
                <button className={option} aria-pressed={c.sale.premiumTo === "burn"} onClick={() => setSale({ premiumTo: "burn" })}>Buy back &amp; burn ${c.ticker || "TOKEN"}</button>
              </div>
              <p className="mt-4 max-w-[560px] text-[13px] leading-relaxed text-muted">
                Token payments are sold into the pool for BNB to buy the basket, so token buyers also add trading volume (and tax). Rarity works like drops: the vault covers the swing between a common and a legendary, which averages out because the tiers are balanced.
              </p>
            </>
          )}
        </Section>
      </div>

      {/* The summary: below the steps on phones and tablets, sticky beside them from 1201px. */}
      <aside className="min-w-0 max-wide:border-t max-wide:border-border max-wide:pt-6 wide:sticky wide:top-[calc(var(--header-h)+24px)] wide:self-start" aria-label="Pack summary">
        <div className={cn(cleanPanel, "flex flex-col gap-6 p-4 phone:p-6")}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-black">[ preview ]</p>
            <button className={ghost} disabled={opening} onClick={previewOpen}><Shuffle className="size-4" /> {opening ? "Opening…" : "Test open"}</button>
          </div>
          <div className="mx-auto grid w-full max-w-[400px] grid-cols-2 items-center gap-5">
            <PackArt c={c} shaking={opening} />
            <PackCard c={c} rarity={RARITIES[rarity]} value={c.packValue * c.tiers[rarity].mult} serial={serial} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 phone:grid-cols-4 wide:grid-cols-2" role="group" aria-label="Rarity">
            {RARITIES.map((r, i) => (
              <button key={r} className={cn(chip, "justify-center px-2 capitalize")} aria-pressed={rarity === i} onClick={() => setRarity(i)}>
                <i className="size-2 shrink-0 rounded-full" style={{ background: RARITY_DOT[r] }} aria-hidden />{r} <span className="num opacity-60">{c.tiers[i].odds}%</span>
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead><tr className="text-left text-[13px] text-muted"><th className="pb-2 font-normal">Inside a {RARITIES[rarity]} pack</th><th className="pb-2 text-right font-normal">USD</th><th className="pb-2 text-right font-normal">Shares</th></tr></thead>
            <tbody>
              {inside.map((s) => (
                <tr key={s.ticker} className="border-t border-border">
                  <td className="py-2.5"><span className="inline-flex items-center gap-2"><StockLogo ticker={s.ticker} size={18} /><span className="font-medium">{s.ticker}</span></span> <span className="text-muted">{s.weight}%</span></td>
                  <td className="num py-2.5 text-right">{usd(s.usd)}</td>
                  <td className="num py-2.5 text-right">{s.shares.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {c.sale.enabled && c.sale.currencies.length > 0 && (
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border px-4 py-3 text-sm">
              <span className="text-muted">Buy a pack</span>
              <span className="num flex flex-wrap gap-x-3">
                {c.sale.currencies.map((cur) => {
                  const p = packPrice(c, cur, bnbUsd ?? 600);
                  return <span key={cur}>{cur === "bnb" ? `${p.bnb.toFixed(4)} BNB` : `${amount(p.tokens ?? 0, 0)} $${c.ticker}`} <span className="text-muted">({usd(p.usd)})</span></span>;
                })}
              </span>
            </div>
          )}

          <div className="rounded-md bg-surface-muted p-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">If the memecoin trades</span>
              <span className="num text-base">{usd(VOLUMES[volume], 0)}</span>
            </div>
            <input type="range" className={range} min={0} max={VOLUMES.length - 1} value={volume} aria-label="Trading volume" onChange={(e) => setVolume(+e.target.value)} />
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div><dt className="text-[13px] text-muted">Fees</dt><dd className="num text-base">{usd(sim.fees, 0)}</dd></div>
              <div><dt className="text-[13px] text-muted">Buys stocks</dt><dd className="num text-base">{usd(sim.toStocks, 0)}</dd></div>
              <div><dt className="text-[13px] text-muted">Packs</dt><dd className="num text-base">{amount(sim.packs, 0)}</dd></div>
            </dl>
          </div>

          {issues.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-down">{issues.map((i) => <li key={i}>· {i}</li>)}</ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-up"><Check className="size-4" /> Ready for launch</p>
          )}

          <div className="flex gap-2">
            <Link href="/launch" className={cn(cleanButton.solid, "min-w-0 flex-1 justify-center")}>Continue to launch</Link>
            <button className={iconButton} onClick={copyConfig} aria-label="Copy config JSON">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
            <button className={iconButton} onClick={resetPack} aria-label="Reset to the example pack"><RotateCcw className="size-4" /></button>
          </div>
        </div>
      </aside>
    </div>
  );
}
