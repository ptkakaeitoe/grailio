import { parseAbi, type Address } from "viem";

import { deployment, IS_TESTNET } from "@/lib/network";
import { STOCK_ASSETS } from "@/lib/stock-assets";
import { TEST_USD } from "@/lib/tokens";

/*
 * Testnet build only: the trade market on BSC testnet replaces KyberSwap. Real buys and sells of the test stocks, paid
 * in Flap's free test USD or tBNB, at Atlas prices a keeper posts (app/api/testnet/prices). Null on mainnet.
 */
export const TRADE_MARKET: Address | null = IS_TESTNET && deployment.tradeMarket ? (deployment.tradeMarket as Address) : null;
export const tradeLive = TRADE_MARKET !== null;

/** The test stocks the market lists, by plain ticker (same 15 as mainnet). */
export const TRADE_STOCKS: Record<string, Address> = IS_TESTNET ? Object.fromEntries(STOCK_ASSETS.map((s) => [s.ticker, s.address])) : {};

export { TEST_USD };
/** What "Claim test USD" mints: 100 (18 decimals). */
export const TEST_USD_CLAIM = 100n * 10n ** 18n;

export const tradeMarketAbi = parseAbi([
  "function buy(address stock, address to) payable returns (uint256)",
  "function buyWith(address stock, address quote, uint256 amount, address to) returns (uint256)",
  "function sellFor(address stock, address quote, uint256 amount, address to) returns (uint256)",
  "function priceIn(address stock, address quote) view returns (uint256)",
  "function usdPrice(address stock) view returns (uint256)",
  "function priceAt(address stock) view returns (uint256)",
  "function setUsdPrices(address[] stocks, uint256[] usd)",
]);

/** Flap test USD: an ERC20 whose mint is open to anyone. */
export const testUsdAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/** Ask the keeper to refresh on-chain prices for `tickers` before a trade (best effort: never throws, 5 s max). */
export async function refreshTradePrices(tickers: string[]): Promise<void> {
  try {
    await fetch("/api/testnet/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* trade at the last posted price */
  }
}
