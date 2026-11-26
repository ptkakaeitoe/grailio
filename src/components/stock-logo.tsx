"use client";

import { useState } from "react";
import { logoFor } from "@/lib/atlas-feeds";
import { cn } from "@/lib/format";

/** bStock logo (CoinMarketCap art, served from /public/logos). Falls back to a letter bubble. */
export function StockLogo({ ticker, size = 20, className }: { ticker: string; size?: number; className?: string }) {
  const src = logoFor(ticker);
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-raised-strong font-medium text-ink-soft", className)} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
        {ticker.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local logos; next/image adds nothing here
    <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} className={cn("shrink-0 rounded-full", className)} style={{ width: size, height: size }} />
  );
}
