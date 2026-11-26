"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ArrowLeft, ArrowRight, Check, Globe, ImagePlus, RotateCcw, Search, Send, X } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { CoinPreview } from "@/components/launch-preview";
import { cleanButton, cleanChip, cleanField, cn } from "@/components/clean-ui";
import { publishPack } from "@/lib/published-packs";
import { showToast } from "@/lib/toast";
import { BASKET_PRESETS, DEFAULT_SIZES, PRESALE_LIMITS, TIER_PRESETS, evenSplit, presaleError, resetPack, standardPrice, updatePack, usePack, type CoinLinks, type Launchpad, type PackConfig } from "@/lib/pack";
import { PRESALE_PACKS, SEED_SHARE, launchMcap } from "@/lib/demo-launch";
import { COIN_TONES as TONES, DesignStep, PIC_TYPES, designPatch, readPicture } from "@/components/launch-design";
import { PRICED_STOCKS, stockOf } from "@/lib/stocks";
import { appChain } from "@/lib/chain";
import { useDemo } from "@/lib/demo";
import { OPENFOUR, STOCK_ADDRESSES, coreAbi, migrateModuleAbi } from "@/lib/onchain";
import { txErrorMessage } from "@/lib/tx-error";
import { FLAP_LAUNCHER_FACTORY, FLAP_PORTAL, FLAP_STOCKS, encodePackConfig, flapPackPrice, launcherFactoryAbi, minePackSalt, portalAbi } from "@/lib/flap";
import { useFlapEnabled } from "@/lib/use-flap";

/*
 * Launch a coin with its pack, in three steps: 1 the coin (image, name, ticker, description, links, colour), 2 up to four bStocks for
 * its pack, 3 design (the default pack and card art, or a custom cover and one card per rarity) and launchpad. Buyers
 * pick the Low / Medium / High risk tier per pack, so the creator doesn't. On Four.meme with a wallet connected, launching creates the coin on our
 * OpenFour testnet (the app server signs the create request for the wallet, which sends it). On Flap, once Flap has
 * enabled our factories, launching creates a PackLauncher whose presale is priced in Flap's free-mint test USD (no tBNB
 * raise; the salt lock costs 0.005 tBNB). Otherwise, or in demo mode, the pack is listed in this browser, simulated.
 *
 * "Without coin" mode makes a classic pack collection instead: 1 details (cover, name, description), 2 stocks,
 * 3 design, then publish (simulated, this browser only). No coin, ticker, launchpad, presale or tax. The mode is kept
 * in the draft as `kind`.
 */

const STEPS = ["Coin", "Stocks", "Design"] as const;
const CLASSIC_STEPS = ["Details", "Stocks", "Design"] as const;
const MODES = [{ id: "coin", name: "With coin" }, { id: "classic", name: "Without coin" }] as const;
const MAX_STOCKS = 4;
const TICKER_MAX = 10;
const DESC_MAX = 120;
const LINK_MAX = 100;
const PADS: { id: Launchpad; name: string }[] = [{ id: "flap", name: "Flap" }, { id: "four", name: "Four.meme" }];
const label = "mb-2 block text-sm text-muted";
const option = "flex min-h-14 items-center gap-3 rounded-md border border-border px-4 text-left transition-colors hover:border-border-strong aria-pressed:border-black aria-pressed:bg-black aria-pressed:text-white";

/** publishPack keeps a coin picture under 60k characters. */
const PIC_KEEP = 58_000;
const LINKS: { id: keyof CoinLinks; name: string; placeholder: string }[] = [
  { id: "website", name: "Website", placeholder: "https://" },
  { id: "x", name: "X", placeholder: "x.com/…" },
  { id: "telegram", name: "Telegram", placeholder: "t.me/…" },
];
const cleanTicker = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TICKER_MAX);

export function LaunchFlow() {
  const c = usePack();
  const router = useRouter();
  const [step, setStep] = useState(0);
  // Each step starts at the top, where its header is.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);
  const [query, setQuery] = useState("");
  const [picError, setPicError] = useState("");
  const picInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const classic = c.kind === "classic";
  const steps = classic ? CLASSIC_STEPS : STEPS;
  const picked = new Set(c.basket.map((b) => b.ticker));
  // Kept for the on-chain create request's style; drafts start on Classic.
  const tier = TIER_PRESETS.find((t) => JSON.stringify(t.tiers) === JSON.stringify(c.tiers));
  const name = c.name.trim();
  const presaleErr = classic ? "" : presaleError(c.presalePacks ?? PRESALE_PACKS, standardPrice(c));
  const done = [name.length > 0 && (classic || (c.ticker.length >= 2 && !presaleErr)), c.basket.length > 0, true];
  const canOpen = (i: number) => done.slice(0, i).every(Boolean);
  const q = query.trim().toUpperCase();
  const results = q ? PRICED_STOCKS.filter((s) => s.ticker.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 8) : [];

  async function choosePic(file: File | undefined) {
    if (!file) return;
    // Sharper for the big tile; falls back to the small size if it wouldn't be kept when publishing.
    let res = await readPicture(file, 256, 256, 0.82);
    if ("url" in res && res.url.length >= PIC_KEEP) res = await readPicture(file, 128, 128, 0.85);
    if ("error" in res) { setPicError(res.error); return; }
    updatePack({ image: res.url });
    setPicError("");
  }
  const toggle = (ticker: string) => {
    const tickers = c.basket.map((b) => b.ticker);
    const next = picked.has(ticker) ? tickers.filter((t) => t !== ticker) : [...tickers, ticker].slice(0, MAX_STOCKS);
    updatePack({ basket: next.length ? evenSplit(next) : [] });
  };
  const setLink = (k: keyof CoinLinks, v: string) => updatePack((p) => ({ links: { ...p.links, [k]: v } }));
  const padName = PADS.find((p) => p.id === c.launchpad)!.name;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const demo = useDemo();
  const [busy, setBusy] = useState("");
  const flapEnabled = useFlapEnabled();
  const onchainFour = !classic && c.launchpad === "four" && isConnected && !demo.active;
  const onchainFlap = !classic && c.launchpad === "flap" && isConnected && !demo.active && flapEnabled === true;
  const onchain = onchainFour || onchainFlap;
  const listed = onchainFlap ? FLAP_STOCKS : STOCK_ADDRESSES;
  const unlisted = c.basket.filter((b) => !listed[b.ticker]).map((b) => b.ticker);
  // Flap presale in test USD: the coin's pack count, at a price that clears the Portal's liquidity floor.
  const flapPacks = c.presalePacks ?? PRESALE_PACKS;
  const flapPrice = flapPackPrice(standardPrice(c), flapPacks);

  const setMode = (kind: "coin" | "classic") => { updatePack({ kind }); setStep(0); };
  /** Start over keeps the chosen mode. */
  const startOver = () => { const kind = c.kind; resetPack(); if (kind === "classic") updatePack({ kind }); setStep(0); };

  const publishCollection = () => {
    publishPack({ ...c, ...designPatch(c), kind: "classic", name, ticker: "", links: undefined, sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES });
    showToast({ kind: "success", title: "Collection published · simulated", detail: name });
    resetPack(); updatePack({ kind: "classic" });
    router.push("/app/packs?tab=classic");
  };

  const launch = () => {
    if (classic) { publishCollection(); return; }
    if (onchainFlap) { void launchFlap(); return; }
    if (onchainFour) { void launchOnchain(); return; }
    const slug = publishPack({ ...c, ...designPatch(c), name, sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES });
    showToast({ kind: "success", title: `${name} · presale open`, detail: `Simulated on ${padName} · BSC testnet` });
    resetPack();
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
      resetPack();
      router.push(`/app/packs/${slug}`);
    } catch (e) {
      showToast({ kind: "error", title: "Launch failed", detail: txErrorMessage(e) });
    } finally {
      setBusy("");
    }
  }

  /** Flap: mine a 7777 salt, create the PackLauncher through the Portal (the wallet pays the salt lock), list the coin. */
  async function launchFlap() {
    if (!address || !publicClient) return;
    try {
      setBusy("Preparing…");
      const salt = await minePackSalt(`${address}:${c.ticker}:${Date.now()}`);
      const data = encodePackConfig({ name, symbol: c.ticker, meta: "", salt, packPriceUsd: flapPrice, packs: flapPacks, basket: c.basket });
      const fee = await publicClient.readContract({ address: FLAP_PORTAL, abi: portalAbi, functionName: "SALT_LOCK_FEE" });
      setBusy("Confirm in your wallet…");
      const hash = await writeContractAsync({ chainId: appChain.id, address: FLAP_PORTAL, abi: portalAbi, functionName: "newLauncher", args: [FLAP_LAUNCHER_FACTORY, data], value: fee });
      setBusy("Creating…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const created = parseEventLogs({ abi: launcherFactoryAbi, logs: receipt.logs, eventName: "PackLauncherCreated" })[0];
      if (receipt.status !== "success" || !created) throw new Error("The presale wasn't created");
      const none = "0x0000000000000000000000000000000000000000" as const;
      const slug = publishPack({
        ...c, ...designPatch(c), name, sizes: c.sizes?.length ? c.sizes : DEFAULT_SIZES, presalePacks: flapPacks,
        onchain: { pad: "flap", launcher: created.args.launcher, token: none, saleVault: created.args.launcher, packVault: none, createTx: hash },
      });
      showToast({ kind: "success", title: `${name} presale is open`, detail: "Flap · BSC testnet" });
      resetPack();
      router.push(`/app/packs/${slug}`);
    } catch (e) {
      showToast({ kind: "error", title: "Launch failed", detail: txErrorMessage(e) });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-[560px] pt-4 desk:pt-8">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] leading-tight">{classic ? "Create collection" : "Create coin"}</h1>
          <button type="button" className="-mr-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted hover:text-black" onClick={startOver}>
            <RotateCcw className="size-3.5" /> Start over
          </button>
        </header>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-muted p-1" role="group" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={(c.kind ?? "coin") === m.id} onClick={() => setMode(m.id)}
              className="min-h-11 rounded-[5px] text-sm text-muted transition-colors hover:text-black aria-pressed:bg-black aria-pressed:text-white">
              {m.name}
            </button>
          ))}
        </div>

        <ol className="grid grid-cols-3 gap-2" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} className="min-w-0">
              <button type="button" disabled={!canOpen(i)} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className="flex min-h-11 w-full min-w-0 flex-col gap-2 pt-1 text-left text-sm text-muted transition-colors enabled:hover:text-black disabled:opacity-40 aria-[current=step]:text-black">
                <span className={cn("h-1 w-full rounded-full transition-colors", i <= step ? "bg-black" : "bg-border-strong")} aria-hidden="true" />
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="num shrink-0 text-[12px]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{s}</span>
                  {i < step && done[i] && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                </span>
              </button>
            </li>
          ))}
        </ol>


        {step === 0 && <>
          <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-4 desk:grid-cols-[128px_minmax(0,1fr)]">
            <div className="relative aspect-square w-full">
              <button type="button" onClick={() => picInput.current?.click()} aria-label={c.image ? (classic ? "Change cover" : "Change image") : (classic ? "Upload cover" : "Upload image")}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void choosePic(e.dataTransfer.files?.[0]); }}
                className={cn("flex size-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 transition-[border-color] hover:border-black",
                  c.image ? "border-transparent" : "border-dashed border-border-strong bg-surface-muted", dragging && "border-black")}>
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small data URL from the chosen file
                  <img src={c.image} alt="" className="size-full object-cover" />
                ) : <>
                  <ImagePlus className="size-6 text-muted" aria-hidden="true" />
                  <span className="text-[13px]">{classic ? "Cover" : "Image"}</span>
                  <span className="text-[11px] text-muted">2 MB</span>
                </>}
              </button>
              {c.image && (
                <button type="button" onClick={() => updatePack({ image: null })} aria-label={classic ? "Remove cover" : "Remove image"}
                  className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-[#000]/60 text-[#fff] backdrop-blur-sm transition-colors hover:bg-[#000]/80">
                  <X className="size-3.5" />
                </button>
              )}
              <input ref={picInput} type="file" accept={PIC_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void choosePic(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <label htmlFor="coin-name" className={label}>Name</label>
                <input id="coin-name" className={cn(cleanField, "h-12")} value={c.name} maxLength={28} placeholder={classic ? "Blue Chips" : "Moon Cats"} autoComplete="off" onChange={(e) => updatePack({ name: e.target.value })} />
              </div>
              {!classic && <div>
                <label htmlFor="coin-ticker" className={label}>Ticker</label>
                <input id="coin-ticker" className={cn(cleanField, "num h-12 uppercase placeholder:normal-case")} value={c.ticker} placeholder="CATS" autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(e) => updatePack({ ticker: cleanTicker(e.target.value) })} />
              </div>}
            </div>
            {picError && <p className="col-span-2 text-sm text-down" role="alert">{picError}</p>}
          </div>

          <div>
            <label htmlFor="coin-desc" className={cn(label, "flex justify-between")}>Description <span>Optional</span></label>
            <textarea id="coin-desc" rows={2} maxLength={DESC_MAX} className={cn(cleanField, "h-auto min-h-[76px] resize-none py-2.5 leading-snug")} value={c.tagline} placeholder="Short and sweet" onChange={(e) => updatePack({ tagline: e.target.value })} />
          </div>

          {!classic && <div>
            <span className={cn(label, "flex justify-between")}>Links <span>Optional</span></span>
            <div id="coin-links" className="flex flex-col gap-2">
                {LINKS.map((l) => (
                  <label key={l.id} className="relative block">
                    <span className="sr-only">{l.name}</span>
                    <span className="pointer-events-none absolute top-1/2 left-3.5 grid w-4 -translate-y-1/2 place-items-center text-muted" aria-hidden="true">
                      {l.id === "website" ? <Globe className="size-4" /> : l.id === "telegram" ? <Send className="size-4" /> : <span className="text-sm leading-none">𝕏</span>}
                    </span>
                    <input className={cn(cleanField, "h-12 pl-10")} type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={LINK_MAX}
                      placeholder={`${l.name} · ${l.placeholder}`} value={c.links?.[l.id] ?? ""} onChange={(e) => setLink(l.id, e.target.value)} />
                  </label>
                ))}
              </div>
          </div>}

          {!classic && <PresaleBlock c={c} error={presaleErr} />}

          <div>
            <span className={label}>Colour</span>
            <div className="-mx-1.5 grid grid-cols-8 desk:mx-0 desk:flex" role="group" aria-label="Colour">
              {TONES.map((t) => (
                <button key={t} type="button" aria-label={`Colour ${t}`} aria-pressed={c.tone === t} onClick={() => updatePack({ tone: t })}
                  className="group grid h-11 min-w-0 place-items-center desk:w-11">
                  <span className="grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-white transition-shadow group-aria-pressed:ring-2 group-aria-pressed:ring-black" style={{ background: t }}>
                    {c.tone === t && <Check className="size-3.5 text-[#fff]" />}
                  </span>
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
                  <li key={b.ticker} className="relative flex min-h-14 items-center gap-3 border-b border-border pl-3 last:border-b-0">
                    <span className="absolute bottom-0 left-0 h-0.5 bg-black transition-[width]" style={{ width: `${b.weight}%` }} aria-hidden="true" />
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
          <DesignStep c={c} name={name || (classic ? "Collection" : "")} />
          {classic ? (
            <p className="text-sm text-muted">Classic · no coin · simulated</p>
          ) : <div>
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
                {onchainFlap ? `On-chain · presale of ${flapPacks} packs × $${flapPrice} test USD · 0.005 tBNB to create`
                  : onchainFour ? "On-chain · 0.05 BNB sale, 10 packs"
                  : demo.active ? "Simulated"
                  : !isConnected ? "Simulated · connect a wallet to launch on-chain"
                  : c.launchpad === "flap" && flapEnabled === false ? "Simulated · Flap hasn't enabled our launcher on testnet yet"
                  : "Simulated"}
              </p>
            )}
          </div>}

          {/* The one preview, at the end: the coin or collection as it will list. */}
          <div>
            <span className={label}>Preview</span>
            <CoinPreview c={c} name={name} />
          </div>
        </>}

        {/* Phones: the actions stick to the bottom of the screen, just above the tab bar. */}
        <div className="mt-2 flex gap-2 border-t border-border bg-white py-3 max-desk:sticky max-desk:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-desk:z-20 max-desk:-mx-[var(--gutter)] max-desk:px-[var(--gutter)] desk:pt-6">
          {step > 0 && (
            <button type="button" className={cn(cleanButton.outline, "min-h-14 w-14 shrink-0 justify-center px-0 desk:w-auto desk:px-4")} aria-label="Back" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="size-4" /> <span className="hidden desk:inline">Back</span>
            </button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className={cn(cleanButton.solid, "min-h-14 flex-1 justify-center gap-2")} disabled={!done[step]} onClick={() => setStep(step + 1)}>Next <ArrowRight className="size-4" /></button>
          ) : (
            <button type="button" className={cn(cleanButton.solid, "min-h-14 flex-1 justify-center text-lg")} disabled={!done.every(Boolean) || Boolean(busy) || (onchain && unlisted.length > 0)} onClick={launch}>{busy || (classic ? "Publish collection" : "Launch coin")}</button>
          )}
        </div>
      </div>

    </div>
  );
}

const money = (v: number) => {
  const big = v >= 100_000;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: big ? "compact" : "standard", minimumFractionDigits: 0, maximumFractionDigits: big ? 1 : 2 }).format(v);
};

/** Writes the Standard size's price (or the first size's), keeping the other sizes. */
const setPackPrice = (price: number) => updatePack((p) => {
  const sizes = p.sizes?.length ? p.sizes : DEFAULT_SIZES;
  const id = sizes.some((s) => s.id === "standard") ? "standard" : sizes[0].id;
  return { sizes: sizes.map((s) => (s.id === id ? { ...s, price } : s)) };
});

/** A number field that keeps what's typed ("", "1.") while the draft holds the number; follows outside resets. */
function NumField({ id, value, onValue, prefix, ...rest }: { id: string; value: number; onValue: (v: number) => void; prefix?: string } & Pick<InputHTMLAttributes<HTMLInputElement>, "min" | "max" | "step" | "inputMode">) {
  const [text, setText] = useState(String(value));
  const shown = (text === "" ? 0 : Number(text)) === value ? text : String(value);
  return (
    <div className="relative">
      {prefix && <span className="num pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden="true">{prefix}</span>}
      <input id={id} type="number" className={cn(cleanField, "num h-12", prefix && "pl-7")} value={shown} autoComplete="off" {...rest}
        onChange={(e) => { setText(e.target.value); onValue(e.target.value === "" ? 0 : Number(e.target.value)); }} />
    </div>
  );
}

/** Presale size and pack price, and what they make: raise, launch mcap, and the raise's liquidity / prizes split. */
function PresaleBlock({ c, error }: { c: PackConfig; error: string }) {
  const packs = c.presalePacks ?? PRESALE_PACKS;
  const price = standardPrice(c);
  const raise = error ? 0 : packs * price;
  const L = PRESALE_LIMITS;
  const terms = [
    { k: "Packs", v: error ? "–" : packs.toLocaleString("en-US") },
    { k: "Price", v: error ? "–" : money(price) },
    { k: "Raise", v: error ? "–" : money(raise) },
    { k: "Launch mcap", v: error ? "–" : money(launchMcap(raise)) },
  ];
  return (
    <div>
      <span className={label}>Presale</span>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="presale-packs" className="mb-1 block text-[13px] text-muted">Packs</label>
          <NumField id="presale-packs" value={packs} min={L.minPacks} max={L.maxPacks} step={1} inputMode="numeric" onValue={(v) => updatePack({ presalePacks: v })} />
        </div>
        <div>
          <label htmlFor="presale-price" className="mb-1 block text-[13px] text-muted">Pack price</label>
          <NumField id="presale-price" value={price} prefix="$" min={L.minPrice} max={L.maxPrice} step={1} inputMode="decimal" onValue={setPackPrice} />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-down" role="alert">{error}</p> : (
        <div className="mt-2 rounded-md border border-border bg-surface-muted p-3" aria-live="polite">
          <p className="flex items-start justify-between gap-1">
            {terms.map((t, i) => (
              <span key={t.k} className="contents">
                {i > 0 && <span className="num pt-0.5 text-muted" aria-hidden="true">{["×", "=", "→"][i - 1]}</span>}
                <span className="flex min-w-0 flex-col">
                  <span className="num truncate text-base text-black">{t.v}</span>
                  <span className="truncate text-xs text-muted">{t.k}</span>
                </span>
              </span>
            ))}
          </p>
          <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <span className="bg-black" style={{ width: `${(1 - SEED_SHARE) * 100}%` }} />
            <span className="flex-1 bg-black/30" />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-xs text-muted">
            <span>Liquidity <span className="num text-black">{money(raise * (1 - SEED_SHARE))}</span></span>
            <span>Prizes <span className="num text-black">{money(raise * SEED_SHARE)}</span></span>
          </p>
        </div>
      )}
    </div>
  );
}
