/**
 * Token prices from Avalanche DEX pools, shared by /api/prices and
 * /api/history.
 *
 * - Live price: read on-chain from pinned pools (Uniswap v3 slot0, LFJ v1
 *   reserves). Pools quoted in WAVAX are converted with the WAVAX/USDC pool.
 *   USDC is treated as $1.
 * - 24h change and charts: GeckoTerminal (DEX trade data) for the same pools.
 *
 * Pools were chosen by liquidity on 2026-11-22. LINK and JOE pools are thin
 * (well under $250k), so their prices are easier to move; don't settle real
 * value against them without a TWAP or a second source.
 */
import { createPublicClient, http, type Address } from "viem";

import { appChain, rpcUrl } from "@/lib/chain";

export type StockQuote = {
  ticker: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
};

type Pool = {
  kind: "v3" | "v2";
  address: Address;
  /** The token being priced, and the pool's other side. */
  token: Address;
  quote: "USDC" | "WAVAX";
};

const TOKENS = {
  USDC: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  WAVAX: { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", decimals: 18 },
  BTCb: { address: "0x152b9d0FdC40C096757F570A51E494bd4b943E50", decimals: 8 },
  WETHe: { address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", decimals: 18 },
  LINKe: { address: "0x5947BB275c521040051D82396192181b413227A3", decimals: 18 },
  JOE: { address: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", decimals: 18 },
} as const satisfies Record<string, { address: Address; decimals: number }>;

const DECIMALS = new Map<string, number>(
  Object.values(TOKENS).map((t) => [t.address.toLowerCase(), t.decimals]),
);

/** Card ticker → pool. AVAX (native, used to pay) shares the WAVAX pool. */
const AVAX_POOL: Pool = { kind: "v3", address: "0xfae3f424a0a47706811521e3ee268f00cfb5c45e", token: TOKENS.WAVAX.address, quote: "USDC" }; // Uniswap v3 WAVAX/USDC 0.05%
export const POOLS: Record<string, Pool> = {
  WAVAX: AVAX_POOL,
  AVAX: AVAX_POOL,
  BTC: { kind: "v3", address: "0x2e587b9e7aa638d7eb7db5fe7447513bc4d0d28b", token: TOKENS.BTCb.address, quote: "USDC" }, // Uniswap v3 BTC.b/USDC 0.05%
  ETH: { kind: "v3", address: "0x7b602f98d71715916e7c963f51bfebc754ade2d0", token: TOKENS.WETHe.address, quote: "WAVAX" }, // Uniswap v3 WETH.e/WAVAX 0.05%
  LINK: { kind: "v3", address: "0xeb7e0191f4054868d97f33ca7a4176b226ccbd2f", token: TOKENS.LINKe.address, quote: "WAVAX" }, // Uniswap v3 LINK.e/WAVAX 1%
  JOE: { kind: "v2", address: "0x454e67025631c065d3cfad6d71e6892f74487a15", token: TOKENS.JOE.address, quote: "WAVAX" }, // LFJ v1 JOE/WAVAX
};

/** The pool functions we read: slot0 on Uniswap v3 pools, getReserves on LFJ v1 pairs. */
const poolAbi = [
  { type: "function", name: "slot0", inputs: [], outputs: [{ type: "uint160", name: "sqrtPriceX96" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getReserves", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }], stateMutability: "view" },
  { type: "function", name: "token0", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "token1", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const client = createPublicClient({ chain: appChain, transport: http(rpcUrl) });

const decimalsOf = (address: string) => {
  const d = DECIMALS.get(address.toLowerCase());
  if (d === undefined) throw new Error(`Unknown token ${address}`);
  return d;
};

/** Price of pool.token in units of the pool's other token, read on-chain. */
async function readPoolPrices(pools: Pool[]): Promise<Map<string, number | null>> {
  const unique = [...new Map(pools.map((p) => [p.address.toLowerCase(), p])).values()];
  const calls = unique.flatMap((p) =>
    (["state", "token0", "token1"] as const).map((fn) => ({
      address: p.address,
      abi: poolAbi,
      functionName: fn === "state" ? (p.kind === "v3" ? "slot0" : "getReserves") : fn,
    })),
  );
  const results = await client.multicall({ contracts: calls, allowFailure: true });

  const prices = new Map<string, number | null>();
  unique.forEach((pool, i) => {
    const [state, t0, t1] = results.slice(i * 3, i * 3 + 3);
    if (state.status !== "success" || t0.status !== "success" || t1.status !== "success") {
      prices.set(pool.address.toLowerCase(), null);
      return;
    }
    const token0 = t0.result as Address;
    const token1 = t1.result as Address;
    const d0 = decimalsOf(token0);
    const d1 = decimalsOf(token1);
    // Price of token0 in token1, adjusted for decimals.
    let price0In1: number;
    if (pool.kind === "v3") {
      const sqrt = Number((state.result as readonly unknown[])[0] as bigint) / 2 ** 96;
      price0In1 = sqrt * sqrt * 10 ** (d0 - d1);
    } else {
      const [r0, r1] = state.result as readonly [bigint, bigint, number];
      price0In1 = (Number(r1) / 10 ** d1) / (Number(r0) / 10 ** d0);
    }
    const isToken0 = token0.toLowerCase() === pool.token.toLowerCase();
    const price = isToken0 ? price0In1 : 1 / price0In1;
    prices.set(pool.address.toLowerCase(), Number.isFinite(price) && price > 0 ? price : null);
  });
  return prices;
}

const GECKO = "https://api.geckoterminal.com/api/v2/networks/avax";
const GECKO_HEADERS = { Accept: "application/json;version=20230302" };

/** 24h change per pool address (lowercase), from GeckoTerminal. */
async function fetchChanges(addresses: string[]): Promise<Map<string, number>> {
  const changes = new Map<string, number>();
  try {
    const res = await fetch(`${GECKO}/pools/multi/${addresses.join(",")}`, { headers: GECKO_HEADERS, next: { revalidate: 60 } });
    if (!res.ok) return changes;
    const json = await res.json();
    for (const row of json?.data ?? []) {
      const pct = Number(row?.attributes?.price_change_percentage?.h24);
      const address = String(row?.attributes?.address ?? "").toLowerCase();
      if (address && Number.isFinite(pct)) changes.set(address, pct);
    }
  } catch {
    // Change is optional; prices still render.
  }
  return changes;
}

/** All quotes at once: one multicall plus one change request, cached briefly. */
let cache: { at: number; quotes: Promise<Map<string, StockQuote>> } | null = null;
const CACHE_MS = 30_000;

async function loadQuotes(): Promise<Map<string, StockQuote>> {
  const tickers = Object.keys(POOLS);
  const pools = tickers.map((t) => POOLS[t]);
  const addresses = [...new Set(pools.map((p) => p.address.toLowerCase()))];
  const [raw, changes] = await Promise.all([readPoolPrices(pools), fetchChanges(addresses)]);

  const avaxUsd = raw.get(AVAX_POOL.address.toLowerCase()) ?? null;
  const quotes = new Map<string, StockQuote>();
  for (const ticker of tickers) {
    const pool = POOLS[ticker];
    const inQuote = raw.get(pool.address.toLowerCase()) ?? null;
    const price = inQuote === null ? null : pool.quote === "USDC" ? inQuote : avaxUsd === null ? null : inQuote * avaxUsd;
    const changePct = changes.get(pool.address.toLowerCase()) ?? null;
    quotes.set(ticker, {
      ticker,
      price,
      previousClose: price !== null && changePct !== null ? price / (1 + changePct / 100) : null,
      changePct,
    });
  }
  return quotes;
}

export async function fetchQuote(ticker: string): Promise<StockQuote> {
  const empty: StockQuote = { ticker, price: null, previousClose: null, changePct: null };
  if (!POOLS[ticker]) return empty;
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const quotes = loadQuotes();
    cache = { at: Date.now(), quotes };
    // A failed load must not stick in the cache.
    quotes.catch(() => { if (cache?.quotes === quotes) cache = null; });
  }
  try {
    return (await cache.quotes).get(ticker) ?? empty;
  } catch {
    // A dead RPC must not take the page down; the UI renders "—".
    return empty;
  }
}

export const HISTORY_PERIODS = ["1H", "24H", "7D", "30D"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export type PriceHistory = { ticker: string; period: HistoryPeriod; points: { t: number; p: number }[] };

/** GeckoTerminal candles per timeframe. */
const WINDOWS: Record<HistoryPeriod, { timeframe: "minute" | "hour" | "day"; aggregate: number; limit: number }> = {
  "1H": { timeframe: "minute", aggregate: 1, limit: 60 },
  "24H": { timeframe: "minute", aggregate: 15, limit: 96 },
  "7D": { timeframe: "hour", aggregate: 1, limit: 168 },
  "30D": { timeframe: "hour", aggregate: 4, limit: 180 },
};
const MAX_POINTS = 120;

/** USD price history for one token from its DEX pool; empty points if upstream fails. */
export async function fetchHistory(ticker: string, period: HistoryPeriod): Promise<PriceHistory> {
  const empty: PriceHistory = { ticker, period, points: [] };
  const pool = POOLS[ticker];
  if (!pool) return empty;
  try {
    const { timeframe, aggregate, limit } = WINDOWS[period];
    const res = await fetch(
      `${GECKO}/pools/${pool.address}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${pool.token}`,
      { headers: GECKO_HEADERS, next: { revalidate: 60 } },
    );
    if (!res.ok) { console.warn(`[history] GeckoTerminal ${res.status} for ${ticker} ${period}`); return empty; }
    const list: number[][] = (await res.json())?.data?.attributes?.ohlcv_list ?? [];
    // [timestamp, open, high, low, close, volume], newest first.
    const all = list
      .filter((row) => Number.isFinite(row[0]) && Number.isFinite(row[4]))
      .map((row) => ({ t: row[0], p: row[4] }))
      .sort((a, b) => a.t - b.t);
    if (all.length < 2) return empty;

    // The on-chain price is fresher than the last candle; end the series on it.
    const live = (await fetchQuote(ticker)).price;
    if (live !== null) all[all.length - 1] = { ...all[all.length - 1], p: live };

    const step = Math.ceil(all.length / MAX_POINTS);
    const points = all.filter((_, i) => i % step === 0 || i === all.length - 1);
    return { ticker, period, points };
  } catch {
    return empty;
  }
}
