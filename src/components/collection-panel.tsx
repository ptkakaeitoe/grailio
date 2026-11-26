"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { CollectionWelcome } from "@/components/collection-welcome";
import { cardBack, FlipCard } from "@/components/flip-card";
import { RedeemDialog } from "@/components/redeem-dialog";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cn } from "@/components/clean-ui";
import { useCardArt } from "@/lib/design";
import { listCard, useCollection, type OwnedCard } from "@/lib/collection";
import { ListDialog } from "@/components/list-dialog";
import { CardStakeButton } from "@/components/stake-panel";
import { CollectionStaking } from "@/components/staking-pool-panel";
import { useDemo } from "@/lib/demo";
import { ConnectOrDemo } from "@/components/get-started";
import { RARITIES } from "@/lib/pack";
import { usd } from "@/lib/format";

const smallAction = "inline-flex min-h-10 items-center justify-center rounded-md border border-border text-sm transition-colors hover:border-black";
const fmtShares = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Your cards (ported from collectX's collection panel): flip a card for its details, redeem to burn it for the
 * bStocks inside. Simulated in this browser until the vault contract is on BSC testnet.
 */
export function CollectionPanel() {
  const cards = useCollection();
  const demo = useDemo();
  const cardArt = useCardArt();
  const [flipped, setFlipped] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState<OwnedCard | null>(null);
  const [listing, setListing] = useState<OwnedCard | null>(null);
  const held = cards.filter((c) => !c.redeemedAt).reverse();
  const redeemed = cards.filter((c) => c.redeemedAt).reverse();

  // Until the vault is on testnet, cards only exist in demo mode.
  if (!demo.active) {
    return (
      <CollectionWelcome
        label="Your collection"
        title="Your cards live here."
        body="Connect a wallet on BSC testnet, or try it simulated."
        action={<ConnectOrDemo />}
      />
    );
  }

  if (held.length === 0 && redeemed.length === 0) {
    return (
      <CollectionWelcome
        label="Demo collection · simulated"
        title="Your first find awaits."
        body="Open a pack and its card lands here."
        action={<Link className={cleanButton.solid} href="/app/packs">Browse packs <ArrowUpRightIcon weight="bold" className="arrow-nudge" /></Link>}
      />
    );
  }


  return (
    <>
      <p className="mb-4 inline-flex items-center gap-2 rounded-[4px] bg-surface-muted px-2.5 py-1 text-[13px] text-muted">Demo cards · Simulated</p>
      <CollectionStaking />
      {held.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 phone:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] desk:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] desk:gap-x-6 desk:gap-y-10 wide:grid-cols-6">
          {held.map((card) => {
            const art = cardArt(card);
            const isFlipped = flipped === card.id;
            return (
              <li key={card.id} className="min-w-0">
                <FlipCard
                  flipped={isFlipped}
                  onToggle={() => setFlipped(isFlipped ? null : card.id)}
                  label={`${card.ticker} ${art.name}. ${isFlipped ? "Hide" : "Show"} card details.`}
                  front={<>
                    <StockCardFront art={art} rarity={card.rarity} brand={card.coinName} decorative className="size-full" sizes="(max-width: 480px) 44vw, (max-width: 800px) 30vw, 17vw" />
                    <Holo rarity={card.rarity} />
                    {card.stakedAt && <span className="absolute top-[16%] right-1.5 rounded-[4px] bg-black px-2 py-0.5 text-[11px] text-white lowercase">staked</span>}
                  </>}
                  back={<>
                    <span className={cardBack.row}><span>{card.coinName.toUpperCase()}</span><span>{RARITIES[card.rarity].toUpperCase()}</span></span>
                    <span className={cardBack.title}><strong className={cardBack.name}>{art.name}</strong><span className={cardBack.sub}>{card.ticker} · {art.tokenName}</span></span>
                    <dl className={cardBack.meta}>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Card</dt><dd className={cardBack.dd}>#{card.id}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Pack</dt><dd className={cardBack.dd}>{card.size}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Holds</dt><dd className={cardBack.dd}>{fmtShares(card.shares)} {card.ticker}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Value</dt><dd className={cardBack.dd}>{usd(card.usd)}</dd></div>
                      <div className={cardBack.item}><dt className={cardBack.dt}>Opened</dt><dd className={cardBack.dd}>{new Date(card.openedAt).toLocaleDateString()}</dd></div>
                    </dl>
                    <span className={cardBack.foot}>SIMULATED · BSC TESTNET</span>
                  </>}
                />
                <p className="mt-2 h-5 text-sm text-muted">{card.stakedAt ? "Staked · unstake to list" : card.listedUsd ? <>Listed · <span className="text-black tabular-nums">{usd(card.listedUsd)}</span></> : null}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {card.stakedAt ? (
                    <button type="button" className={cn(smallAction, "disabled:cursor-not-allowed disabled:border-dashed disabled:hover:border-border")} disabled>List</button>
                  ) : card.listedUsd ? (
                    <button type="button" className={smallAction} onClick={() => listCard(card.id, 0)}>Unlist</button>
                  ) : (
                    <button type="button" className={smallAction} onClick={() => setListing(card)}>List</button>
                  )}
                  <button type="button" className={cn(smallAction, "disabled:cursor-not-allowed disabled:border-dashed disabled:hover:border-border")} disabled={Boolean(card.stakedAt)} onClick={() => setRedeeming(card)}>Redeem</button>
                  <CardStakeButton card={card} className="col-span-2 min-w-0" />
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
                <span>#{c.id} · {c.coinName} · {cardArt(c).name}</span>
                <span className="text-muted tabular-nums">{fmtShares(c.shares)} {c.ticker} · {new Date(c.redeemedAt!).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {redeeming && <RedeemDialog card={redeeming} onClose={() => setRedeeming(null)} />}
      {listing && <ListDialog card={listing} onClose={() => setListing(null)} />}
    </>
  );
}
