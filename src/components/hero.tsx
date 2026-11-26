import Image from "next/image";

import { cleanButton, cn } from "@/components/clean-ui";
import { MemeCoin } from "@/components/meme-coin";
import { HeroPrimaryCta, HeroSecondaryCta } from "@/components/hero-cta";

/** The "built on" row: each role on top, its projects (logo and name) underneath. Logos live in /public/brands. */
const BUILT_ON = [
  { role: "Chain", projects: [{ name: "BNB Chain", logo: "/brands/bnb-chain.svg" }] },
  { role: "Launchpads", projects: [{ name: "Flap", logo: "/brands/flap.svg" }, { name: "Four.meme · OpenFour", logo: "/brands/four-meme.svg" }] },
  { role: "Stocks", projects: [{ name: "bStocks", logo: "/brands/bstocks.svg" }] },
  { role: "Prices", projects: [{ name: "Atlas Oracle", logo: "/brands/atlas.svg" }, { name: "CoinMarketCap", logo: "/brands/coinmarketcap.png" }] },
  { role: "Odds", projects: [{ name: "Cournot", logo: "/brands/cournot.svg" }] },
];

/** Phones: the two buttons share a row at equal widths, wrapping to full-width rows when they don't fit. */
export const buttonRow =
  "flex flex-wrap gap-3 max-desk:[&>a]:min-w-max max-desk:[&>a]:flex-1 max-desk:[&>a]:justify-center";

/** Headline: Outfit, scaled to the hero's width (and on desktop, the screen height). */
const heroType =
  "font-[family-name:var(--font-outfit)] text-[clamp(34px,13.5vw,80px)] leading-[1.04] font-light tracking-[-0.03em] desk:text-[clamp(52px,min(8.4cqw,14.8svh),150px)]";

/** What makes it different, bottom right of the hero. */
const POINTS = ["Holders own.", "Tax pays.", "Stakers earn."];

/**
 * The hero artwork (1536×1024, transparent background with soft edges), so the hands keep their true colours over the
 * glow. Every piece shares one URL and `sizes`, so it downloads once.
 */
const ART = { src: "/art/hero/creation-hands-coin.png", w: 1536, h: 1024, sizes: "(max-width: 800px) 100vw, 1600px" };

/** The two hands, cut from the artwork in its pixels; the painted coin between them is left out (MemeCoin replaces it). */
const CROPS = {
  left: { x: 0, y: 430, w: 714, h: 594 },
  right: { x: 818, y: 0, w: 718, h: 600 },
} as const;

type Crop = (typeof CROPS)[keyof typeof CROPS];

/** One piece of the artwork: a box in the crop's shape showing just that part of the image. */
function ArtPiece({ crop, className, preload = false }: { crop: Crop; className?: string; preload?: boolean }) {
  return (
    <div className={cn("absolute overflow-hidden", className)} style={{ aspectRatio: `${crop.w} / ${crop.h}` }}>
      <Image
        src={ART.src}
        alt=""
        width={ART.w}
        height={ART.h}
        preload={preload}
        quality={90}
        sizes={ART.sizes}
        className="absolute h-auto max-w-none"
        style={{ width: `${(ART.w / crop.w) * 100}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` }}
      />
    </div>
  );
}

/**
 * Desktop: the two hands pulled apart into the hero's corners, reaching in from the screen edges, with the coin
 * between them. They're the hero's backdrop: the headline, button and tagline sit on top of them. Each hand is 60% of
 * the hero's height; at that size the fingertips sit at about 51% (left) and 46% (right) of the height, so the coin goes
 * at 48.7% and the diagonal still rises (much past 60% it would flip). The inner cut edges fade over 2% so the
 * fingertip glow never ends in a line. The hands float and the coin bobs (globals.css, .hand-float-* and .coin-float).
 */
function HeroHands() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-[calc(50%-50vw)] left-[calc(50%-50vw)] -z-10 hidden overflow-hidden select-none desk:block"
      aria-hidden="true"
    >
      <ArtPiece crop={CROPS.left} className="hand-float-left bottom-0 left-0 h-[60%] [mask-composite:intersect] mask-[linear-gradient(to_bottom,#000_88%,transparent),linear-gradient(to_left,transparent,#000_2%)]" />
      <ArtPiece crop={CROPS.right} className="hand-float-right top-0 right-0 h-[60%] mask-[linear-gradient(to_right,transparent,#000_2%)]" />
      <MemeCoin className="coin-float absolute top-[48.7%] left-1/2 h-[29%] w-auto -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

/**
 * The headline and its actions top left, the three points bottom right, with the hands reaching in from the other two
 * corners toward the coin.
 */
export function Hero() {
  return (
    <section
      id="overview"
      aria-labelledby="hero-title"
      className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] desk:min-h-[calc(100svh_-_var(--header-h))]"
    >
      <div className="relative isolate grid grid-cols-1 gap-4 py-8 desk:@container desk:min-h-[520px] desk:grid-cols-5 desk:grid-rows-[auto_minmax(0,1fr)] desk:gap-x-6 desk:gap-y-6 desk:py-10">
        {/* Desktop: headline and its two actions together, top left. Phones: the block dissolves and the actions go last. */}
        <div className="relative z-10 max-desk:contents desk:col-[1/4] desk:row-1 desk:self-start">
          <h1 id="hero-title" className={heroType}>
            Not your typical<br />memecoin.
          </h1>
          <div className={cn(buttonRow, "mt-4 phone:gap-4 max-desk:order-last desk:mt-[clamp(32px,7svh,72px)]")}>
            <HeroPrimaryCta />
            {/* A translucent dark backing, so the button reads cleanly where it sits over a hand. */}
            <HeroSecondaryCta className={cn(cleanButton.outline, "bg-white/70 lowercase backdrop-blur-[6px] desk:min-h-[58px]")} />
          </div>
        </div>
        {/* Phones: the artwork's own layout, the hands nudged 6% apart to make room for the coin, running edge to edge
            past the page gutters. The mask fades the edges so the forearms dissolve. */}
        <div
          className="pointer-events-none relative -z-10 -mx-(--gutter) aspect-[3/2] w-[calc(100%+2*var(--gutter))] select-none desk:hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 overflow-hidden [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent),linear-gradient(to_bottom,#000_80%,transparent)]">
            <ArtPiece crop={CROPS.left} preload className="hand-float-left top-[42%] left-[-6%] w-[46.5%]" />
            <ArtPiece crop={CROPS.right} className="hand-float-right top-0 left-[59.3%] w-[46.7%]" />
          </div>
          <MemeCoin className="coin-float absolute top-[49.4%] left-1/2 w-[13%] -translate-x-1/2 -translate-y-1/2" />
        </div>
        <HeroHands />
        {/* The three points, bottom right (spanning both rows, so they never make the hero taller). "How it works"
            right below explains them. */}
        <ol
          aria-label="How it's different"
          className="relative z-10 m-0 flex list-none flex-col gap-2 p-0 font-[family-name:var(--font-outfit)] text-[clamp(22px,6vw,30px)] leading-snug font-light tracking-[-0.02em] desk:col-[3/6] desk:row-[1/3] desk:gap-3 desk:self-end desk:justify-self-end desk:text-[clamp(24px,min(2.5cqw,4.4svh),44px)]"
        >
          {POINTS.map((point, i) => (
            <li key={point} className="flex items-baseline gap-4">
              <span className="font-mono text-[0.5em] text-muted tabular-nums">[{String(i + 1).padStart(2, "0")}]</span>
              {point}
            </li>
          ))}
        </ol>
      </div>
      <ul
        aria-label="Built on"
        className="flex list-none flex-wrap items-end gap-x-8 gap-y-5 p-0 pt-4 pb-8 text-sm text-muted desk:justify-between desk:text-base"
      >
        <li className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap">
          <span className="relative mr-0.5 inline-flex size-2" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-up opacity-60 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-up" />
          </span>
          Built on
        </li>
        {BUILT_ON.map(({ role, projects }) => (
          <li key={role} className="flex flex-col gap-2">
            <span>{role}</span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {projects.map(({ name, logo }) => (
                <span key={name} className="inline-flex h-6 items-center gap-2 whitespace-nowrap text-black">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny local logos; next/image adds nothing here */}
                  <img src={logo} alt="" width={20} height={20} className="size-5 shrink-0 rounded-[5px] object-contain" />
                  {name}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
