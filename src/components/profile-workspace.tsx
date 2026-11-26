"use client";

import Link from "next/link";
import { ArrowUpRight, LogOut } from "lucide-react";
import { useAccount } from "wagmi";
import { cleanButton, cn } from "@/components/clean-ui";
import { CollectionWelcome } from "@/components/collection-welcome";
import { HoldingsPanel } from "@/components/holdings-panel";
import { ProfileHeader } from "@/components/profile-identity";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { WalletEntry } from "@/components/wallet-entry";
import { useCardArt } from "@/lib/design";
import { explorerUrl } from "@/lib/chain";
import { useCollection } from "@/lib/collection";
import { exitDemo, startDemo, useDemo } from "@/lib/demo";
import { useHoldings } from "@/lib/holdings";
import { profileKey } from "@/lib/profile";
import { usd } from "@/lib/format";
import { useWalletAuth } from "@/lib/wallet-auth";

const chip = "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm transition-colors hover:border-black desk:min-h-9";
const sectionTitle = "text-[28px] leading-[1.2] font-normal tracking-tight";
const sectionLabel = "text-base text-muted";

/** Who this is: your profile (picture, username, bio) over the demo wallet or the connected address, with its account actions. */
function Identity() {
  const demo = useDemo();
  const { address } = useAccount();
  const { logout } = useWalletAuth();
  const name = demo.active ? "Demo wallet" : address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  return (
    <ProfileHeader
      storeKey={profileKey(demo.active, address)}
      fallbackName={name}
      initials={demo.active ? "de" : address?.slice(2, 4) ?? ""}
      cardsEnabled={demo.active}
      mono={!demo.active}
      actions={<>
        {!demo.active && address && (
          <a className={chip} href={`${explorerUrl}/address/${address}`} target="_blank" rel="noreferrer">BscScan <ArrowUpRight className="size-3.5" /></a>
        )}
        {demo.active ? (
          <button type="button" className={chip} onClick={exitDemo}><LogOut className="size-3.5" /> Exit demo</button>
        ) : (
          address && <button type="button" className={cn(chip, "text-down hover:border-down")} onClick={() => { void logout(); }}><LogOut className="size-3.5" /> Sign out</button>
        )}
      </>}
    />
  );
}

/** The cards you keep, as a compact grid; the Collection page has the details and redeem. */
function ProfileCards() {
  const cards = useCollection().filter((c) => !c.redeemedAt).reverse();
  const cardArt = useCardArt();
  if (cards.length === 0) {
    return (
      <CollectionWelcome
        label="Collection"
        title="No cards yet."
        body="Open a pack and its card lands here."
        action={<Link className={cleanButton.solid} href="/app/packs">Browse packs <ArrowUpRight className="size-4" /></Link>}
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3.5 gap-y-6 phone:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] desk:gap-x-6 desk:gap-y-8">
      {cards.map((c) => {
        const art = cardArt(c);
        return (
          <li key={c.id} className="min-w-0">
            <div className="relative overflow-hidden rounded-[4px]">
              <StockCardFront art={art} rarity={c.rarity} brand={c.coinName} decorative sizes="(max-width: 480px) 45vw, 180px" className="w-full" />
              <Holo rarity={c.rarity} />
            </div>
            <p className="mt-2 truncate text-sm">{c.ticker}B · {art.name}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Your profile, laid out like the marketplace: identity up top, then your collection as the main column and your
 * holdings beside it (first on phones).
 */
export function ProfileWorkspace() {
  const demo = useDemo();
  const { address } = useAccount();
  const { loaded, inCards, cardCount } = useHoldings();

  if (!address && !demo.active) {
    return (
      <div className="pt-6 pb-16 desk:pt-10">
        <h1 className="sr-only">Profile</h1>
        <div className="flex flex-col items-center gap-5 rounded-md border border-dashed border-border-strong px-6 py-16 text-center">
          <p className={sectionLabel}>[ wallet ]</p>
          <h2 className="text-[clamp(28px,3vw,40px)] leading-[1.15] font-normal tracking-[-0.02em]">Your profile.<br /><span className="text-muted-soft">Connect to see it.</span></h2>
          <div className="flex flex-wrap justify-center gap-2">
            <WalletEntry className={cleanButton.solid} />
            <button type="button" className={cleanButton.outline} onClick={startDemo}>Try the demo <ArrowUpRight className="size-4" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 pb-16 desk:pt-10">
      <h1 className="sr-only">Profile</h1>
      <Identity />
      <div className="mt-10 grid grid-cols-1 border-t border-border desk:mt-16 desk:grid-cols-[minmax(0,1fr)_340px] wide:grid-cols-[minmax(0,1fr)_380px]">
        <section id="collection" className="min-w-0 py-8 desk:pt-10 desk:pr-8" aria-labelledby="cards-title">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h2 id="cards-title" className={cn(sectionTitle, "whitespace-nowrap")}>
              Collection
              {demo.active && loaded && cardCount > 0 && <span className="ml-3 text-base text-muted tabular-nums" title="bStocks inside your cards, at Atlas prices">≈ {usd(inCards, 0)}</span>}
            </h2>
            <Link href="/app/collection" className={cn(sectionLabel, "inline-flex min-h-11 shrink-0 items-center gap-1 hover:text-black desk:min-h-0")}>[ open<span className="max-phone:hidden"> collection</span> <ArrowUpRight className="size-3.5" /> ]</Link>
          </div>
          {demo.active ? <ProfileCards /> : <p className="text-base text-muted">No cards yet.</p>}
        </section>
        {/* Phones: holdings first. */}
        <aside className="border-border max-desk:order-first max-desk:border-b desk:border-l">
          {demo.active ? <HoldingsPanel /> : (
            <section className="py-8 desk:pt-10 desk:pl-8">
              <h2 className={sectionTitle}>Holdings</h2>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
