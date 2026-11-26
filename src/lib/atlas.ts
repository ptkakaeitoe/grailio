import "server-only";
import { keccak256, recoverAddress, type Hex } from "viem";
import { ATLAS_FEEDS, ATLAS_SIGNER } from "./atlas-feeds";

/**
 * Atlas Oracle pull mode, read server-side with ATLAS_API_KEY.
 * Same request as @atlas-oracle/pull-oracle-consumer-sdk (POST /report/v1/price/latest, signed: true).
 * We decode the signed payload ourselves and recover the signer exactly like the on-chain consumer:
 * keccak256(payload = packages ‖ count), no EIP-191 prefix, signature r ‖ s ‖ v.
 */
const URL = "https://api.atlasoracle.io/report/v1/price/latest";
const PACKAGE_BYTES = 20; // feedId 4 ‖ value 10 ‖ timestamp 6

export type AtlasQuote = {
  id: number;
  symbol: string;
  /** From the signed payload, 18 decimals. */
  price: number;
  timestamp: number;
  consensusScore: number | null;
  consensusStatus: string | null;
  twap: number | null;
  median: number | null;
  changePct: number | null;
  volatility: number | null;
};

export type AtlasSnapshot = {
  quotes: AtlasQuote[];
  signer: string;
  signerOk: boolean;
  fetchedAt: number;
  creditCount: number | null;
  payloadBytes: number;
};

type ApiResponse = {
  status?: { error_code: string; error_message: string; credit_count?: number };
  data?: {
    payload: Hex;
    signature: Hex;
    magicMarker: Hex;
    consensusScores?: { feedId: string; consensusScore: number; consensusStatus: string; twapPrice: string; medianPrice: string; priceChangePct: number; priceVolatility: number }[];
  };
};

function decodePackages(payload: Hex) {
  const bytes = Buffer.from(payload.slice(2), "hex");
  const count = bytes[bytes.length - 1];
  const out: { id: number; price: number; timestamp: number }[] = [];
  for (let i = 0; i < count; i++) {
    const p = bytes.subarray(i * PACKAGE_BYTES, (i + 1) * PACKAGE_BYTES);
    const id = p.readUInt32BE(0);
    const raw = BigInt("0x" + p.subarray(4, 14).toString("hex"));
    const timestamp = Number(BigInt("0x" + p.subarray(14, 20).toString("hex")));
    // 18-decimal fixed point → number, keeping 8 decimals of precision.
    out.push({ id, price: Number(raw / BigInt(1e10)) / 1e8, timestamp });
  }
  return out;
}

/** Atlas accepts at most 20 feed IDs per request. */
const MAX_PER_REQUEST = 20;

async function fetchBatch(ids: number[], key: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ signed: true, feedIds: ids.map(String) }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Atlas HTTP ${res.status}`);
  const json = (await res.json()) as ApiResponse;
  if (json.status && json.status.error_code !== "0") throw new Error(`Atlas error ${json.status.error_code}: ${json.status.error_message}`);
  if (!json.data) throw new Error("Atlas returned no data");

  const { payload, signature, consensusScores = [] } = json.data;
  const signer = await recoverAddress({ hash: keccak256(payload), signature });
  return { packages: decodePackages(payload), consensusScores, signer, credits: json.status?.credit_count ?? 0, bytes: (payload.length - 2) / 2 };
}

export async function fetchAtlas(ids: number[] = ATLAS_FEEDS.map((f) => f.id)): Promise<AtlasSnapshot> {
  const key = process.env.ATLAS_API_KEY;
  if (!key) throw new Error("ATLAS_API_KEY is not set. Add it to .env.local and restart the dev server.");

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) chunks.push(ids.slice(i, i + MAX_PER_REQUEST));
  const batches = await Promise.all(chunks.map((c) => fetchBatch(c, key)));

  const consensus = new Map(batches.flatMap((b) => b.consensusScores).map((c) => [Number(c.feedId), c]));
  const symbols = new Map(ATLAS_FEEDS.map((f) => [f.id, f.symbol]));
  // Each batch is signed separately; every one must recover to Atlas's key.
  const signers = [...new Set(batches.map((b) => b.signer))];

  const quotes = batches.flatMap((b) => b.packages).map(({ id, price, timestamp }) => {
    const c = consensus.get(id);
    return {
      id,
      symbol: symbols.get(id) ?? `#${id}`,
      price,
      timestamp,
      consensusScore: c?.consensusScore ?? null,
      consensusStatus: c?.consensusStatus ?? null,
      twap: c ? Number(c.twapPrice) : null,
      median: c ? Number(c.medianPrice) : null,
      changePct: c?.priceChangePct ?? null,
      volatility: c?.priceVolatility ?? null,
    };
  });

  return {
    quotes,
    signer: signers.join(", "),
    signerOk: signers.length === 1 && signers[0].toLowerCase() === ATLAS_SIGNER.toLowerCase(),
    fetchedAt: Date.now(),
    creditCount: batches.reduce((s, b) => s + b.credits, 0),
    payloadBytes: batches.reduce((s, b) => s + b.bytes, 0),
  };
}
