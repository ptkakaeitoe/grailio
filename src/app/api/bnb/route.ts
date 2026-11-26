import { connection } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { bsc } from "viem/chains";

/** Chainlink BNB/USD on BNB Chain mainnet (8 decimals). Used to value the vault's BNB tax in dollars. */
const FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" as const;
const abi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const client = createPublicClient({ chain: bsc, transport: http("https://bsc-rpc.publicnode.com") });

export async function GET() {
  await connection();
  try {
    const [, answer, , updatedAt] = await client.readContract({ address: FEED, abi, functionName: "latestRoundData" });
    return Response.json({ price: Number(answer) / 1e8, updatedAt: Number(updatedAt), feed: FEED, source: "Chainlink BNB/USD" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Chainlink read failed" }, { status: 502 });
  }
}
