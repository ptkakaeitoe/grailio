import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

import { cleanButton, cn } from "@/components/clean-ui";
import { LandingCardFan } from "@/components/landing-card-fan";

const BUILT_ON = [
  ["Chain", "BNB Chain"],
  ["Launchpads", "Flap"],
  ["", "Four.meme · OpenFour"],
  ["Stocks", "bStocks"],
  ["Prices", "Atlas Oracle"],
  ["", "CoinMarketCap"],
  ["Odds", "Cournot"],
] as const;

/** Phones: the two buttons share a row at equal widths, wrapping to full-width rows when they don't fit. */
export const buttonRow =
  "flex flex-wrap gap-3 max-desk:[&>a]:min-w-max max-desk:[&>a]:flex-1 max-desk:[&>a]:justify-center";

/**
 * Landing hero, laid out like graily's: headline and actions on the left, the card fan on the right, the "built on"
 * row at the fold. On phones the column dissolves so the cards lead, then the headline, the buttons and the tags.
 */
export function Hero() {
  return (
    <section
      id="overview"
      aria-labelledby="hero-title"
      className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] desk:min-h-[calc(100svh_-_var(--header-h))]"
    >
      <div className="relative grid grid-cols-1 gap-4 py-8 desk:grid-cols-2 desk:items-center desk:gap-8 desk:pt-4">
        <div className="relative min-w-0 max-desk:contents">
          <h1
            id="hero-title"
            className="text-[clamp(34px,10.5vw,64px)] leading-[1.12] font-normal tracking-[-0.02em] desk:text-[clamp(40px,calc(min(6vw,10svh)_-_8px),96px)]"
          >
            <span className="text-muted-soft">Memecoin tax buys real stocks.</span> Holders win them in packs.
          </h1>
          <p className="mt-4 max-w-[520px] text-base leading-normal text-muted desk:mt-6 desk:text-lg">
            A pack vault any BNB Chain launchpad can attach to a coin. Trading tax fills a pool of bStocks; holders open packs whose cards hold them.
          </p>
          <div className={cn(buttonRow, "mt-4 phone:gap-4 desk:mt-[clamp(32px,6svh,56px)]")}>
            <Link href="/app/packs" className={cn(cleanButton.solid, "lowercase desk:min-h-[58px]")}>
              browse packs <ArrowUpRight weight="bold" aria-hidden="true" />
            </Link>
            <Link href="/launch" className={cn(cleanButton.outline, "lowercase desk:min-h-[58px]")}>
              launch a coin <ArrowUpRight weight="bold" aria-hidden="true" />
            </Link>
          </div>
          {/* Phones: the tags as a row under the cards. Desktop: the card fan draws them beside the cards instead. */}
          <div
            className="pointer-events-none flex items-end justify-between gap-4 text-sm leading-[1.3] max-desk:-order-1 max-desk:-mt-6 max-desk:mb-2 desk:hidden"
            aria-hidden="true"
          >
            <span className="bg-black px-2 py-1 text-white">[BNB CHAIN]</span>
            <span className="bg-black px-2 py-1 text-white">[OPEN SOURCE]</span>
          </div>
        </div>
        <LandingCardFan />
      </div>
      <ul
        aria-label="Built on"
        className="flex list-none flex-wrap items-center gap-x-6 gap-y-2 p-0 pt-4 pb-8 text-sm text-muted desk:justify-between desk:text-base"
      >
        <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="relative mr-0.5 inline-flex size-2" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-up opacity-60 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-up" />
          </span>
          Built on
        </li>
        {BUILT_ON.map(([what, who]) => (
          <li key={who} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {what && <span>{what}</span>}
            <span className="text-black">{who}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
