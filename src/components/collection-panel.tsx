"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { CollectionWelcome } from "@/components/collection-welcome";
import { cardBack, FlipCard } from "@/components/flip-card";
import { RedeemDialog } from "@/components/redeem-dialog";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cn } from "@/components/clean-ui";
import { cardArt } from "@/lib/cards";
import { useCollection, type OwnedCard } from "@/lib/collection";
import { startDemo, useDemo } from "@/lib/demo";
import { RARITIES } from "@/lib/pack";
import { usd } from "@/lib/format";

const fmtShares = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Your cards (ported from collectX's collection panel): flip a card for its details, redeem to burn it for the
 * bStocks inside. Simulated in this browser until the vault contract is on BSC testnet.
 */
export function CollectionPanel() {
  const cards = useCollection();
  const demo = useDemo();
  const [flipped, setFlipped] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState<OwnedCard | null>(null);
  const held = cards.filter((c) => !c.redeemedAt).reverse();
  const redeemed = cards.filter((c) => c.redeemedAt).reverse();

  // Until the vault is on testnet, cards only exist in demo mode.
  if (!demo.active) {
    return (
      <CollectionWelcome
        label="Your collection"
        title="Your cards live here."
        body="Try the demo to open packs now."
        action={<button type="button" className={cleanButton.solid} onClick={startDemo}>Try the demo <ArrowUpRightIcon weight="bold" /></button>}
      />
    );
  }

  if (held.length === 0 && redeemed.length === 0) {
    return (
      <CollectionWelcome
        label="Demo collection"
        title="Your first find awaits."
        body="Open a pack and its card lands here."
        action={<Link className={cleanButton.solid} href="/app/packs">Browse packs <ArrowUpRightIcon weight="bold" /></Link>}
      />
    );
  }

  const total = held.reduce((s, c) => s + c.usd, 0);

  return (
    <>
      <p className="mb-6 text-base text-muted tabular-nums">{held.length} {held.length === 1 ? "card" : "cards"} · {usd(total)} in bStocks when opened</p>
      {held.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-7 phone:grid-cols-[repeat(auto-fill,minmax(175px,230px))] desk:grid-cols-[repeat(auto-fill,minmax(205px,255px))] desk:gap-x-8 desk:gap-y-12">
          {held.map((card) => {
            const art = cardArt(card.ticker, card.rarity, card.set);
            const isFlipped = flipped === card.id;
            return (
              <li key={card.id} className="min-w-0">
                <FlipCard
                  flipped={isFlipped}
                  onToggle={() => setFlipped(isFlipped ? null : card.id)}
                  label={`${card.ticker}B ${art.name}. ${isFlipped ? "Hide" : "Show"} card details.`}
                  front={<>
                    <StockCardFront art={art} rarity={card.rarity} brand={card.coinName} decorative className="size-full" sizes="(max-width: 480px) 44vw, (max-width: 800px) 30vw, 17vw" />
                    <Holo rarity={card.rarity} />
                  </>}
                  back={<>
                    <span className={cardBack.row}><span>{card.coinName.toUpperCase()}</span><span>{RARITIES[card.rarity].toUpperCase()}</span></span>
                    <span className={cardBack.title}><strong className={cardBack.name}>{art.name}</strong><span className={cardBack.sub}>{card.ticker}B · {art.tokenName}</span></span>
                    <dl className={cardBack.meta}>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Card</dt><dd className={cardBack.dd}>#{card.id}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Pack</dt><dd className={cardBack.dd}>{card.size}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Holds</dt><dd className={cardBack.dd}>{fmtShares(card.shares)} {card.ticker}B</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Value</dt><dd className={cardBack.dd}>{usd(card.usd)}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Opened</dt><dd className={cardBack.dd}>{new Date(card.openedAt).toLocaleDateString()}</dd></div>
                    </dl>
                    <span className={cardBack.foot}>SIMULATED · BSC TESTNET</span>
                  </>}
                />
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-base">{card.ticker}B · {art.name}</p>
                  <button type="button" className="shrink-0 text-sm text-muted underline-offset-4 hover:text-black hover:underline" onClick={() => setRedeeming(card)}>Redeem</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-base text-muted">Every card is redeemed. <Link href="/app/packs" className="text-black underline underline-offset-4">Open another pack</Link></p>
      )}

      {redeemed.length > 0 && (
        <section className="mt-12 border-t border-border pt-6" aria-labelledby="redeemed-title">
          <h2 id="redeemed-title" className="mb-4 text-[22px] leading-[1.3] font-normal tracking-tight">Redeemed</h2>
          <ul className="divide-y divide-border text-sm">
            {redeemed.map((c) => (
              <li key={c.id} className={cn("flex flex-wrap items-baseline justify-between gap-2 py-2.5")}>
                <span>#{c.id} · {c.coinName} · {cardArt(c.ticker, c.rarity, c.set).name}</span>
                <span className="text-muted tabular-nums">{fmtShares(c.shares)} {c.ticker}B · {new Date(c.redeemedAt!).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {redeeming && <RedeemDialog card={redeeming} onClose={() => setRedeeming(null)} />}
    </>
  );
}
