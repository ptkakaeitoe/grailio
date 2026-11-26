"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { formatEther, parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { WalletEntry } from "@/components/wallet-entry";
import { cleanButton, cn } from "@/components/clean-ui";
import { SET_FOR_SIZE, cardArt } from "@/lib/cards";
import { appChain, explorerUrl } from "@/lib/chain";
import { addCard } from "@/lib/collection";
import { OPENFOUR, SALE, coreAbi, marketAbi, MARKET, packVaultAbi, saleVaultAbi, tickerOfStock, toolsAbi } from "@/lib/onchain";
import { RARITIES } from "@/lib/pack";
import { stockOf } from "@/lib/stocks";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";
import type { MarketCoin } from "@/lib/market";
import { CoinAvatar } from "@/components/coin-avatar";

/*
 * Packs of a coin that lives on-chain (our OpenFour testnet). During the sale, buying tokens earns presale packs
 * (10,000 tokens = one pack). After the sale migrates, packs open from the coin's pack vault: open commits to the next
 * block, reveal draws the card, which holds the bStock it bought. Cards are also saved in this browser's collection so
 * they can be redeemed there.
 */

const MIGRATED = 3;
const SALE_PACKS = Number(SALE.saleAmount / SALE.tokensPerPack);
const bnb = (wei: bigint, max = 4) => Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: max });
/** Card rarity from the roll (bps of the pack price). */
const rarityOf = (bps: number) => (bps < 9000 ? 0 : bps < 12000 ? 1 : bps < 20000 ? 2 : 3);

type State = { phase: number; remaining: bigint; free: bigint; maxPayout: bigint; packs: bigint };
type Pulled = { cardId: bigint; ticker: string; rarity: number; valueWei: bigint; amount: bigint; usd: number };

export function OnchainPacks({ coin }: { coin: MarketCoin }) {
  const oc = coin.config.onchain!;
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const [s, setS] = useState<State | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState("");
  const [pulled, setPulled] = useState<Pulled | null>(null);
  const [readError, setReadError] = useState("");

  const refresh = useCallback(async () => {
    if (!client) throw new Error("No chain client");
    const [phase, remaining, free, maxPayout, packs] = await Promise.all([
      client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "phase" }),
      client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "remainingForSale" }),
      client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "freeBalance" }),
      client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "maxPayout" }),
      address ? client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "packsOf", args: [address] }) : Promise.resolve(0n),
    ]);
    setS({ phase: Number(phase), remaining, free, maxPayout, packs });
  }, [client, oc.saleVault, oc.packVault, address]);

  useEffect(() => {
    const tick = () => void refresh().then(() => setReadError(""), (e: unknown) => setReadError(e instanceof Error ? e.message.split("\n")[0] : "Couldn't read the chain"));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 15_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  const live = s ? s.phase < MIGRATED : true;
  const leftInSale = s ? Number(s.remaining / SALE.tokensPerPack) : 0;
  const sold = SALE_PACKS - leftInSale;
  const maxQty = live ? Math.max(1, leftInSale) : 20;
  const n = Math.min(qty, maxQty);
  const canOpen = s && !live && s.packs > 0n && s.free >= s.maxPayout;

  async function run(label: string, fn: () => Promise<void>) {
    try { setBusy(label); await fn(); await refresh(); } catch (e) {
      showToast({ kind: "error", title: `${label.replace("…", "")} failed`, detail: txErrorMessage(e) });
    } finally { setBusy(""); }
  }

  const buy = () => run("Buying…", async () => {
    if (!client || !address) return;
    if (live) {
      const amount = SALE.tokensPerPack * BigInt(n);
      const { result } = await client.simulateContract({ address: OPENFOUR.tools, abi: toolsAbi, functionName: "estimateBuy", args: [coin.config.onchain!.token, address, amount, 0n, "0x"], account: address });
      const maxPay = (result.userPays * 10_500n) / 10_000n;
      const hash = await writeContractAsync({ chainId: appChain.id, address: OPENFOUR.core, abi: coreAbi, functionName: "buy", args: [oc.token, amount, maxPay, 0n, "0x"], value: maxPay });
      await client.waitForTransactionReceipt({ hash });
    } else {
      const hash = await writeContractAsync({ chainId: appChain.id, address: oc.packVault, abi: packVaultAbi, functionName: "buy", args: [BigInt(n)], value: SALE.packPrice * BigInt(n) });
      await client.waitForTransactionReceipt({ hash });
    }
    showToast({ kind: "success", title: `${n} ${n === 1 ? "pack" : "packs"} bought`, detail: "BSC testnet" });
  });

  const open = () => run("Opening…", async () => {
    if (!client || !address) return;
    setPulled(null);
    const openHash = await writeContractAsync({ chainId: appChain.id, address: oc.packVault, abi: packVaultAbi, functionName: "open" });
    const openRec = await client.waitForTransactionReceipt({ hash: openHash });
    const opened = parseEventLogs({ abi: packVaultAbi, logs: openRec.logs, eventName: "PackOpened" })[0];
    if (!opened) throw new Error("The pack didn't open");
    setBusy("Revealing…");
    // The card is drawn from the next block's hash.
    while ((await client.getBlockNumber()) <= opened.args.revealBlock) await new Promise((r) => setTimeout(r, 1200));
    const revealHash = await writeContractAsync({ chainId: appChain.id, address: oc.packVault, abi: packVaultAbi, functionName: "reveal", args: [opened.args.revealId] });
    const revealRec = await client.waitForTransactionReceipt({ hash: revealHash });
    const card = parseEventLogs({ abi: packVaultAbi, logs: revealRec.logs, eventName: "CardRevealed" })[0];
    if (!card) throw new Error("The card wasn't revealed");
    const ticker = tickerOfStock(card.args.stock);
    const rarity = rarityOf(card.args.rollBps);
    const [usdPrice] = await Promise.all([client.readContract({ address: MARKET, abi: marketAbi, functionName: "usdPrice", args: [card.args.stock] })]);
    const usd = (Number(formatEther(card.args.amount)) * Number(formatEther(usdPrice)));
    const p: Pulled = { cardId: card.args.cardId, ticker, rarity, valueWei: card.args.valueWei, amount: card.args.amount, usd };
    setPulled(p);
    addCard({
      coin: coin.slug, coinName: coin.name, size: "standard", set: SET_FOR_SIZE.standard, ticker, rarity, usd,
      shares: Number(formatEther(card.args.amount)),
      onchain: { vault: oc.packVault, cardId: card.args.cardId.toString(), amount: card.args.amount.toString() },
    });
  });

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-2 pb-10 desk:pt-4">
      <header className="flex items-center gap-3">
        <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className="size-12 rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight">{coin.name}</h1>
          <a href={`${explorerUrl}/address/${oc.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-black">
            Four.meme · BSC testnet <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-1.5" aria-label="Status">
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted">{live ? "Sale" : "Stock pool"}</p>
          <p className="num mt-1 text-[22px] leading-tight">{!s ? "—" : live ? `${sold}/${SALE_PACKS}` : `${bnb(s.free)} BNB`}</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted">Your packs</p>
          <p className="num mt-1 text-[22px] leading-tight">{!isConnected ? "—" : s ? s.packs.toString() : "…"}</p>
        </div>
      </section>

      {readError && <p className="text-sm text-down" role="alert">{readError}</p>}

      {pulled && (
        <section className="flex items-center gap-4 rounded-md border border-border p-4" aria-live="polite">
          <div className="w-[96px] shrink-0 animate-[card-unveil_.65s_ease-out_both]">
            <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px]">
              <StockCardFront art={cardArt(pulled.ticker, pulled.rarity, SET_FOR_SIZE.standard)} rarity={pulled.rarity} brand={coin.name} decorative sizes="96px" className="w-full" />
              <Holo rarity={pulled.rarity} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[22px] leading-tight capitalize">{RARITIES[pulled.rarity]}</p>
            <p className="num mt-1 text-sm text-muted">{Number(formatEther(pulled.amount)).toFixed(4)} {pulled.ticker} · {stockOf(pulled.ticker)?.name ?? ""}</p>
            <Link href="/app/collection" className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4">Collection <ArrowUpRight className="size-3.5" /></Link>
          </div>
        </section>
      )}

      {!isConnected ? (
        <WalletEntry className={cn(cleanButton.solid, "w-full justify-center")} />
      ) : (
        <section className="flex flex-col gap-2" aria-label="Packs">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border">
              <button type="button" className="grid size-12 place-items-center disabled:opacity-30" aria-label="Fewer" disabled={n <= 1} onClick={() => setQty(n - 1)}><Minus className="size-4" /></button>
              <span className="num w-8 text-center">{n}</span>
              <button type="button" className="grid size-12 place-items-center disabled:opacity-30" aria-label="More" disabled={n >= maxQty} onClick={() => setQty(n + 1)}><Plus className="size-4" /></button>
            </div>
            <button type="button" className={cn(cleanButton.outline, "min-h-12 flex-1 justify-center")} disabled={Boolean(busy) || !s || (live && leftInSale === 0)} onClick={buy}>
              Buy · {bnb(SALE.packPrice * BigInt(n), 3)} BNB
            </button>
          </div>
          <button type="button" className={cn(cleanButton.solid, "min-h-12 w-full justify-center")} disabled={Boolean(busy) || !canOpen} onClick={open}>
            {busy || (live ? "Opens after the sale" : s && s.packs === 0n ? "No packs" : s && s.free < s.maxPayout ? "Pool filling" : "Open pack")}
          </button>
          <p className="text-center text-sm text-muted">BSC testnet</p>
        </section>
      )}
    </div>
  );
}
