"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { useAccount } from "wagmi";
import { cleanButton, cn } from "@/components/clean-ui";
import { WalletEntry } from "@/components/wallet-entry";
import { useDemo } from "@/lib/demo";

/** The hero's first button: Connect wallet until there's a wallet (or the demo), then explore packs. */
export function HeroPrimaryCta() {
  const { isConnected } = useAccount();
  const demo = useDemo();
  if (!isConnected && !demo.active) return <WalletEntry className={cn(cleanButton.solid, "lowercase desk:min-h-[58px]")} />;
  return (
    <Link href="/app/packs" className={cn(cleanButton.solid, "lowercase desk:min-h-[58px]")}>
      explore packs <ArrowUpRight weight="bold" className="arrow-nudge" aria-hidden="true" />
    </Link>
  );
}

/** The hero's second button: explore packs before a wallet is connected, launch a coin after. */
export function HeroSecondaryCta({ className }: { className: string }) {
  const { isConnected } = useAccount();
  const demo = useDemo();
  const first = !isConnected && !demo.active;
  return (
    <Link href={first ? "/app/packs" : "/launch"} className={className}>
      {first ? "explore packs" : "launch a coin"} <ArrowUpRight weight="bold" className="arrow-nudge" aria-hidden="true" />
    </Link>
  );
}
