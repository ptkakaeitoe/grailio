import { connection } from "next/server";
import { fetchAtlas } from "@/lib/atlas";
import { CournotError, probability, resolveMarkets } from "@/lib/cournot";
import { coinBySlug, topStock } from "@/lib/market";
import { DROP_PCT, decide, pickMarket, type RiskCheck } from "@/lib/risk";
import { loadCheck, saveCheck } from "@/lib/risk-store";
import { stockOf } from "@/lib/stocks";

/** A new check within this window returns the saved one instead of spending another Cournot call. */
const MIN_INTERVAL_MS = 30 * 60 * 1000;

/** GET: the coin's last saved risk check (never calls Cournot). */
export async function GET(_req: Request, ctx: RouteContext<"/api/risk/[coin]">) {
  await connection();
  const { coin } = await ctx.params;
  if (!coinBySlug(coin)) return Response.json({ error: "Unknown coin" }, { status: 404 });
  return Response.json({ check: await loadCheck(coin) });
}

/**
 * POST: run the risk check live. Atlas gives the biggest basket stock's signed price; Cournot matches a question about
 * a DROP_PCT fall to prediction markets (free), we pick the closest market, then Cournot prices it (one call).
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/risk/[coin]">) {
  await connection();
  const { coin: slug } = await ctx.params;
  const coin = coinBySlug(slug);
  if (!coin) return Response.json({ error: "Unknown coin" }, { status: 404 });

  const saved = await loadCheck(slug);
  if (saved && Date.now() - saved.checkedAt < MIN_INTERVAL_MS) {
    return Response.json({ check: saved, reused: true });
  }

  const stock = stockOf(topStock(coin).ticker);
  if (!stock?.feedId) return Response.json({ error: `Atlas doesn't price ${topStock(coin).ticker} yet.` }, { status: 422 });

  let price: number;
  try {
    const snap = await fetchAtlas([stock.feedId]);
    const quote = snap.quotes.find((q) => q.id === stock.feedId);
    if (!snap.signerOk || !quote) throw new Error("Atlas price missing or not signed by Atlas.");
    price = quote.price;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Atlas request failed." }, { status: 502 });
  }

  const level = Math.round(price * (1 - DROP_PCT) * 100) / 100;
  const claim = `Will ${stock.name} (${stock.ticker}) stock fall below $${level.toFixed(2)}?`;

  try {
    const markets = await resolveMarkets(claim);
    const pick = pickMarket(markets, price);
    if (!pick) {
      return Response.json({ error: `No prediction market close to a ${Math.round(DROP_PCT * 100)}% drop in ${stock.ticker} right now. Packs keep the pool-size rule only.`, state: "no_market" }, { status: 422 });
    }
    const p = await probability(claim, pick.market.id);
    const chanceOfDrop = pick.reading.badIfYes ? p.probabilityYes : 1 - p.probabilityYes;
    const check: RiskCheck = {
      coin: slug,
      stock: { ticker: stock.ticker, name: stock.name, price },
      claim,
      market: { id: pick.market.id, title: pick.market.title, endTime: pick.market.endTime },
      badIfYes: pick.reading.badIfYes,
      probabilityYes: p.probabilityYes,
      chanceOfDrop,
      decision: decide(chanceOfDrop),
      result: p.result,
      basis: p.basis,
      billing: p.billing,
      checkedAt: Date.now(),
    };
    await saveCheck(check);
    // Sanitized proof of the live call for the README's Cournot section.
    console.info("[cournot] risk check", JSON.stringify({ coin: slug, market: check.market.id, probabilityYes: check.probabilityYes, chanceOfDrop, billing: check.billing, at: new Date(check.checkedAt).toISOString() }));
    return Response.json({ check });
  } catch (e) {
    if (e instanceof CournotError) return Response.json({ error: e.message, state: e.state }, { status: e.state === "rate_limited" ? 429 : 502 });
    return Response.json({ error: "The risk check failed." }, { status: 502 });
  }
}
