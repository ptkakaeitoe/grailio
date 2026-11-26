import type { CSSProperties } from "react";

import { cn } from "@/components/clean-ui";
import { StockCardFront } from "@/components/stock-card-front";
import { cardArt } from "@/lib/cards";

/**
 * Where each card sits in the cluster, as % of the box (cards are 56.9% wide, 2:3), and which way it drifts on hover.
 * Back to front: Common at the back, Legendary on top. Layout from graily's card fan; each card holds a real bStock.
 */
const PLACES = [
  { ticker: "MSFT", rarity: 0, left: 5.2, top: 0, hx: -1, hy: -1 },
  { ticker: "NVDA", rarity: 1, left: 43.1, top: 10.2, hx: 1, hy: -1 },
  { ticker: "GOOGL", rarity: 2, left: 36.3, top: 38.8, hx: 1, hy: 1 },
  { ticker: "TSLA", rarity: 3, left: 0, top: 27.8, hx: -1, hy: 1 },
] as const;

const tag = "absolute z-10 w-max bg-black px-2 py-1 text-sm leading-[1.3] text-white max-desk:hidden";

/** The landing hero's cards: upright and overlapping in a loose cluster. Container units keep the hover drift proportional. */
export function LandingCardFan() {
  return (
    <figure
      className="group/art @container m-0 w-[70%] max-w-[290px] justify-self-center max-desk:order-first max-desk:mb-6 desk:w-[min(72%,calc((100svh_-_220px)*.59))] desk:max-w-[460px]"
      aria-hidden="true"
    >
      <div className="relative isolate aspect-[0.717]">
        {PLACES.map((p, index) => {
          const art = cardArt(p.ticker, p.rarity, "fable");
          return (
            <div
              key={art.slug}
              className="absolute isolate w-[56.9%] shadow-[0_24px_48px_-20px_rgb(0_0_0/.7)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.3,1)] group-hover/art:translate-x-[calc(var(--hx)*2.4cqw)] group-hover/art:translate-y-[calc(var(--hy)*2.4cqw)] motion-reduce:transition-none"
              style={{ left: `${p.left}%`, top: `${p.top}%`, zIndex: index + 1, "--hx": p.hx, "--hy": p.hy } as CSSProperties}
            >
              <StockCardFront art={art} rarity={p.rarity} decorative priority={p.rarity === 3} sizes="(max-width: 800px) 42vw, 260px" className="w-full" />
            </div>
          );
        })}
        {/* Desktop tags, 12px off the cards: beside the back card and past the right edge. */}
        <span className={cn(tag, "top-[8%] right-[calc(94.8%+12px)]")}>[BNB CHAIN]</span>
        <span className={cn(tag, "top-[74%] left-[calc(100%+12px)]")}>[OPEN SOURCE]</span>
      </div>
    </figure>
  );
}
