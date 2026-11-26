"use client";

import { Globe, Send } from "lucide-react";
import { StockLogo } from "@/components/stock-logo";
import { cn } from "@/components/clean-ui";
import { customPack } from "@/lib/design";
import { DEFAULT_SIZES, presaleError, standardPrice, type PackConfig } from "@/lib/pack";
import { PRESALE_PACKS, launchMcap } from "@/lib/demo-launch";
import { SealedPack } from "@/components/pack-shop";
import { ClassicPack } from "@/components/classic-pack-shop";
import type { MarketCoin } from "@/lib/market";

/*
 * Live preview of the coin being launched, in the marketplace's look: picture (or colour and initial), name,
 * ticker, launchpad badge, pool and packs. "compact" is a single row for phones; otherwise a card for the side column.
 * A classic collection (kind "classic") shows its cover, name and "Classic · 3 packs", with no ticker or launchpad.
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

/** A new coin starts in presale: its presalePacks (default PRESALE_PACKS), launching when they sell out. */
function Meta({ c }: { c: PackConfig }) {
  if (c.kind === "classic") return <>Classic · <span className="num">{DEFAULT_SIZES.length}</span> packs</>;
  return <>Presale · <span className="num">{(c.presalePacks ?? PRESALE_PACKS).toLocaleString("en-US")}</span> packs</>;
}

/** The coin's launch mcap from its presale raise, or null while the presale is out of bounds. */
function mcapOf(c: PackConfig) {
  const packs = c.presalePacks ?? PRESALE_PACKS, price = standardPrice(c);
  if (presaleError(packs, price)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(launchMcap(packs * price));
}

/** SealedPack is laid out at 228×384; the preview shows three, scaled down and fanned like the marketplace card. */
const PACK_W = 228;
const PACK_H = 384;
const SCALE = 0.46;
const FAN = [{ r: -9, x: -66 }, { r: 0, x: 0 }, { r: 9, x: 66 }];

function PackFan({ c, name }: { c: PackConfig; name: string }) {
  const custom = customPack(c);
  const classic = c.kind === "classic";
  const sizes = (c.sizes?.length ? c.sizes : DEFAULT_SIZES).slice(0, 3);
  // ClassicPack only reads the collection's name and config.
  const asCoin = { name: name || "Collection", config: c } as unknown as MarketCoin;
  return (
    <div className="relative isolate h-[230px] overflow-hidden bg-[radial-gradient(120%_90%_at_50%_100%,var(--hair),transparent)]" aria-hidden="true">
      {sizes.map((s, i) => {
        const f = sizes.length === 1 ? FAN[1] : FAN[i];
        return (
          <div key={s.id} className="absolute top-1/2 left-1/2" style={{ width: PACK_W * SCALE, height: PACK_H * SCALE, marginLeft: (-PACK_W * SCALE) / 2 + f.x, marginTop: (-PACK_H * SCALE) / 2 + 8, rotate: `${f.r}deg`, zIndex: f.r === 0 ? 2 : 1 }}>
            <div className="overflow-hidden rounded-[4px] shadow-[0_14px_24px_-14px_#000c]" style={{ width: PACK_W, height: PACK_H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
              {classic
                ? <ClassicPack size={s} coin={custom ? asCoin : undefined} className="h-full justify-between shadow-none" />
                : <SealedPack size={s} coin={name || "Coin"} color={custom?.color} style={custom?.style} className="h-full justify-between shadow-none" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const badge = "inline-flex h-6 shrink-0 items-center rounded-full border border-border px-2 text-xs text-muted";

export function CoinPreview({ c, name, compact = false }: { c: PackConfig; name: string; compact?: boolean }) {
  const classic = c.kind === "classic";
  const shownName = name || (classic ? "Collection name" : "Coin name");
  const what = classic ? "Collection preview" : "Coin preview";
  const ticker = c.ticker || "TICKER";
  const links = c.links ?? {};
  const mcap = classic ? null : mcapOf(c);

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted p-2.5 pr-3" aria-label={what}>
        <CoinAvatar c={c} name={name} className="size-14 rounded-md text-xl" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className={cn("truncate text-base", !name && "text-muted")}>{shownName}</span>
            {!classic && <span className={cn("num shrink-0 text-[13px]", c.ticker ? "text-muted" : "text-muted/60")}>{ticker}</span>}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted"><Meta c={c} /></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!classic && <span className={badge}>{PAD_NAME[c.launchpad]}</span>}
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
    <article className="overflow-hidden rounded-md border border-border bg-surface-muted" aria-label={what}>
      <PackFan c={c} name={name} />
      <div className="flex flex-col gap-3 border-t border-border p-4">
        <div className="flex items-center gap-3">
          <CoinAvatar c={c} name={name} className="size-11 rounded-full text-lg" />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-xl leading-tight tracking-tight", !name && "text-muted")}>{shownName}</p>
            {!classic && <p className={cn("num mt-0.5 truncate text-sm", c.ticker ? "text-muted" : "text-muted/60")}>{ticker}</p>}
          </div>
          {!classic && <span className={badge}>{PAD_NAME[c.launchpad]}</span>}
        </div>
        {c.tagline.trim() && <p className="line-clamp-2 text-sm text-muted">{c.tagline.trim()}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-[13px] text-muted">
          <span className="truncate"><Meta c={c} />{mcap && <> · <span className="num">{mcap}</span> mcap</>}</span>
          {c.basket.length > 0 && (
            <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
              {c.basket.map((b) => <StockLogo key={b.ticker} ticker={b.ticker} size={20} className="rounded-full ring-2 ring-surface-muted" />)}
            </span>
          )}
        </div>
        {!classic && (links.website || links.x || links.telegram) && (
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
