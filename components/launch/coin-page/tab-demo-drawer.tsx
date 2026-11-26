"use client";

import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { cleanButton, cn } from "@/components/clean-ui";

import type { CoinPack } from "./types";

/** Demo-only controls, folded away at the bottom of the page: they only exist in demo mode. */
export function TabDemoDrawer({ demo }: { demo: NonNullable<CoinPack["demo"]> }) {
  if (!demo.simulateBuyers && !demo.simulateTrading) return null;
  return (
    <details className="group mt-10 rounded-md border border-dashed border-border-strong">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-muted [&::-webkit-details-marker]:hidden">
        Demo controls
        <CaretDownIcon weight="bold" className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {demo.simulateBuyers && <button type="button" className={cn(cleanButton.small, "min-h-9")} onClick={demo.simulateBuyers}>Simulate other buyers</button>}
        {demo.simulateTrading && <button type="button" className={cn(cleanButton.small, "min-h-9")} onClick={demo.simulateTrading}>Simulate trading</button>}
      </div>
    </details>
  );
}
