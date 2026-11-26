import type { Address } from "viem";

/**
 * Real Avalanche C-Chain tokens the app prices and swaps, keyed by the symbol
 * the UI shows. Card tickers (lib/cards.ts) map onto these. AVAX is the native
 * coin, which aggregators address with the 0xEeee… sentinel.
 */
export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export type TokenInfo = { symbol: string; address: Address; decimals: number; native?: true };

export const TOKENS: Record<string, TokenInfo> = {
  USDC: { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  AVAX: { symbol: "AVAX", address: NATIVE, decimals: 18, native: true },
  WAVAX: { symbol: "WAVAX", address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", decimals: 18 },
  BTC: { symbol: "BTC.b", address: "0x152b9d0FdC40C096757F570A51E494bd4b943E50", decimals: 8 },
  ETH: { symbol: "WETH.e", address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", decimals: 18 },
  LINK: { symbol: "LINK.e", address: "0x5947BB275c521040051D82396192181b413227A3", decimals: 18 },
  JOE: { symbol: "JOE", address: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", decimals: 18 },
};

export const tokenFor = (key: string): TokenInfo | undefined => TOKENS[key];

/** KyberSwap's MetaAggregationRouterV2. Swaps may only be sent here. */
export const SWAP_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as Address;
