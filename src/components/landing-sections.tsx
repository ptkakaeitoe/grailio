import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";

import { SectionHeading, cleanButton, cleanLink, cn } from "@/components/clean-ui";
import { buttonRow } from "@/components/hero";
import { StockCardFront } from "@/components/stock-card-front";
import { PACK_COVER, cardArt } from "@/lib/cards";
import { REPO_URL } from "@/lib/site";

const sectionSpace = "pt-24 desk:pt-32";
const sectionTitle = "text-[clamp(34px,calc(5.5vw_-_10px),74px)] leading-[1.06] font-normal tracking-[-0.04em]";

const FLOW = [
  { title: "Attach the vault", body: "Any BNB Chain launchpad, Flap or Four.meme, attaches the pack vault to a coin." },
  { title: "Fill the pool", body: "Trading tax and pack margin buy bStocks: tokenized stocks, priced by Atlas." },
  { title: "Open a pack", body: "Holders open packs. Every card holds bStocks from the pool." },
  { title: "Burn to redeem", body: "Burn a card to redeem the bStocks inside it." },
];

const POOL = [
  { title: "Trading tax", body: "Every buy and sell of the coin sends its tax to the vault.", swatch: "bg-block-green" },
  { title: "Pack margin", body: "Each pack sold adds its margin to the same pool.", swatch: "bg-block-salmon" },
  { title: "Priced by Atlas", body: "Atlas Oracle prices every bStock; CoinMarketCap cross-checks it.", swatch: "bg-black" },
];

const TIERS = [
  { name: "Low", figure: "Always", rule: "Low packs always sell, whatever the odds." },
  { name: "Medium", figure: "50%", rule: "Pauses when Cournot puts a 50% chance on a 10% drop in the pool's biggest stock." },
  { name: "High", figure: "25%", rule: "Pauses at a 25% chance of that same 10% drop." },
];

/** Graily's sealed / revealed pair: a pack cover and the card it opened. */
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

/** Everything under the hero: how it works, the pool, the risk guard and the open-source close. */
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
            <div className={cn(buttonRow, "mt-8 desk:mt-16")}>
              <Link href="/launch" className={cn(cleanButton.outline, "lowercase")}>
                launch a coin <ArrowUpRight weight="bold" aria-hidden="true" />
              </Link>
              <Link href="/app/packs" className={cn(cleanButton.solid, "lowercase")}>
                browse packs <ArrowUpRight weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <PackPair />
        </div>
      </section>

      <section id="pool" className={sectionSpace} aria-label="The pool">
        <SectionHeading label="the pool" title="Tax goes in." subtitle="bStocks come out.">
          <p className="mt-5 max-w-[530px] text-base leading-normal text-muted">
            Two streams fill one pool of bStocks. The cards in every pack draw from it.
          </p>
        </SectionHeading>
        <ul className="grid list-none p-0 desk:grid-cols-3 desk:gap-8">
          {POOL.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                "flex flex-col items-start py-6 first:pt-0 last:pb-0 desk:py-0",
                index < POOL.length - 1 && "border-b border-border desk:border-r desk:border-b-0 desk:pr-8",
              )}
            >
              <div className="flex w-full items-start justify-between">
                <span className="text-base tabular-nums">[0{index + 1}]</span>
                <span className={cn("mt-1 h-5 w-3.5 -rotate-[23deg]", item.swatch)} aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-[clamp(30px,calc(4vw_-_10px),50px)] leading-none font-normal tracking-[-0.04em]">{item.title}</h3>
              <p className="mt-5 max-w-[340px] text-base leading-normal text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="risk" className={sectionSpace} aria-label="Risk guard">
        <SectionHeading label="risk guard" title="Low always sells." subtitle="Cournot decides the rest.">
          <p className="mt-5 max-w-[530px] text-base leading-normal text-muted">
            Cournot&apos;s odds on the pool&apos;s biggest stock pause the riskier Medium and High packs.
          </p>
        </SectionHeading>
        <ul className="grid list-none border-y border-border p-0 desk:grid-cols-3">
          {TIERS.map((tier, index) => (
            <li
              key={tier.name}
              className={cn(
                "flex flex-col gap-4 py-6 desk:py-8",
                index < TIERS.length - 1 && "border-b border-border desk:border-r desk:border-b-0",
                index > 0 && "desk:pl-8",
                index < TIERS.length - 1 && "desk:pr-8",
              )}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-normal tracking-[-0.03em]">{tier.name}</h3>
                <span className="text-sm text-muted">{index === 0 ? "[ on sale ]" : "[ pauses at ]"}</span>
              </div>
              <p className="num text-[clamp(40px,5vw,64px)] leading-none tracking-[-0.04em]">{tier.figure}</p>
              <p className="max-w-[340px] text-sm leading-normal text-muted phone:text-base">{tier.rule}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="open-source" className={sectionSpace} aria-label="Open source">
        <SectionHeading label="open source" title="Fully open source." subtitle="MIT licensed.">
          <p className="mt-5 max-w-[530px] text-base leading-normal text-muted">Read the code, fork it, run your own vault.</p>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn(cleanLink, "mt-4 min-h-11 lowercase")}>
            <GithubLogo weight="fill" className="size-5" aria-hidden="true" /> view on github <ArrowUpRight weight="bold" aria-hidden="true" />
          </a>
        </SectionHeading>
        <ul className="grid list-none border-y border-border p-0 py-6 desk:grid-cols-2 desk:gap-8 desk:py-7">
          {[
            { title: "Browse packs", body: "See which packs are on sale and what their cards hold.", href: "/app/packs", cta: "browse packs" },
            { title: "Launch a coin", body: "Launch on Flap or Four.meme with the pack vault attached.", href: "/launch", cta: "launch a coin" },
          ].map((item, index) => (
            <li
              key={item.href}
              className={cn("pt-6 first:pt-0 desk:pt-0", index === 0 && "border-b border-border pb-6 desk:border-r desk:border-b-0 desk:pr-8 desk:pb-0")}
            >
              <Link href={item.href} className="group flex h-full min-h-[160px] flex-col items-start justify-between gap-8 desk:min-h-[180px]">
                <span className="flex w-full items-start justify-between gap-4 text-[clamp(30px,3vw,44px)] leading-[1.08] tracking-[-0.03em]">
                  {item.title}
                  <ArrowUpRight
                    weight="bold"
                    className="mt-1 shrink-0 text-[24px] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                    aria-hidden="true"
                  />
                </span>
                <span className="flex flex-col gap-3 text-base leading-normal text-muted">
                  <span>{item.body}</span>
                  <span className="text-sm text-black underline underline-offset-4">{item.cta}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-[600px] text-sm leading-normal text-muted desk:mt-14">
          BNB Chain. Cards hold bStocks, tokenized stocks priced by Atlas Oracle and cross-checked with CoinMarketCap. Odds by Cournot.
        </p>
      </section>
    </>
  );
}
