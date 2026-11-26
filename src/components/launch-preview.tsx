"use client";

import { Globe, Send } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { cn } from "@/components/clean-ui";
import { customPack } from "@/lib/design";
import type { PackConfig } from "@/lib/pack";
import { PRESALE_PACKS } from "@/lib/demo-launch";

/*
 * Live preview of the coin being launched, in the marketplace's look: picture (or colour and initial), name,
 * ticker, launchpad badge, pool and packs. "compact" is a single row for phones; otherwise a card for the side column.
 */

const PAD_NAME = { flap: "Flap", four: "Four.meme" } as const;

export function CoinAvatar({ c, name, className }: { c: PackConfig; name: string; className?: string }) {
  const custom = customPack(c);
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden text-[#fff]", className)} style={c.image ? undefined : custom?.style ?? { background: c.tone }} aria-hidden="true">
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small data URL from the chosen file
        <img src={c.image} alt="" className="size-full object-cover" />
      ) : (name[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** A new coin starts in presale: PRESALE_PACKS packs, launching when they sell out. */
function Meta() {
  return <>Presale · <span className="num">{PRESALE_PACKS}</span> packs</>;
}

const badge = "inline-flex h-6 shrink-0 items-center rounded-full border border-border px-2 text-xs text-muted";

export function CoinPreview({ c, name, compact = false }: { c: PackConfig; name: string; compact?: boolean }) {
  const shownName = name || "Coin name";
  const ticker = c.ticker || "TICKER";
  const links = c.links ?? {};

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted p-2.5 pr-3" aria-label="Coin preview">
        <CoinAvatar c={c} name={name} className="size-14 rounded-md text-xl" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className={cn("truncate text-base", !name && "text-muted")}>{shownName}</span>
            <span className={cn("num shrink-0 text-[13px]", c.ticker ? "text-muted" : "text-muted/60")}>{ticker}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted"><Meta /></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={badge}>{PAD_NAME[c.launchpad]}</span>
          {c.basket.length > 0 && (
            <span className="flex -space-x-1.5" aria-hidden="true">
              {c.basket.map((b) => <StockLogo key={b.ticker} ticker={b.ticker} size={18} className="rounded-full ring-2 ring-surface-muted" />)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-md border border-border bg-surface-muted" aria-label="Coin preview">
      <CoinAvatar c={c} name={name} className="aspect-square w-full text-[72px]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-xl leading-tight tracking-tight", !name && "text-muted")}>{shownName}</p>
            <p className={cn("num mt-0.5 truncate text-sm", c.ticker ? "text-muted" : "text-muted/60")}>{ticker}</p>
          </div>
          <span className={badge}>{PAD_NAME[c.launchpad]}</span>
        </div>
        {c.tagline.trim() && <p className="line-clamp-2 text-sm text-muted">{c.tagline.trim()}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-[13px] text-muted">
          <span className="truncate"><Meta /></span>
          {c.basket.length > 0 && (
            <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
              {c.basket.map((b) => <StockLogo key={b.ticker} ticker={b.ticker} size={20} className="rounded-full ring-2 ring-surface-muted" />)}
            </span>
          )}
        </div>
        {(links.website || links.x || links.telegram) && (
          <div className="flex items-center gap-3 text-muted" aria-label="Links">
            {links.website && <Globe className="size-4" aria-label="Website" />}
            {links.x && <span className="text-sm leading-none" aria-label="X">𝕏</span>}
            {links.telegram && <Send className="size-4" aria-label="Telegram" />}
          </div>
        )}
      </div>
    </article>
  );
}
