"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Search, X } from "lucide-react";
import { SealedPack } from "@/components/pack-shop";
import { StockLogo } from "@/components/stock-logo";
import { cleanButton, cleanChip, cleanField, cn } from "@/components/clean-ui";
import { publishPack } from "@/lib/published-packs";
import { showToast } from "@/lib/toast";
import { BASKET_PRESETS, DEFAULT_SIZES, TIER_PRESETS, evenSplit, resetPack, updatePack, usePack, type Launchpad } from "@/lib/pack";
import { PRICED_STOCKS, stockOf } from "@/lib/stocks";

/*
 * Pack studio, minimal, in three steps: 1 name and colour, 2 up to four bStocks, 3 risk style and launchpad.
 * A live preview stays in view; Publish lists the pack on the marketplace (in this browser).
 */

const STEPS = ["Name", "Stocks", "Risk"] as const;

const MAX_STOCKS = 4;
const TONES = ["#2f5f8f", "#3a1f5c", "#2b8a3e", "#c2255c", "#c78a5c", "#d9480f", "#0c8599", "#202020"];
const PADS: { id: Launchpad; name: string }[] = [{ id: "flap", name: "Flap" }, { id: "four", name: "Four.meme" }];
const label = "mb-2.5 block text-sm text-muted";
const option = "rounded-md border border-border px-4 py-3 text-left transition-colors hover:border-border-strong aria-pressed:border-black";

/** A short ticker from the name, kept for the launch form (never shown on cards). */
const tickerFor = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function Studio() {
  const c = usePack();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [step, setStep] = useState(0);
  const picked = new Set(c.basket.map((b) => b.ticker));
  const tier = TIER_PRESETS.find((t) => JSON.stringify(t.tiers) === JSON.stringify(c.tiers));
  const ready = c.name.trim().length > 0 && c.basket.length > 0;
  // Each step must be filled before the next one opens.
  const done = [c.name.trim().length > 0, c.basket.length > 0, true];
  const canOpen = (i: number) => done.slice(0, i).every(Boolean);
  const q = query.trim().toUpperCase();
  const results = q ? PRICED_STOCKS.filter((s) => s.ticker.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 8) : [];

  const setName = (name: string) => updatePack({ name, ticker: tickerFor(name) });
  const toggle = (ticker: string) => {
    const tickers = c.basket.map((b) => b.ticker);
    const next = picked.has(ticker) ? tickers.filter((t) => t !== ticker) : [...tickers, ticker].slice(0, MAX_STOCKS);
    updatePack({ basket: next.length ? evenSplit(next) : [] });
  };
  const publish = () => {
    const slug = publishPack({ ...c, name: c.name.trim(), sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES });
    showToast({ kind: "success", title: `${c.name.trim()} published` });
    router.push(`/app/packs/${slug}`);
  };

  return (
    <div className="grid grid-cols-1 gap-10 pb-10 desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-14">
      <div className="flex min-w-0 flex-col gap-8">
        <ol className="flex items-center gap-2" aria-label="Steps">
          {STEPS.map((name, i) => (
            <li key={name} className="flex min-w-0 flex-1 items-center gap-2">
              <button type="button" disabled={!canOpen(i)} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-muted transition-colors enabled:hover:text-black disabled:opacity-40 aria-[current=step]:text-black">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-[13px] tabular-nums", step === i ? "border-black bg-black text-white" : done[i] && i < step ? "border-black" : "border-border-strong")}>
                  {i < step && done[i] ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="truncate">{name}</span>
              </button>
              {i < STEPS.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        {step === 0 && <>
        <div>
          <label htmlFor="pack-name" className={label}>Name</label>
          <input id="pack-name" className={cn(cleanField, "h-12 text-base")} value={c.name} maxLength={28} placeholder="Moon Cats" autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <span className={label}>Colour</span>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Colour">
            {TONES.map((t) => (
              <button key={t} type="button" aria-label={`Colour ${t}`} aria-pressed={c.tone === t} onClick={() => updatePack({ tone: t })}
                className="grid size-11 place-items-center rounded-full border-2 border-transparent aria-pressed:border-black" style={{ background: t }}>
                {c.tone === t && <Check className="size-4 text-[#fff]" />}
              </button>
            ))}
          </div>
        </div>

        </>}

        {step === 1 && (
        <div>
          <span className={label}>Stocks · up to {MAX_STOCKS}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Basket presets">
            {BASKET_PRESETS.map((p) => {
              const tickers = p.basket.map((b) => b.ticker).slice(0, MAX_STOCKS);
              return (
                <button key={p.id} type="button" className={cn(cleanChip, "min-h-10")} aria-pressed={tickers.join() === c.basket.map((b) => b.ticker).join()}
                  onClick={() => updatePack({ basket: evenSplit(tickers) })}>{p.name}</button>
              );
            })}
          </div>
          {c.basket.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Picked stocks">
              {c.basket.map((b) => (
                <li key={b.ticker}>
                  <button type="button" onClick={() => toggle(b.ticker)} aria-label={`Remove ${stockOf(b.ticker)?.name ?? b.ticker}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md bg-surface-muted pr-2 pl-2.5 text-sm transition-colors hover:bg-raised-strong">
                    <StockLogo ticker={b.ticker} size={18} /> {b.ticker} <span className="text-muted tabular-nums">{b.weight}%</span> <X className="size-3.5 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="relative mt-3 block">
            <span className="sr-only">Search bStocks</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input className={cn(cleanField, "pl-10 text-base")} placeholder="Add a stock" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {results.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-md border border-border">
              {results.map((s) => (
                <li key={s.ticker}>
                  <button type="button" disabled={!picked.has(s.ticker) && c.basket.length >= MAX_STOCKS} onClick={() => { toggle(s.ticker); setQuery(""); }}
                    className="flex min-h-11 w-full items-center gap-3 border-b border-border px-3 text-left text-sm last:border-b-0 hover:bg-surface-muted disabled:opacity-40">
                    <StockLogo ticker={s.ticker} size={20} /> <span className="w-14 shrink-0">{s.ticker}</span> <span className="truncate text-muted">{s.name}</span>
                    {picked.has(s.ticker) && <Check className="ml-auto size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        )}

        {step === 2 && <>
        <div>
          <span className={label}>Risk</span>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Risk">
            {TIER_PRESETS.map((t) => (
              <button key={t.id} type="button" className={option} aria-pressed={tier?.id === t.id} onClick={() => updatePack({ tiers: t.tiers })}>
                <span className="block text-base">{t.name}</span>
                <span className="block text-sm text-muted">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Launchpad</span>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Launchpad">
            {PADS.map((p) => (
              <button key={p.id} type="button" className={option} aria-pressed={c.launchpad === p.id} onClick={() => updatePack({ launchpad: p.id })}>{p.name}</button>
            ))}
          </div>
        </div>
        </>}

        <div className="flex gap-2 border-t border-border pt-6">
          {step > 0 && (
            <button type="button" className={cn(cleanButton.outline, "justify-center")} onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" /> Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className={cn(cleanButton.solid, "flex-1 justify-center")} disabled={!done[step]} onClick={() => setStep(step + 1)}>Next <ArrowRight className="size-4" /></button>
          ) : (
            <button type="button" className={cn(cleanButton.solid, "flex-1 justify-center")} disabled={!ready} onClick={publish}>Publish pack</button>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3 desk:sticky desk:top-[calc(var(--header-h)+24px)] desk:self-start" aria-label="Preview">
        <div className="mx-auto w-[200px]">
          <SealedPack size={DEFAULT_SIZES[1]} coin={c.name.trim() || "Your pack"} color={{ bg: c.tone, ink: "#ffffff" }} />
        </div>
        <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm text-muted hover:text-black" onClick={resetPack}>
          <RotateCcw className="size-3.5" /> Start over
        </button>
      </aside>
    </div>
  );
}
