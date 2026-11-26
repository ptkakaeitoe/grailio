"use client";

import { LogOut, RotateCcw } from "lucide-react";
import { DEMO_START_BNB, exitDemo, resetDemo, useDemo } from "@/lib/demo";
import { clearDemoCoins } from "@/lib/published-packs";
import { clearBoughtListings } from "@/lib/nft-market";
import { NetworkSwitch } from "@/components/network-switch";

const control = "inline-flex min-h-11 items-center gap-1.5 text-sm text-muted underline-offset-4 transition-colors hover:text-black hover:underline";

/** Reset / Exit demo, in the site footer while demo mode is on (ported from graily). */
export function DemoFooterControls() {
  const demo = useDemo();
  if (!demo.active) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-8">
      <button type="button" className={control} onClick={() => { if (window.confirm(`Reset demo? Your demo wallet goes back to ${DEMO_START_BNB} BNB, and your demo cards, coins and tokens are cleared.`)) { resetDemo(); clearDemoCoins(); clearBoughtListings(); } }}>
        <RotateCcw className="size-3.5" /> Reset demo
      </button>
      <button type="button" className={control} onClick={exitDemo}>
        <LogOut className="size-3.5" /> Exit demo
      </button>
      {/* Phones: the footer row above is hidden, and Connect (which has the switch) is replaced by the demo badge. */}
      <NetworkSwitch className="desk:hidden" />
    </div>
  );
}
