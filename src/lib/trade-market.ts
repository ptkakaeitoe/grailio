import { parseAbi, type Address } from "viem";
import deployments from "../../contracts/deployments/97.json" with { type: "json" };
import { FLAP } from "@/lib/onchain";

/*
 * The trade market on BSC testnet: real buys and sells of mock bStocks, paid in Flap's free test USD or tBNB, at Atlas
 * prices a keeper posts (app/api/testnet/prices). Addresses come from contracts/deployments/97.json ("tradeMarket",
 * "tradeStocks"); until those exist the app stays in demo mode. Server- and client-safe.
 */

const d = deployments as { tradeMarket?: string; tradeStocks?: Record<string, string> };

/** The trade market, or null before it's deployed (everything stays simulated). */
export const TRADE_MARKET: Address | null = d.tradeMarket ? (d.tradeMarket as Address) : null;

/** Mock bStocks listed on the trade market, by plain ticker (NVDA → its token). */
export const TRADE_STOCKS: Record<string, Address> = Object.fromEntries(
  Object.entries(d.tradeStocks ?? {}).map(([ticker, addr]) => [ticker, addr as Address]),
);

/** Real trading is switched on (the market is deployed). */
export const tradeLive = TRADE_MARKET !== null;

/** Whether `ticker` can be traded for real (listed on the deployed market). */
export const tradableTicker = (ticker: string) => tradeLive && ticker in TRADE_STOCKS;

/** Flap's free-mint testnet USD (18 decimals): the trade market's main currency. Anyone may mint it. */
export const TEST_USD: Address = FLAP.usd;
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
  "event Bought(address indexed stock, address indexed quote, address indexed to, uint256 paid, uint256 amount)",
  "event Sold(address indexed stock, address indexed quote, address indexed from, uint256 amount, uint256 paid)",
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
