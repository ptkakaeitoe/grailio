import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SwapWorkspace } from "@/components/swap-workspace";
import { TestnetTrade } from "@/components/testnet-trade";
import { IS_TESTNET } from "@/lib/network";

export const metadata: Metadata = {
  title: "Trade — grailio",
  description: IS_TESTNET
    ? "Buy and sell tokenized stocks with free test USD on BSC testnet."
    : "Swap USDT, USDC and BNB for tokenized stocks on BNB Chain.",
};

/** Mainnet: KyberSwap swaps. Testnet build: the testnet trade market (lib/network.ts). */
export default function TradePage() {
  return <PageShell>{IS_TESTNET ? <TestnetTrade /> : <SwapWorkspace />}</PageShell>;
}
