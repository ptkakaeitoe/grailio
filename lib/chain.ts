import { bsc, bscTestnet } from "viem/chains";

import { IS_TESTNET } from "@/lib/network";

/**
 * Grailio runs on BNB Smart Chain mainnet (chain 56), in beta, or on BSC testnet (chain 97) when built with
 * NEXT_PUBLIC_NETWORK=testnet (lib/network.ts). Every chain reference in the app goes through this module.
 */
export const appChain = IS_TESTNET ? bscTestnet : bsc;

/** Public RPC is rate-limited; set NEXT_PUBLIC_BSC_RPC_URL for production. */
export const rpcUrl =
  process.env.NEXT_PUBLIC_BSC_RPC_URL || (IS_TESTNET ? "https://bsc-testnet-rpc.publicnode.com" : "https://bsc-dataseed.bnbchain.org");

export const explorerUrl = IS_TESTNET ? "https://testnet.bscscan.com" : "https://bscscan.com";

/** How the app names its network in labels. */
export const chainLabel = IS_TESTNET ? "BSC testnet" : "BNB Chain";

/**
 * Market prices always come from BNB Smart Chain mainnet (PancakeSwap pools), even on the testnet build: test
 * tokens have no market of their own, so the testnet prices them like the real ones.
 */
export const priceChain = bsc;
export const priceRpcUrl = IS_TESTNET ? "https://bsc-dataseed.bnbchain.org" : rpcUrl;

/** Shown in the header and footer while the app is in beta. */
export const BETA = true;
