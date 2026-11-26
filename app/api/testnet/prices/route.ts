import { connection } from "next/server";
import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { readAtlasPrices } from "@/lib/atlas";
import { appChain, priceChain, priceRpcUrl, rpcUrl } from "@/lib/chain";
import { IS_TESTNET } from "@/lib/network";
import { limitStore } from "@/lib/relay-limits";
import { STOCK_BY_TICKER } from "@/lib/stock-assets";
import { TRADE_MARKET, TRADE_STOCKS, tradeMarketAbi } from "@/lib/trade-market";

/**
 * Testnet build only. Keeps the trade market's prices fresh, lazily: the app calls this just before a real trade. For
 * the stocks asked about it compares the on-chain price with Atlas's (read from BNB Chain mainnet) and, when one is
 * over 5 minutes old or more than 0.3% off, sends one setUsdPrices from the keeper wallet (TESTNET_KEEPER_KEY, which
 * may only post prices). At most one update every 30 seconds across instances.
 */
const MAX_AGE_S = 5 * 60;
const MAX_DRIFT = 0.003;
const COOLDOWN_MS = 30_000;
let lastSend = 0;

async function takeLock(): Promise<boolean> {
  const store = limitStore();
  if (store) {
    try { return await store.lock("testnet:prices:lock", "1", COOLDOWN_MS); } catch { /* fall back to memory */ }
  }
  if (Date.now() - lastSend < COOLDOWN_MS) return false;
  lastSend = Date.now();
  return true;
}

export async function POST(request: Request) {
  await connection();
  if (!IS_TESTNET) return Response.json({ error: "Not found" }, { status: 404 });
  if (!TRADE_MARKET) return Response.json({ error: "Trade market isn't deployed yet" }, { status: 503 });
  const raw = process.env.TESTNET_KEEPER_KEY;
  if (!raw) return Response.json({ error: "Price keeper isn't configured" }, { status: 503 });

  let body: { tickers?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body: every listed stock */ }
  const asked = Array.isArray(body.tickers) ? body.tickers.filter((t): t is string => typeof t === "string") : Object.keys(TRADE_STOCKS);
  const tickers = asked.filter((t) => t in TRADE_STOCKS && STOCK_BY_TICKER[t]);
  if (tickers.length === 0) return Response.json({ updated: [], skipped: "no listed stocks asked for" });

  const client = createPublicClient({ chain: appChain, transport: http(rpcUrl) });
  const prices = createPublicClient({ chain: priceChain, transport: http(priceRpcUrl) });
  const market = TRADE_MARKET;
  try {
    const [atlas, onchain] = await Promise.all([
      readAtlasPrices(prices as never, tickers.map((t) => STOCK_BY_TICKER[t].atlasFeedId)),
      Promise.all(tickers.map(async (t) => {
        const stock = TRADE_STOCKS[t];
        const [usd, at] = await Promise.all([
          client.readContract({ address: market, abi: tradeMarketAbi, functionName: "usdPrice", args: [stock] }),
          client.readContract({ address: market, abi: tradeMarketAbi, functionName: "priceAt", args: [stock] }),
        ]);
        return { usd, at };
      })),
    ]);
    const now = Math.floor(Date.now() / 1000);
    const stale: { ticker: string; stock: Address; usd: bigint }[] = [];
    tickers.forEach((t, i) => {
      const price = atlas.get(STOCK_BY_TICKER[t].atlasFeedId)?.price;
      if (!price) return;
      const fresh = parseUnits(price.toFixed(8), 18);
      const { usd, at } = onchain[i];
      const old = now - Number(at) > MAX_AGE_S;
      const drift = usd === 0n ? 1 : Math.abs(Number(fresh - usd)) / Number(usd);
      if (old || drift > MAX_DRIFT) stale.push({ ticker: t, stock: TRADE_STOCKS[t], usd: fresh });
    });
    if (stale.length === 0) return Response.json({ updated: [], skipped: "prices are fresh" });
    if (!(await takeLock())) return Response.json({ updated: [], skipped: "an update was sent moments ago" });

    const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
    const wallet = createWalletClient({ account, chain: appChain, transport: http(rpcUrl) });
    const hash = await wallet.writeContract({
      address: market,
      abi: tradeMarketAbi,
      functionName: "setUsdPrices",
      args: [stale.map((s) => s.stock), stale.map((s) => s.usd)],
      gasPrice: 100_000_000n, // 0.1 gwei: plenty on BSC testnet
    });
    await client.waitForTransactionReceipt({ hash, timeout: 20_000 });
    return Response.json({ updated: stale.map((s) => s.ticker), hash });
  } catch (e) {
    console.error("testnet price update failed:", e instanceof Error ? e.message.split("\n")[0] : e);
    return Response.json({ error: "Price update failed" }, { status: 502 });
  }
}
