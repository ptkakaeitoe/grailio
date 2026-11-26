"use client";

import { cn } from "@/components/clean-ui";
import { IS_TESTNET } from "@/lib/network";

/**
 * Testnet / Mainnet beta. This app is the mainnet beta (BNB Smart Chain); the testnet is a separate deployment,
 * linked by NEXT_PUBLIC_TESTNET_URL (in development it falls back to the testnet dev server on port 3200). Without a
 * URL the testnet side shows as unavailable.
 */
const TESTNET_URL = process.env.NEXT_PUBLIC_TESTNET_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3200" : "");
/** On the testnet build (lib/network.ts) the switch points the other way: Testnet is current, Mainnet is a link. */
const MAINNET_URL = process.env.NEXT_PUBLIC_MAINNET_URL || "https://www.grailio.xyz";

const pill = "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm transition-colors";

/** `wide`: two equal halves across the full width (the connect modal). */
export function NetworkSwitch({ className, wide = false }: { className?: string; wide?: boolean }) {
  const half = wide ? "justify-center min-h-10" : "";
  if (IS_TESTNET) {
    return (
      <div role="group" aria-label="Network" className={cn(wide ? "grid w-full grid-cols-2" : "inline-flex items-center", "gap-1 rounded-full border border-border p-1", className)}>
        <span aria-current="true" className={cn(pill, half, "bg-black text-white")}>
          <span className="size-1.5 rounded-full bg-up" aria-hidden="true" />
          Testnet
        </span>
        <a href={MAINNET_URL} className={cn(pill, half, "text-muted hover:text-black")}>Mainnet</a>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Network" className={cn(wide ? "grid w-full grid-cols-2" : "inline-flex items-center", "gap-1 rounded-full border border-border p-1", className)}>
      {TESTNET_URL ? (
        <a href={TESTNET_URL} className={cn(pill, half, "text-muted hover:text-black")}>Testnet</a>
      ) : (
        <span className={cn(pill, half, "text-muted")} aria-disabled="true" title="Testnet is unavailable">
          Testnet
        </span>
      )}
      <span aria-current="true" className={cn(pill, half, "bg-black text-white")}>
        <span className="size-1.5 rounded-full bg-up" aria-hidden="true" />
        Mainnet beta
      </span>
    </div>
  );
}
