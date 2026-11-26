import Image from "next/image";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { cleanLink, cn } from "@/components/clean-ui";
import { StockCardFront } from "@/components/stock-card-front";
import { PACK_COVER, cardArt } from "@/lib/cards";
import { REPO_URL } from "@/lib/site";

const sectionSpace = "pt-20 desk:pt-28";
const sectionTitle = "text-[clamp(34px,calc(5.5vw_-_10px),74px)] leading-[1.06] font-normal tracking-[-0.04em]";

const FLOW = [
  { title: "Presale packs", body: "Packs sell before the coin exists." },
  { title: "Launch", body: "Sold out: the coin launches on Flap or Four.meme." },
  { title: "Tax fills the pool", body: "50% stock pool · 30% card stakers · 15% creator · 5% platform." },
  { title: "Open, stake, redeem", body: "Cards hold stocks. Stake them to earn tax, burn them for the stock." },
];

/** A pack cover and the card it opened. */
function PackPair() {
  return (
    <div className="relative mx-auto mt-8 aspect-[450/440] w-full max-w-[320px] desk:mt-0 desk:max-w-[560px]" aria-hidden="true">
      <div className="absolute top-[19%] left-[8%] w-[43%] max-w-[240px] -rotate-[14deg] shadow-[0_24px_32px_-22px_#000c]">
        <div className="relative aspect-[640/1023] overflow-hidden rounded-[6px]">
          <Image src={PACK_COVER.fable} alt="" fill sizes="(max-width: 800px) 140px, 240px" className="object-cover" />
        </div>
        <span className="absolute top-full right-4 mt-4 text-sm uppercase">[sealed]</span>
      </div>
      <div className="absolute top-[11%] right-[7%] w-[43%] max-w-[240px] rotate-[12deg]">
        <StockCardFront art={cardArt("NVDA", 2, "fable")} rarity={2} decorative className="w-full" sizes="(max-width: 800px) 140px, 240px" />
        <span className="absolute right-0 bottom-full mb-4 text-sm uppercase">[revealed]</span>
      </div>
    </div>
  );
}

/** Under the hero: how it works, then the open-source link. */
export function LandingSections() {
  return (
    <>
      <section id="how-it-works" className={sectionSpace} aria-labelledby="flow-title">
        <div className="grid items-center gap-8 desk:grid-cols-2 desk:gap-16">
          <div>
            <h2 id="flow-title" className={sectionTitle}>
              Trade the coin.
              <br />
              <span className="text-muted-soft">Open the stocks.</span>
            </h2>
            <ol className="mt-10 grid gap-5 desk:mt-12 desk:gap-6">
              {FLOW.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 phone:grid-cols-[56px_minmax(0,1fr)]">
                  <span className="pt-1 text-base tabular-nums">[{String(index + 1).padStart(2, "0")}]</span>
                  <div>
                    <h3 className="text-xl font-normal tracking-[-0.03em]">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-normal text-muted phone:text-base">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <PackPair />
        </div>
      </section>

      <section id="open-source" className={cn(sectionSpace, "pb-8")} aria-label="Open source">
        <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn(cleanLink, "min-h-11 lowercase")}>
          <GithubLogo weight="fill" className="size-5" aria-hidden="true" /> open source on github <ArrowUpRight weight="bold" aria-hidden="true" />
        </a>
      </section>
    </>
  );
}
