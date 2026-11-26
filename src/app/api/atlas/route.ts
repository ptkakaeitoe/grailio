import { connection, type NextRequest } from "next/server";
import { fetchAtlas } from "@/lib/atlas";
import { ATLAS_FEEDS } from "@/lib/atlas-feeds";

const KNOWN = new Set(ATLAS_FEEDS.map((f) => f.id));

/**
 * Latest signed Atlas prices. `?ids=979,934` limits it to those feeds (known feed IDs only);
 * without it, every bStocks feed. Runs per request; the API key never leaves the server.
 */
export async function GET(req: NextRequest) {
  await connection();
  const param = req.nextUrl.searchParams.get("ids");
  const ids = param ? param.split(",").map(Number).filter((n) => KNOWN.has(n)) : undefined;
  if (param && !ids?.length) return Response.json({ error: "No known feed IDs in ?ids" }, { status: 400 });
  try {
    return Response.json(await fetchAtlas(ids));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Atlas request failed" }, { status: 502 });
  }
}
