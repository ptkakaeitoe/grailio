import type { Address } from "viem";

import { STOCK_ASSETS } from "@/lib/stock-assets";

/**
 * Real BNB Smart Chain tokens the app prices and swaps, keyed by the symbol
 * the UI shows. Card tickers (lib/cards.ts) map onto these. BNB is the native
 * coin, which aggregators address with the 0xEeee… sentinel.
 *
 * Every address and decimals value was read on chain 56 on 2026-11-26. Note
 * that USDC on BNB Chain (Binance-Peg) has 18 decimals, not 6.
 */
export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export type TokenInfo = { symbol: string; address: Address; decimals: number; native?: true };

/** The testnet build (lib/network.ts); read from the env so node tests can import this file. */
const TESTNET = process.env.NEXT_PUBLIC_NETWORK !== "mainnet";

/** Flap's free-mint test dollar on BSC testnet: the testnet's pay token (anyone can call mint). */
export const TEST_USD: Address = "0x190C989D5665a0e404B444b53CAE9AbCfb600157";

/**
 * Testnet: pay with test USD (kept under the "USDT" key so every pack, market and staking path is shared, shown as
 * "USD") or BNB; the stocks are the trade market's test tokens.
 */
const TESTNET_TOKENS: Record<string, TokenInfo> = {
  USDT: { symbol: "USD", address: TEST_USD, decimals: 18 },
  BNB: { symbol: "BNB", address: NATIVE, decimals: 18, native: true },
  WBNB: { symbol: "WBNB", address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", decimals: 18 },
  ...Object.fromEntries(STOCK_ASSETS.map((s) => [s.ticker, { symbol: s.ticker, address: s.address, decimals: s.decimals }])),
};

const MAINNET_TOKENS: Record<string, TokenInfo> = {
  USDT: { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  USDC: { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  BNB: { symbol: "BNB", address: NATIVE, decimals: 18, native: true },
  WBNB: { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
  BTC: { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
  ETH: { symbol: "ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
  LINK: { symbol: "LINK", address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", decimals: 18 },
  CAKE: { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
  // Tokenized stocks, keyed by their plain ticker (lib/stock-assets.ts).
  ...Object.fromEntries(STOCK_ASSETS.map((s) => [s.ticker, { symbol: s.ticker, address: s.address, decimals: s.decimals }])),
};

export const TOKENS: Record<string, TokenInfo> = TESTNET ? TESTNET_TOKENS : MAINNET_TOKENS;

/** What /trade pays and receives with: USDT, USDC and BNB. */
export const SWAP_BASES = (TESTNET ? ["USDT", "BNB"] : ["USDT", "USDC", "BNB"]) as readonly string[];
/** Everything /trade can swap: the bases plus every tokenized stock. */
export const SWAP_KEYS: string[] = [...SWAP_BASES, ...STOCK_ASSETS.map((s) => s.ticker)];
/** A token /trade can swap, by key. */
export const swapTokenFor = (key: string): TokenInfo | undefined => (SWAP_KEYS.includes(key) ? TOKENS[key] : undefined);

/**
 * The packs, market and staking contracts' base token: BNB Chain USDT (18 decimals), or test USD on testnet.
 * Pack prices, card USD values, listings in dollars, staking rewards and the treasury all use it.
 */
export const PACK_TOKEN: TokenInfo = TOKENS.USDT;
export const PACK_SYMBOL = PACK_TOKEN.symbol;
/** Decimals of every USD amount from the contracts. */
export const PACK_DECIMALS = PACK_TOKEN.decimals;

export const tokenFor = (key: string): TokenInfo | undefined => TOKENS[key];

/** KyberSwap's MetaAggregationRouterV2 (same address on BNB Chain). Swaps may only be sent here. */
export const SWAP_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as Address;
