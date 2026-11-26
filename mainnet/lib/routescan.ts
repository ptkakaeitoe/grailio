import { rpcUrl } from "@/lib/chain";

/**
 * Routescan's free logs API (the Snowtrace backend), used where public RPCs
 * cap log queries at ~100 blocks. Server-side only.
 *
 * Its CDN caches identical URLs, so `toBlock=latest` can serve a stale answer
 * for a while. Queries go up to the current block number instead: the URL
 * changes every block, so results are always fresh.
 */
export const ROUTESCAN_API = "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api";

/** The chain's current block, or "latest" if the RPC can't be reached. */
export async function latestBlock(): Promise<string> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      cache: "no-store",
    });
    const { result } = (await res.json()) as { result?: string };
    return result ? BigInt(result).toString() : "latest";
  } catch {
    return "latest";
  }
}
