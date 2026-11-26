import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SwapWorkspace } from "@/components/swap-workspace";

export const metadata: Metadata = {
  title: "Trade — graily",
  description: "Swap USDC and AVAX for Avalanche tokens at DEX prices.",
};

export default function TradePage() {
  return <PageShell><SwapWorkspace /></PageShell>;
}
