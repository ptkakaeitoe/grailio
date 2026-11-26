"use client";

import { ArrowRightIcon, ArrowUpRightIcon, XIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cleanDialog, cleanLink, cn, dialogFooter, dialogLabel, revealUi } from "@/components/clean-ui";
import { useCardArt } from "@/lib/design";
import { redeemCard, type OwnedCard } from "@/lib/collection";
import { appChain } from "@/lib/chain";
import { packVaultAbi } from "@/lib/onchain";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

/**
 * Redeem = burn the card, receive the stock inside. A confirm step first, since it can't be undone, then the result.
 * On-chain cards burn through their pack vault on BSC testnet; demo cards are simulated.
 */
export function RedeemDialog({ card, onClose }: { card: OwnedCard; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const art = useCardArt()(card);
  const [phase, setPhase] = useState<"confirm" | "burning" | "done">(card.redeemedAt ? "done" : "confirm");
  const payout = { amount: fmt(card.shares), symbol: card.ticker };
  const stock = `${payout.amount} ${payout.symbol}`;

  const onchain = card.onchain;
  const { address } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function burnOnchain() {
    if (!onchain || !client) return;
    setPhase("burning");
    try {
      const hash = await writeContractAsync({ chainId: appChain.id, address: onchain.vault, abi: packVaultAbi, functionName: "redeem", args: [BigInt(onchain.cardId)] });
      await client.waitForTransactionReceipt({ hash });
      redeemCard(card.id);
      setPhase("done");
    } catch (e) {
      showToast({ kind: "error", title: "Redeem failed", detail: txErrorMessage(e) });
      setPhase("confirm");
    }
  }

  useEffect(() => {
    if (phase !== "burning" || onchain) return;
    const t = setTimeout(() => { redeemCard(card.id); setPhase("done"); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
    return () => clearTimeout(t);
  }, [phase, card.id, onchain]);

  const closable = phase !== "burning";

  return (
    <dialog
      ref={dialog}
      className={cn(cleanDialog, "w-[min(480px,calc(100%-32px))]")}
      aria-labelledby="redeem-title"
      onCancel={(event) => { event.preventDefault(); if (closable) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && closable) onClose(); }}
    >
      <div className={revealUi.content}>
        {closable && <button type="button" className={revealUi.close} onClick={onClose} aria-label="Close"><XIcon /></button>}
        <p className={dialogLabel}>Redeem · card #{onchain ? onchain.cardId : card.id} · {onchain ? "BSC testnet" : "simulated"}</p>

        {/* Burning shakes the card; once done it greys out and the stock takes over. */}
        <div className="mt-[26px] mb-[22px] flex items-center justify-center gap-[18px]" aria-hidden="true">
          <StockCardFront art={art} rarity={card.rarity} brand={card.coinName} decorative sizes="120px" className={cn("w-[120px] transition-[transform,opacity,filter] duration-500 motion-reduce:transition-none", phase === "burning" ? "animate-[pack-shake_.18s_ease-in-out_infinite_alternate]" : phase === "done" ? "scale-[.85] -rotate-6 opacity-25 grayscale" : "")} />
          <span className="text-[22px] text-muted-soft"><ArrowRightIcon weight="bold" /></span>
          <span className={cn("flex flex-col items-start gap-0.5 rounded-md border px-[18px] py-4", phase === "done" ? "animate-[card-unveil_.5s_ease-out_both] border-black bg-surface-muted" : "border-border-strong bg-surface-muted")}>
            <strong className="text-[22px] font-normal tracking-[-0.02em] tabular-nums">{payout.amount}</strong>
            <span className="text-sm text-muted">{payout.symbol}</span>
            <span className="text-sm text-muted tabular-nums">≈ ${card.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} when opened</span>
          </span>
        </div>

        <div role="status" aria-live="polite">
          <h2 id="redeem-title" className={revealUi.heading}>
            {phase === "done" ? "Redeemed." : phase === "burning" ? "Burning the card…" : "Burn this card?"}
          </h2>
          {phase === "done" && <p className={revealUi.body}>{onchain ? `${stock} is in your wallet.` : `${stock} is in your demo wallet.`}</p>}
        </div>
      </div>
      <div className={cn(dialogFooter, "flex flex-col")}>
        {phase === "confirm" && (
          <div className={revealUi.actions}>
            <button type="button" className={cleanButton.solid} disabled={Boolean(onchain) && !address} onClick={() => (onchain ? void burnOnchain() : setPhase("burning"))}>
              Redeem for {stock} <ArrowUpRightIcon weight="bold" />
            </button>
            <button type="button" className={cn(cleanLink, "text-sm text-muted")} onClick={onClose}>Keep the card</button>
          </div>
        )}
        {phase === "done" && (
          <div className={revealUi.actions}>
            <Link className={cleanButton.solid} href="/app/trade" onClick={onClose}>
              See {card.ticker} price <ArrowUpRightIcon weight="bold" />
            </Link>
            <button type="button" className={cn(cleanLink, "text-sm text-muted")} onClick={onClose}>Back to collection</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
