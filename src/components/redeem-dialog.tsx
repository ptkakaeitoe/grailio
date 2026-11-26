"use client";

import { ArrowRightIcon, ArrowUpRightIcon, XIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cleanDialog, cleanLink, cn, dialogFooter, dialogLabel, revealUi } from "@/components/clean-ui";
import { cardArt } from "@/lib/cards";
import { redeemCard, type OwnedCard } from "@/lib/collection";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

/**
 * Redeem = burn the card, receive the bStocks inside (ported from collectX's redeem dialog). A confirm step first,
 * since it can't be undone, then the result. Simulated until the vault contract is on BSC testnet.
 */
export function RedeemDialog({ card, onClose }: { card: OwnedCard; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const art = cardArt(card.ticker, card.rarity, card.set);
  const [phase, setPhase] = useState<"confirm" | "burning" | "done">(card.redeemedAt ? "done" : "confirm");
  const payout = { amount: fmt(card.shares), symbol: `${card.ticker}B` };
  const stock = `${payout.amount} ${payout.symbol}`;

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (phase !== "burning") return;
    const t = setTimeout(() => { redeemCard(card.id); setPhase("done"); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
    return () => clearTimeout(t);
  }, [phase, card.id]);

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
        <p className={dialogLabel}>Redeem · card #{card.id} · simulated</p>

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
          {phase === "done" && <p className={revealUi.body}>{`${stock} would be in your wallet now. Simulated until the vault is on BSC testnet.`}</p>}
        </div>
      </div>
      <div className={cn(dialogFooter, "flex flex-col")}>
        {phase === "confirm" && (
          <div className={revealUi.actions}>
            <button type="button" className={cleanButton.solid} onClick={() => setPhase("burning")}>
              Redeem for {stock} <ArrowUpRightIcon weight="bold" />
            </button>
            <button type="button" className={cn(cleanLink, "text-sm text-muted")} onClick={onClose}>Keep the card</button>
          </div>
        )}
        {phase === "done" && (
          <div className={revealUi.actions}>
            <Link className={cleanButton.solid} href="/app/trade" onClick={onClose}>
              See {card.ticker}B price <ArrowUpRightIcon weight="bold" />
            </Link>
            <button type="button" className={cn(cleanLink, "text-sm text-muted")} onClick={onClose}>Back to collection</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
