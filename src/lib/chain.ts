import { bscTestnet } from "viem/chains";

/**
 * The app runs on BNB Smart Chain testnet (chain id 97). Every chain reference
 * goes through this module, so switching networks is a one-file change.
 */
export const appChain = bscTestnet;

/** Public RPC is rate-limited; set NEXT_PUBLIC_BSC_RPC_URL to use your own. */
export const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || bscTestnet.rpcUrls.default.http[0];

export const explorerUrl = "https://testnet.bscscan.com";

/** Gas token symbol for messages ("tBNB" on testnet). */
export const gasSymbol = appChain.nativeCurrency.symbol;
