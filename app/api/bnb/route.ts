import { connection } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { bscTestnet } from "viem/chains";

/**
 * Atlas BNB/USD on BSC Testnet ("SingleFeed BNB/USD", Chainlink-style, 18 decimals). The same feed the stock market
 * contract reads on-chain to price bStocks in BNB, so the app and the contracts agree.
 */
const FEED = "0x3957d289ee9C38272377786787ea34F9dd29788D" as const;
const abi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
]);
const client = createPublicClient({ chain: bscTestnet, transport: http("https://bsc-testnet.publicnode.com") });

export async function GET() {
  await connection();
  try {
    const [[, answer, , updatedAt], decimals] = await Promise.all([
      client.readContract({ address: FEED, abi, functionName: "latestRoundData" }),
      client.readContract({ address: FEED, abi, functionName: "decimals" }),
    ]);
    return Response.json({ price: Number(answer) / 10 ** decimals, updatedAt: Number(updatedAt), feed: FEED, source: "Atlas BNB/USD" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Atlas feed read failed" }, { status: 502 });
  }
}
