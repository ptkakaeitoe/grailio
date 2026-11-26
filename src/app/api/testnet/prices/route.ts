import { connection } from "next/server";
import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fetchAtlas } from "@/lib/atlas";
import { appChain, rpcUrl } from "@/lib/chain";
import { stockOf } from "@/lib/stocks";
import { TRADE_MARKET, TRADE_STOCKS, tradeMarketAbi } from "@/lib/trade-market";

/**
 * Keeps the testnet trade market's prices fresh, lazily: the app calls this just before a real trade. For the listed
 * stocks asked about (all of them when `tickers` is omitted) it compares the on-chain price with Atlas's signed price
 * and, when one is over 5 minutes old or more than 0.3% off, sends one setUsdPrices transaction from the keeper wallet
 * (TESTNET_KEEPER_KEY, which may only post prices). At most one update every 30 seconds, never two at once.
 */

const MAX_AGE_S = 5 * 60;
const MAX_DRIFT = 0.003;
const COOLDOWN_MS = 30_000;
const LOCK_KEY = "testnet:prices:lock";

let lastSend = 0;

/** One update at a time across server instances (Vercel KV / Upstash REST), with an in-memory fallback. */
async function takeLock(): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      const res = await fetch(`${url}/set/${LOCK_KEY}/1/NX/PX/${COOLDOWN_MS}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = (await res.json()) as { result?: string | null };
      return json.result === "OK";
    } catch {
      /* fall through to the in-memory lock */
    }
  }
  if (Date.now() - lastSend < COOLDOWN_MS) return false;
  lastSend = Date.now();
  return true;
}

export async function POST(request: Request) {
  await connection();
  if (!TRADE_MARKET) return Response.json({ error: "Trade market isn't deployed yet" }, { status: 503 });
  const raw = process.env.TESTNET_KEEPER_KEY;
  if (!raw) return Response.json({ error: "Price keeper isn't configured" }, { status: 503 });

  let body: { tickers?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body: every listed stock */ }
  const asked = Array.isArray(body.tickers) ? body.tickers.filter((t): t is string => typeof t === "string") : Object.keys(TRADE_STOCKS);
  const tickers = asked.filter((t) => t in TRADE_STOCKS && stockOf(t)?.feedId != null);
  if (tickers.length === 0) return Response.json({ updated: [], skipped: "no listed stocks asked for" });

  const client = createPublicClient({ chain: appChain, transport: http(rpcUrl) });
  const market = TRADE_MARKET;
  try {
    const [snap, onchain] = await Promise.all([
      fetchAtlas(tickers.map((t) => stockOf(t)!.feedId!)),
      Promise.all(tickers.map(async (t) => {
        const stock = TRADE_STOCKS[t];
        const [usd, at] = await Promise.all([
          client.readContract({ address: market, abi: tradeMarketAbi, functionName: "usdPrice", args: [stock] }),
          client.readContract({ address: market, abi: tradeMarketAbi, functionName: "priceAt", args: [stock] }),
        ]);
        return { usd, at };
      })),
    ]);
    if (!snap.signerOk) return Response.json({ updated: [], skipped: "Atlas signer not recognised" });

    const now = Math.floor(Date.now() / 1000);
    const stale: { ticker: string; stock: Address; usd: bigint }[] = [];
    tickers.forEach((t, i) => {
      const quote = snap.quotes.find((q) => q.id === stockOf(t)!.feedId);
      if (!quote || !(quote.price > 0)) return;
      const fresh = parseUnits(quote.price.toFixed(8), 18);
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
