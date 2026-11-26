/**
 * Server-side NFT lookups through Avalanche's Glacier data API. Glacier has
 * already fetched and indexed each NFT's metadata, so this server never
 * fetches an arbitrary token URI itself (a token URI could point anywhere,
 * including internal addresses). Images come back as https links only.
 */
const GLACIER = "https://glacier-api.avax.network/v1/chains/43114";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export type NftItem = {
  nft: string;
  tokenId: string;
  /** Collection name, e.g. "Leftside Ape Yacht Club". */
  collection: string;
  /** Token name if the metadata has one. */
  name: string | null;
  /** https image link, or null if none could be resolved. */
  image: string | null;
};

/** Normalises an image URI to an https link (ipfs:// goes through a public gateway). */
export function safeImage(uri: unknown): string | null {
  if (typeof uri !== "string" || !uri) return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith("ipfs://")) return IPFS_GATEWAY + trimmed.slice(7).replace(/^ipfs\//, "");
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

type GlacierToken = {
  address?: string;
  tokenId?: string;
  name?: string;
  metadata?: { name?: string | null; imageUri?: string | null };
};

const toItem = (t: GlacierToken): NftItem | null =>
  t.address && t.tokenId
    ? { nft: t.address, tokenId: String(t.tokenId), collection: t.name ?? "Unknown collection", name: t.metadata?.name ?? null, image: safeImage(t.metadata?.imageUri) }
    : null;

/** ERC-721s held by `owner` on Avalanche (first page, up to 100). */
export async function listNfts(owner: string): Promise<NftItem[]> {
  const res = await fetch(`${GLACIER}/addresses/${owner}/balances:listErc721?pageSize=100`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Glacier ${res.status}`);
  const json = (await res.json()) as { erc721TokenBalances?: GlacierToken[] };
  return (json.erc721TokenBalances ?? []).flatMap((t) => {
    const item = toItem(t);
    return item ? [item] : [];
  });
}

/** One NFT's collection, name and image. */
export async function getNft(nft: string, tokenId: string): Promise<NftItem | null> {
  const res = await fetch(`${GLACIER}/nfts/collections/${nft}/tokens/${tokenId}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return toItem((await res.json()) as GlacierToken);
}
