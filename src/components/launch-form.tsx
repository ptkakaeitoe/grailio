"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ImagePlus, Paintbrush } from "lucide-react";
import { DEFAULT_SIZES, DEFAULT_UNLOCKS, updatePack, usePack, type Launchpad } from "@/lib/pack";
import { stockOf } from "@/lib/stocks";
import { RISK_RULES } from "@/lib/risk";
import { usd } from "@/lib/format";
import { cleanButton, cleanField, cleanPanel, cn } from "@/components/clean-ui";

/*
 * Launch a coin with the pack vault attached: name, ticker, picture, launchpad, and the pack settings from Pack studio.
 * The launch itself is simulated until the Flap Launcher and OpenFour integrations are on BSC testnet;
 * submitting saves the name, ticker and launchpad to the local pack draft so the rest of the app uses them.
 * The coin picture stays in this page only (shown in the preview) until there is somewhere to upload it.
 */

const PADS: { id: Launchpad; name: string; line: string }[] = [
  { id: "flap", name: "Flap", line: "Pool Launch, straight into a DEX pool" },
  { id: "four", name: "Four.meme", line: "Through OpenFour" },
];

const NAME_MAX = 32;
const PIC_MAX_MB = 2;
const PIC_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const TICKER_MAX = 10;
/** Inputs: 48px tall and 16px text on phones (no iOS zoom on focus), graily's 44px from 801px. */
const field = cn(cleanField, "h-12 placeholder:text-muted desk:h-11");
/** Graily's form labels: small and muted above the control. */
const label = "mb-1.5 block text-sm text-muted";
const hint = "mt-1.5 text-[13px] text-muted";
/** A boxed choice like graily's risk picker: the chosen one gets the light border. */
const option = "flex min-h-14 min-w-0 flex-col justify-center gap-0.5 rounded-md border border-border px-4 py-3 text-left transition-colors hover:border-border-strong aria-pressed:border-black";
const smallButton = cn(cleanButton.small, "min-h-11 desk:min-h-10");
/** Hairline-separated rows inside a bordered box. */
const row = "flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3";

const cleanTicker = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TICKER_MAX);

export function LaunchForm() {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [pad, setPad] = useState<Launchpad>("flap");
  const pack = usePack();
  const sizes = pack.sizes?.length ? pack.sizes : DEFAULT_SIZES;
  const unlocks = pack.unlocks ?? DEFAULT_UNLOCKS;
  const [done, setDone] = useState(false);
  const [pic, setPic] = useState<string | null>(null);
  const [picError, setPicError] = useState("");
  const picInput = useRef<HTMLInputElement>(null);

  // Object URLs hold the file in memory: free the old one when it's replaced or the page closes.
  useEffect(() => () => { if (pic) URL.revokeObjectURL(pic); }, [pic]);

  function choosePic(file: File | undefined) {
    if (!file) return;
    if (!PIC_TYPES.includes(file.type)) { setPicError("Use a PNG, JPG, WebP or GIF."); return; }
    if (file.size > PIC_MAX_MB * 1024 * 1024) { setPicError(`Keep it under ${PIC_MAX_MB} MB.`); return; }
    setPicError("");
    setPic(URL.createObjectURL(file));
    setDone(false);
  }

  function removePic() {
    setPic(null);
    setPicError("");
    if (picInput.current) picInput.current.value = "";
    setDone(false);
  }

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && ticker.length >= 2;
  const padName = PADS.find((p) => p.id === pad)!.name;

  function launch(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    updatePack({ name: trimmed, ticker, launchpad: pad });
    setDone(true);
  }

  return (
    <div>
      {/* Graily's tool-page opener (like "List a card"): the title left, a bracketed note top right. */}
      <header>
        <div className="flex items-baseline justify-between gap-3">
          <h1 id="launch-title" className="min-w-0 text-[28px] leading-[1.15] font-normal tracking-[-0.02em] phone:text-[36px]">Launch a coin</h1>
          <span className="shrink-0 text-sm text-muted">[ bsc testnet ]</span>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 border-t border-border desk:mt-10 desk:grid-cols-[minmax(0,1fr)_360px] wide:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={launch} className="flex min-w-0 flex-col gap-8 py-8 desk:pr-8" aria-labelledby="launch-title">
          <div>
            <span className={label} id="pic-label">Picture</span>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => picInput.current?.click()} aria-labelledby="pic-label"
                className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-muted text-muted transition-colors hover:border-black hover:text-black">
                {pic ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL of the chosen file
                  <img src={pic} alt="" className="size-full object-cover" />
                ) : <ImagePlus className="size-6" />}
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => picInput.current?.click()} className={smallButton}>
                    {pic ? "Change picture" : "Upload picture"}
                  </button>
                  {pic && <button type="button" onClick={removePic} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted transition-colors hover:text-black desk:min-h-10">Remove</button>}
                </div>
                <p className={cn(hint, picError && "text-down")} role={picError ? "alert" : undefined}>
                  {picError || `Square works best. PNG, JPG, WebP or GIF, up to ${PIC_MAX_MB} MB.`}
                </p>
              </div>
              <input ref={picInput} type="file" accept={PIC_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(e) => choosePic(e.target.files?.[0])} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 phone:grid-cols-[minmax(0,1fr)_180px]">
            <div className="min-w-0">
              <label htmlFor="coin-name" className={label}>Name</label>
              <input id="coin-name" className={field} value={name} maxLength={NAME_MAX} placeholder="e.g. Moon Cats" autoComplete="off"
                onChange={(e) => { setName(e.target.value); setDone(false); }} />
            </div>
            <div className="min-w-0">
              <label htmlFor="coin-ticker" className={label}>Ticker</label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted">$</span>
                <input id="coin-ticker" className={cn(field, "pl-7 uppercase")} value={ticker} placeholder="CATS" autoComplete="off" spellCheck={false}
                  aria-describedby="ticker-hint" onChange={(e) => { setTicker(cleanTicker(e.target.value)); setDone(false); }} />
              </div>
              <p id="ticker-hint" className={hint}>2–{TICKER_MAX} letters or numbers</p>
            </div>
          </div>

          <fieldset className="min-w-0">
            <legend className={label}>Launchpad</legend>
            <div className="grid grid-cols-1 gap-1.5 phone:grid-cols-2">
              {PADS.map((p) => (
                <button key={p.id} type="button" aria-pressed={pad === p.id} onClick={() => { setPad(p.id); setDone(false); }} className={option}>
                  <strong className="text-base font-normal">{p.name}</strong>
                  <span className="text-[13px] text-muted">{p.line}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <section className="min-w-0" aria-labelledby="vault-label">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="vault-label" className="text-sm font-normal text-muted">Pack vault</h2>
              <Link href="/studio" target="_blank" rel="noopener" className="-my-2.5 inline-flex min-h-11 items-center gap-1.5 text-sm text-black underline-offset-4 hover:underline">
                <Paintbrush className="size-3.5" /> Edit in Pack studio <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <dl className="divide-y divide-border rounded-md border border-border px-4 text-sm">
              <div className={row}>
                <dt className="text-muted">Basket</dt>
                <dd className="min-w-0 break-words">{pack.basket.map((b) => `${stockOf(b.ticker)?.name ?? b.ticker} ${b.weight}%`).join(" · ")}</dd>
              </div>
              <div className={row}>
                <dt className="text-muted">Pack sizes</dt>
                <dd className="min-w-0">{sizes.map((z) => `${z.name} ${usd(z.price, 0)}`).join(" · ")}</dd>
              </div>
              <div className={row}>
                <dt className="text-muted">Trading tax</dt>
                <dd className="min-w-0">{pack.buyTax}% buy · {pack.sellTax}% sell</dd>
              </div>
              <div className={row}>
                <dt className="text-muted">Tiers</dt>
                <dd className="min-w-0">Low from day one · Medium at {usd(unlocks.medium, 0)} pool · High at {usd(unlocks.high, 0)}</dd>
              </div>
              <div className={row}>
                <dt className="text-muted">Risk check</dt>
                <dd className="min-w-0">Cournot · High pauses at {Math.round(RISK_RULES.pauseHigh * 100)}%, Medium at {Math.round(RISK_RULES.pauseMedium * 100)}%</dd>
              </div>
            </dl>
          </section>

          {/* Phones: the note sits above, and the Launch button sticks just above the tab bar while the form scrolls. */}
          <p className="-mb-4 border-t border-border pt-6 text-[13px] text-muted desk:hidden">Simulated · BSC testnet</p>
          <div className="flex items-center justify-between gap-4 desk:border-t desk:border-border desk:pt-6 max-desk:sticky max-desk:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[var(--gutter)] max-desk:-mb-8 max-desk:bg-white max-desk:px-[var(--gutter)] max-desk:py-3">
            <p className="text-[13px] text-muted max-desk:hidden">Simulated · BSC testnet</p>
            <button type="submit" className={cn(cleanButton.solid, "shrink-0 justify-between px-5 max-desk:w-full")} disabled={!ready}>Launch on {padName} <ArrowUpRight className="size-4" /></button>
          </div>
        </form>

        <aside className="border-border py-8 max-desk:border-t desk:border-l desk:pl-8" aria-label="Preview">
          <div className="flex flex-col gap-4 desk:sticky desk:top-[calc(var(--header-h)+24px)]">
            <div className={cn(cleanPanel, "p-5 phone:p-6")}>
              <div className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-black text-[24px] tracking-[-0.02em] text-white">
                  {pic ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL of the chosen file
                    <img src={pic} alt={`${trimmed || "Coin"} picture`} className="size-full object-cover" />
                  ) : (trimmed[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[26px] leading-[1.15] tracking-[-0.02em]">{trimmed || "Your coin"}</p>
                  <p className="truncate text-sm text-muted">{ticker ? `$${ticker}` : "$TICKER"} · {padName}</p>
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
                <dt className="text-muted">Network</dt><dd className="text-right">BSC testnet</dd>
                <dt className="text-muted">Presale</dt><dd className="text-right">None</dd>
                <dt className="text-muted">Packs</dt><dd className="text-right">{sizes.length} sizes · Low on sale at launch</dd>
              </dl>
            </div>

            {done && (
              <div className="rounded-md border border-black p-5" role="status">
                <p className="flex items-center gap-2 text-base"><Check className="size-4" /> Ready to launch</p>
                <p className="mt-1 text-sm text-muted">
                  {trimmed} would launch on {padName} with its pack vault. This is simulated: the testnet launch isn&apos;t connected yet. The name and ticker are saved for the rest of the app.
                </p>
                <Link href="/app/packs" className="-mb-2 mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-black underline-offset-4 hover:underline">Browse packs <ArrowUpRight className="size-4" /></Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
