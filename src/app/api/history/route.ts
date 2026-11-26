import { connection, type NextRequest } from "next/server";
import { HISTORY_PERIODS, fetchStockHistory, type HistoryPeriod } from "@/lib/stock-history";
import { STOCKS } from "@/lib/stocks";

/** Price history for the trade chart from CoinMarketCap: /api/history?ticker=TSLA&period=24H (the TSLAB token). */
export async function GET(req: NextRequest) {
  await connection();
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "";
  const period = req.nextUrl.searchParams.get("period") as HistoryPeriod;
  if ((ticker !== "BNB" && !STOCKS.some((s) => s.ticker === ticker)) || !HISTORY_PERIODS.includes(period)) {
    return Response.json({ error: "Unknown ticker or period" }, { status: 400 });
  }
  return Response.json({ ticker, period, points: await fetchStockHistory(ticker, period) });
}
