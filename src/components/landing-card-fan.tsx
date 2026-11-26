import type { CSSProperties } from "react";

import { cn } from "@/components/clean-ui";
import { StockCardFront } from "@/components/stock-card-front";
import { cardArt } from "@/lib/cards";

/**
 * Where each card sits in the cluster, as % of the box (cards are 56.9% wide and 61.2% tall), and which way it drifts on
 * hover. Back to front: Common at the back, Legendary on top. A symmetric diamond: top and bottom share a left edge
 * (centred), left and right share a top edge, every step is half the free space (43.1% across, 38.8% down). That keeps
 * the box's top-left and bottom-right corners empty for the hero's headline and tagline.
 */
const PLACES = [
  { ticker: "MSFT", rarity: 0, left: 21.55, top: 0, hx: 0, hy: -1 },
  { ticker: "NVDA", rarity: 1, left: 43.1, top: 19.4, hx: 1, hy: 0 },
  { ticker: "GOOGL", rarity: 2, left: 21.55, top: 38.8, hx: 0, hy: 1 },
  { ticker: "TSLA", rarity: 3, left: 0, top: 19.4, hx: -1, hy: 0 },
] as const;

/** The landing hero's cards: upright and overlapping in a loose cluster. Container units keep the hover drift proportional. */
export function LandingCardFan({ className }: { className?: string }) {
  return (
    <figure
      className={cn("group/art @container m-0 w-[70%] max-w-[290px] justify-self-center desk:w-[min(72%,calc((100svh_-_220px)*.59))] desk:max-w-[460px]", className)}
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
      </div>
    </figure>
  );
}
