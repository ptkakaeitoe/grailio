"use client";

import { cn } from "@/components/clean-ui";

/**
 * Testnet / Mainnet beta. This app is the testnet; mainnet is a separate deployment (the `mainnet/` app), linked by
 * NEXT_PUBLIC_MAINNET_URL. Without that URL the mainnet side shows as coming soon.
 */
const MAINNET_URL = process.env.NEXT_PUBLIC_MAINNET_URL ?? "";

const pill = "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm transition-colors";

export function NetworkSwitch({ className }: { className?: string }) {
  return (
    <div role="group" aria-label="Network" className={cn("inline-flex items-center gap-1 rounded-full border border-border p-1", className)}>
      <span aria-current="true" className={cn(pill, "bg-black text-white")}>
        <span className="size-1.5 rounded-full bg-up" aria-hidden="true" />
        Testnet
      </span>
      {MAINNET_URL ? (
        <a href={MAINNET_URL} className={cn(pill, "text-muted hover:text-black")}>Mainnet beta</a>
      ) : (
        <span className={cn(pill, "text-muted")} aria-disabled="true" title="Mainnet beta is coming soon">
          Mainnet beta
        </span>
      )}
    </div>
  );
}
