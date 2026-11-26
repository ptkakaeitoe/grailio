"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cleanDialog, cleanField, cn, dialogClose, dialogFooter, dialogHeader, dialogLabel } from "@/components/clean-ui";
import { cardArt } from "@/lib/cards";
import { listCard, type OwnedCard } from "@/lib/collection";
import { usd } from "@/lib/format";

/** Put a card up for sale on the NFT market at a price in USD (simulated until the vault is on BSC testnet). */
export function ListDialog({ card, onClose }: { card: OwnedCard; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [price, setPrice] = useState(String(Math.max(1, Math.round(card.usd * 1.2 * 100) / 100)));
  const value = Number(price);
  const valid = Number.isFinite(value) && value > 0;
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} className={cn(cleanDialog, "w-[min(400px,calc(100%-32px))]")} aria-labelledby="list-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <header className={dialogHeader}>
        <span className={dialogLabel} id="list-title">List card #{card.id}</span>
        <button type="button" className={dialogClose} aria-label="Close" onClick={onClose}><X className="size-5" /></button>
      </header>
      <div className="flex items-center gap-4 p-5">
        <div className="relative w-[96px] shrink-0 overflow-hidden rounded-[4px]">
          <StockCardFront art={cardArt(card.ticker, card.rarity, card.set)} rarity={card.rarity} brand={card.coinName} decorative sizes="96px" className="w-full" />
          <Holo rarity={card.rarity} />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="list-price" className="mb-2 block text-sm text-muted">Price (USD)</label>
          <input id="list-price" type="number" inputMode="decimal" min={0.01} step={0.01} className={cn(cleanField, "h-12 text-base tabular-nums")} value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="mt-2 text-sm text-muted tabular-nums">Holds {usd(card.usd)}</p>
        </div>
      </div>
      <div className={cn(dialogFooter, "flex flex-col")}>
        <button type="button" className={cn(cleanButton.solid, "w-full justify-center")} disabled={!valid} onClick={() => { listCard(card.id, value); onClose(); }}>
          List for {valid ? usd(value) : "—"}
        </button>
      </div>
    </dialog>
  );
}
