"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ArrowLeft, ArrowRight, Check, ImagePlus, RotateCcw, Search, X } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { cleanButton, cleanChip, cleanField, cn } from "@/components/clean-ui";
import { publishPack } from "@/lib/published-packs";
import { showToast } from "@/lib/toast";
import { BASKET_PRESETS, DEFAULT_SIZES, TIER_PRESETS, evenSplit, resetPack, updatePack, usePack, type Launchpad } from "@/lib/pack";
import { COIN_TONES as TONES, DesignStep, PIC_TYPES, designPatch, readPicture } from "@/components/launch-design";
import { PRICED_STOCKS, stockOf } from "@/lib/stocks";
import { appChain } from "@/lib/chain";
import { useDemo } from "@/lib/demo";
import { OPENFOUR, STOCK_ADDRESSES, coreAbi, migrateModuleAbi } from "@/lib/onchain";
import { txErrorMessage } from "@/lib/tx-error";

/*
 * Launch a coin with its pack, in three steps: 1 the coin (picture, name, ticker, colour), 2 up to four bStocks for
 * its pack, 3 design (the default pack and card art, or a custom cover and one card per rarity) and launchpad. Buyers
 * pick the Low / Medium / High risk tier per pack, so the creator doesn't. On Four.meme with a wallet connected, launching creates the coin on our
 * OpenFour testnet (the app server signs the create request for the wallet, which sends it). Flap, or demo mode, lists
 * the pack in this browser only, simulated, until Flap enables our launcher factory.
 */

const STEPS = ["Coin", "Stocks", "Design"] as const;
const MAX_STOCKS = 4;
const TICKER_MAX = 10;
const PADS: { id: Launchpad; name: string }[] = [{ id: "flap", name: "Flap" }, { id: "four", name: "Four.meme" }];
const label = "mb-2 block text-sm text-muted";
const option = "flex min-h-14 items-center gap-3 rounded-md border border-border px-4 text-left transition-colors hover:border-border-strong aria-pressed:border-black aria-pressed:bg-surface-muted";

const cleanTicker = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TICKER_MAX);

export function LaunchFlow() {
  const c = usePack();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [picError, setPicError] = useState("");
  const picInput = useRef<HTMLInputElement>(null);

  const picked = new Set(c.basket.map((b) => b.ticker));
  // Kept for the on-chain create request's style; drafts start on Classic.
  const tier = TIER_PRESETS.find((t) => JSON.stringify(t.tiers) === JSON.stringify(c.tiers));
  const name = c.name.trim();
  const done = [name.length > 0 && c.ticker.length >= 2, c.basket.length > 0, true];
  const canOpen = (i: number) => done.slice(0, i).every(Boolean);
  const q = query.trim().toUpperCase();
  const results = q ? PRICED_STOCKS.filter((s) => s.ticker.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 8) : [];

  async function choosePic(file: File | undefined) {
    if (!file) return;
    const res = await readPicture(file, 128, 128, 0.85);
    if ("error" in res) { setPicError(res.error); return; }
    updatePack({ image: res.url });
    setPicError("");
  }
  const toggle = (ticker: string) => {
    const tickers = c.basket.map((b) => b.ticker);
    const next = picked.has(ticker) ? tickers.filter((t) => t !== ticker) : [...tickers, ticker].slice(0, MAX_STOCKS);
    updatePack({ basket: next.length ? evenSplit(next) : [] });
  };
  const padName = PADS.find((p) => p.id === c.launchpad)!.name;
  const avatar = (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-base text-[#fff]" style={{ background: c.tone }} aria-hidden="true">
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small data URL from the chosen file
        <img src={c.image} alt="" className="size-full object-cover" />
      ) : name[0]}
    </span>
  );
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const demo = useDemo();
  const [busy, setBusy] = useState("");
  const onchain = c.launchpad === "four" && isConnected && !demo.active;
  const unlisted = c.basket.filter((b) => !STOCK_ADDRESSES[b.ticker]).map((b) => b.ticker);

  const launch = () => {
    if (onchain) { void launchOnchain(); return; }
    const slug = publishPack({ ...c, ...designPatch(c), name, sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES });
    showToast({ kind: "success", title: `${name} launched`, detail: `Simulated on ${padName} · BSC testnet` });
    router.push(`/app/packs/${slug}`);
  };

  async function launchOnchain() {
    if (!address || !publicClient) return;
    try {
      setBusy("Preparing…");
      const res = await fetch("/api/openfour/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ creator: address, name, symbol: c.ticker, basket: c.basket, style: tier?.id ?? "classic" }),
      });
      const signed = await res.json();
      if (!res.ok) throw new Error(signed.error ?? "Couldn't prepare the launch");
      setBusy("Confirm in your wallet…");
      const hash = await writeContractAsync({ chainId: appChain.id, address: OPENFOUR.core, abi: coreAbi, functionName: "createToken", args: [signed.createArgs, signed.signature] });
      setBusy("Creating…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const created = parseEventLogs({ abi: coreAbi, logs: receipt.logs, eventName: "TokenCreated" })[0];
      if (!created) throw new Error("The coin wasn't created");
      const packVault = await publicClient.readContract({ address: created.args.migrateModule, abi: migrateModuleAbi, functionName: "packVault" });
      const slug = publishPack({
        ...c, ...designPatch(c), name, sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES,
        onchain: { pad: "four", token: created.args.token, saleVault: created.args.vault, packVault, createTx: hash },
      });
      showToast({ kind: "success", title: `${name} is live`, detail: "Four.meme · BSC testnet" });
      router.push(`/app/packs/${slug}`);
    } catch (e) {
      showToast({ kind: "error", title: "Launch failed", detail: txErrorMessage(e) });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 desk:pt-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] leading-tight">Launch a coin</h1>
        <button type="button" className="-mr-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted hover:text-black" onClick={resetPack}>
          <RotateCcw className="size-3.5" /> Start over
        </button>
      </header>

      <ol className="flex items-center gap-1" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-1">
            <button type="button" disabled={!canOpen(i)} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm text-muted transition-colors enabled:hover:text-black disabled:opacity-40 aria-[current=step]:text-black">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums", step === i ? "border-black bg-black text-white" : done[i] && i < step ? "border-black" : "border-border-strong")}>
                {i < step && done[i] ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="truncate">{s}</span>
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted p-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base">{name}</p>
            <p className="truncate text-[13px] text-muted">{c.ticker}</p>
          </div>
          {c.basket.length > 0 && (
            <div className="flex shrink-0 -space-x-1.5" aria-hidden="true">
              {c.basket.map((b) => <StockLogo key={b.ticker} ticker={b.ticker} size={22} className="rounded-full ring-2 ring-[#1a1a1a]" />)}
            </div>
          )}
        </div>
      )}

      {step === 0 && <>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={() => picInput.current?.click()} aria-label={c.image ? "Change picture" : "Upload picture"}
            className="grid size-24 place-items-center overflow-hidden rounded-full border border-dashed border-border-strong text-[#fff] transition-[border-color] hover:border-black"
            style={{ background: c.image ? undefined : c.tone }}>
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- small data URL from the chosen file
              <img src={c.image} alt="" className="size-full object-cover" />
            ) : <ImagePlus className="size-6" />}
          </button>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" className="min-h-11 text-black underline-offset-4 hover:underline" onClick={() => picInput.current?.click()}>{c.image ? "Change" : "Add picture"}</button>
            {c.image && <button type="button" className="min-h-11 text-muted hover:text-black" onClick={() => updatePack({ image: null })}>Remove</button>}
          </div>
          {picError && <p className="text-sm text-down" role="alert">{picError}</p>}
          <input ref={picInput} type="file" accept={PIC_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void choosePic(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        <div className="grid grid-cols-1 gap-4 phone:grid-cols-[1fr_160px]">
          <div>
            <label htmlFor="coin-name" className={label}>Name</label>
            <input id="coin-name" className={cn(cleanField, "h-12")} value={c.name} maxLength={28} placeholder="Moon Cats" autoComplete="off" onChange={(e) => updatePack({ name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="coin-ticker" className={label}>Ticker</label>
            <input id="coin-ticker" className={cn(cleanField, "num h-12 uppercase placeholder:normal-case")} value={c.ticker} placeholder="CATS" autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(e) => updatePack({ ticker: cleanTicker(e.target.value) })} />
          </div>
        </div>

        <div>
          <span className={label}>Colour</span>
          <div className="grid grid-cols-4 gap-2 phone:grid-cols-8" role="group" aria-label="Colour">
            {TONES.map((t) => (
              <button key={t} type="button" aria-label={`Colour ${t}`} aria-pressed={c.tone === t} onClick={() => updatePack({ tone: t })}
                className="grid h-11 place-items-center rounded-md border-2 border-transparent transition-[border-color] aria-pressed:border-black" style={{ background: t }}>
                {c.tone === t && <Check className="size-4 text-[#fff]" />}
              </button>
            ))}
          </div>
        </div>
      </>}

      {step === 1 && <>
        <div>
          <span className={label}>Presets</span>
          <div className="-mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)] phone:mx-0 phone:flex-wrap phone:px-0" role="group" aria-label="Basket presets">
            {BASKET_PRESETS.map((p) => {
              const tickers = p.basket.map((b) => b.ticker).slice(0, MAX_STOCKS);
              return (
                <button key={p.id} type="button" className={cn(cleanChip, "min-h-11 shrink-0 px-3.5 whitespace-nowrap")} aria-pressed={tickers.join() === c.basket.map((b) => b.ticker).join()}
                  onClick={() => updatePack({ basket: evenSplit(tickers) })}>{p.name}</button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm text-muted">
            <span>Stocks</span>
            <span className="tabular-nums">{c.basket.length}/{MAX_STOCKS}</span>
          </div>
          {c.basket.length > 0 ? (
            <ul className="overflow-hidden rounded-md border border-border" aria-label="Picked stocks">
              {c.basket.map((b) => (
                <li key={b.ticker} className="flex min-h-14 items-center gap-3 border-b border-border pl-3 last:border-b-0">
                  <StockLogo ticker={b.ticker} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base">{b.ticker}</span>
                    <span className="block truncate text-[13px] text-muted">{stockOf(b.ticker)?.name ?? b.ticker}</span>
                  </span>
                  <span className="text-base tabular-nums">{b.weight}%</span>
                  <button type="button" onClick={() => toggle(b.ticker)} aria-label={`Remove ${stockOf(b.ticker)?.name ?? b.ticker}`}
                    className="grid size-12 shrink-0 place-items-center text-muted transition-colors hover:text-black">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid min-h-14 place-items-center rounded-md border border-dashed border-border text-sm text-muted">No stocks yet</div>
          )}
        </div>

        <div>
          <label className="relative block">
            <span className="sr-only">Search bStocks</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input className={cn(cleanField, "h-12 pl-10")} placeholder="Add a stock" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {results.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-md border border-border">
              {results.map((s) => (
                <li key={s.ticker}>
                  <button type="button" disabled={!picked.has(s.ticker) && c.basket.length >= MAX_STOCKS} onClick={() => { toggle(s.ticker); setQuery(""); }}
                    className="flex min-h-12 w-full items-center gap-3 border-b border-border px-3 text-left text-sm last:border-b-0 hover:bg-surface-muted disabled:opacity-40">
                    <StockLogo ticker={s.ticker} size={20} /> <span className="w-14 shrink-0">{s.ticker}</span> <span className="truncate text-muted">{s.name}</span>
                    {picked.has(s.ticker) && <Check className="ml-auto size-4 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>}

      {step === 2 && <>
        <DesignStep c={c} name={name} />
        <div>
          <span className={label}>Launchpad</span>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Launchpad">
            {PADS.map((p) => (
              <button key={p.id} type="button" className={cn(option, "justify-center")} aria-pressed={c.launchpad === p.id} onClick={() => updatePack({ launchpad: p.id })}>{p.name}</button>
            ))}
          </div>
          {onchain && unlisted.length > 0 ? (
            <p className="mt-2 text-sm text-down" role="alert">Not on testnet yet: {unlisted.join(", ")}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {onchain ? "On-chain · 0.05 BNB sale, 10 packs" : c.launchpad === "four" && !demo.active ? "Simulated · connect a wallet to launch on-chain" : "Simulated"}
            </p>
          )}
        </div>
      </>}

      {/* Phones: the actions stick to the bottom of the screen, just above the tab bar. */}
      <div className="mt-2 flex gap-2 border-t border-border bg-white py-3 max-desk:sticky max-desk:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[var(--gutter)] max-desk:px-[var(--gutter)] desk:pt-6">
        {step > 0 && (
          <button type="button" className={cn(cleanButton.outline, "w-12 shrink-0 justify-center px-0 desk:w-auto desk:px-4")} aria-label="Back" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> <span className="hidden desk:inline">Back</span>
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className={cn(cleanButton.solid, "flex-1 justify-center gap-2")} disabled={!done[step]} onClick={() => setStep(step + 1)}>Next <ArrowRight className="size-4" /></button>
        ) : (
          <button type="button" className={cn(cleanButton.solid, "flex-1 justify-center")} disabled={!done.every(Boolean) || Boolean(busy) || (onchain && unlisted.length > 0)} onClick={launch}>{busy || `Launch on ${padName}`}</button>
        )}
      </div>
    </div>
  );
}
