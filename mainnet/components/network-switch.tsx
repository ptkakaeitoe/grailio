"use client";

import { cn } from "@/components/clean-ui";

/**
 * Testnet / Mainnet beta. This app is the mainnet beta (BNB Smart Chain); the testnet is a separate deployment,
 * linked by NEXT_PUBLIC_TESTNET_URL. Without that URL the testnet side shows as unavailable.
 */
const TESTNET_URL = process.env.NEXT_PUBLIC_TESTNET_URL ?? "";

const pill = "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm transition-colors";

export function NetworkSwitch({ className }: { className?: string }) {
  return (
    <div role="group" aria-label="Network" className={cn("inline-flex items-center gap-1 rounded-full border border-border p-1", className)}>
      {TESTNET_URL ? (
        <a href={TESTNET_URL} className={cn(pill, "text-muted hover:text-black")}>Testnet</a>
      ) : (
        <span className={cn(pill, "text-muted")} aria-disabled="true" title="Testnet is unavailable">
          Testnet
        </span>
      )}
      <span aria-current="true" className={cn(pill, "bg-black text-white")}>
        <span className="size-1.5 rounded-full bg-up" aria-hidden="true" />
        Mainnet beta
      </span>
    </div>
  );
}
