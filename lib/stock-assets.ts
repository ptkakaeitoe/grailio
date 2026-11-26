import type { Address } from "viem";

import stocksConfig from "../contracts/script/stocks.mainnet.json" with { type: "json" };
import testnetStocks from "../contracts/script/stocks.testnet.json" with { type: "json" };

/** The testnet build (NEXT_PUBLIC_NETWORK=testnet, lib/network.ts) uses the trade market's test stock tokens. Read
 *  from the env directly so node tests can import this file without the @ alias. */
const TESTNET = process.env.NEXT_PUBLIC_NETWORK !== "mainnet";
const TESTNET_TOKENS: Record<string, string> = Object.fromEntries(testnetStocks.stocks.map((s) => [s.ticker, s.token]));

/**
 * Tokenized stocks (bStocks) that cards can hold, derived from
 * contracts/script/stocks.mainnet.json (the deploy's source of truth; on testnet the token addresses come from
 * stocks.testnet.json, same order).
 * Asset ID = index in `stocks`. Card art, labels, logos, token info, Atlas
 * prices, rooms and the market all read from this list.
 *
 * - logo: /logos/{TICKER}B.png (public/logos).
 */
export type StockAsset = {
  assetId: number;
  /** Plain ticker shown on cards, e.g. "NVDA". */
  ticker: string;
  /** On-chain token symbol, e.g. "NVDAB" (what wallets and BscScan show). */
  symbol: string;
  /** Company or fund name, e.g. "NVIDIA". */
  name: string;
  address: Address;
  decimals: number;
  atlasFeedId: number;
  accent: string;
  logo: string;
};

export const STOCK_ASSETS: StockAsset[] = stocksConfig.stocks.map((s, assetId) => ({
  assetId,
  ticker: s.ticker,
  symbol: s.symbol,
  name: s.name,
  // Same ticker, art and Atlas feed on both networks; testnet cards hold the test token.
  address: (TESTNET ? TESTNET_TOKENS[s.ticker] ?? s.token : s.token) as Address,
  decimals: 18,
  atlasFeedId: s.atlasFeedId,
  accent: s.accent,
  logo: `/logos/${s.ticker}B.png`,
}));

export const STOCK_BY_TICKER: Record<string, StockAsset> = Object.fromEntries(STOCK_ASSETS.map((s) => [s.ticker, s]));
export const STOCK_BY_ASSET: Record<number, StockAsset> = Object.fromEntries(STOCK_ASSETS.map((s) => [s.assetId, s]));

export const isStock = (ticker: string) => ticker in STOCK_BY_TICKER;

/** Token symbol to show for a ticker: the on-chain symbol for stocks ("NVDA" → "NVDAB"), else unchanged. */
export const tokenLabel = (ticker: string): string => STOCK_BY_TICKER[ticker]?.symbol ?? ticker;

export const stockLogo = (ticker: string): string | undefined => STOCK_BY_TICKER[ticker]?.logo;

/** Ticker for a card's asset ID, or undefined for one the app doesn't know. */
export const tickerForAsset = (asset: number | bigint): string | undefined => STOCK_BY_ASSET[Number(asset)]?.ticker;

export type EditionKey = "fable" | "saga" | "mythos";

/** The five stocks each pack edition (all its risk levels) draws from. */
export const BASKETS: Readonly<Record<EditionKey, readonly string[]>> = stocksConfig.baskets;

/** On-chain tiers: 0-2 Fable, 3-5 Saga, 6-8 Mythos (Low, Medium, High each). */
export const editionKeyForTier = (tierId: number): EditionKey =>
  tierId >= 6 ? "mythos" : tierId >= 3 ? "saga" : "fable";

/** The tickers a tier's packs draw from. */
export const basketForTier = (tierId: number): readonly string[] => BASKETS[editionKeyForTier(tierId)];
