import { connection, type NextRequest } from "next/server";
import { fetchCmc } from "@/lib/cmc";
import { STOCKS } from "@/lib/stocks";

/**
 * Live CoinMarketCap data for bStocks. `?tickers=AAPL,NVDA` (known tickers only); without it, every listed bStock.
 * Runs per request on the server (60 s in-memory cache); the API key never leaves the server.
 */
export async function GET(req: NextRequest) {
  await connection();
  const param = req.nextUrl.searchParams.get("tickers");
  const known = new Set(STOCKS.map((s) => s.ticker));
  const tickers = param ? param.split(",").map((t) => t.trim().toUpperCase()).filter((t) => known.has(t)) : STOCKS.map((s) => s.ticker);
  if (!tickers.length) return Response.json({ error: "No known tickers in ?tickers" }, { status: 400 });
  try {
    return Response.json(await fetchCmc(tickers));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "CoinMarketCap request failed" }, { status: 502 });
  }
}
