import { avalanche } from "viem/chains";

/**
 * Grailio runs on Avalanche C-Chain mainnet (43114), in beta. Every chain
 * reference in the app goes through this module, so switching networks is a
 * one-file change.
 */
export const appChain = avalanche;

/** Public RPC is rate-limited; set NEXT_PUBLIC_AVALANCHE_RPC_URL for production. */
export const rpcUrl =
  process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ?? "https://api.avax.network/ext/bc/C/rpc";

export const explorerUrl = "https://snowtrace.io";

/** Shown in the header and footer while the app is in beta. */
export const BETA = true;
