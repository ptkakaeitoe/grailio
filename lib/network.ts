import mainnetDeployment from "@/deployments/56.json";
import testnetDeployment from "@/deployments/97.json";

/**
 * Which network this build runs on: NEXT_PUBLIC_NETWORK = "testnet" (default in this repo) or "mainnet". One codebase, two
 * deployments: the testnet build (testnet.grailio.xyz) reads deployments/97.json, pays in Flap's free test USD and
 * trades on the testnet trade market instead of KyberSwap. Everything network-specific goes through here or
 * lib/chain.ts.
 */
export type NetworkName = "mainnet" | "testnet";
// This repo is the testnet app: it builds as testnet unless NEXT_PUBLIC_NETWORK is explicitly "mainnet".
export const NETWORK: NetworkName = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_TESTNET = NETWORK === "testnet";
export const CHAIN_ID = IS_TESTNET ? 97 : 56;

/** What the contract deploy scripts write. Addresses are null / absent until a contract is deployed. */
export type Deployment = {
  treasury?: string | null;
  stockTokens?: Record<string, string>;
  collectPacks?: string | null;
  collectMarket?: string | null;
  collectPoints?: string | null;
  collectDao?: string | null;
  collectChat?: string | null;
  collectNames?: string | null;
  collectProfiles?: string | null;
  collectStaking?: string | null;
  /** Mainnet: block per contract. */
  deployBlocks?: Record<string, number>;
  /** Testnet: one block for the whole suite. */
  deployBlock?: number | null;
  payToken?: string | null;
  tradeMarket?: string | null;
  stockAssets?: Record<string, { assetId: number; token: string; feed?: string }>;
  baskets?: Record<string, string[]>;
  [key: string]: unknown;
};

function normalize(d: Deployment): Deployment {
  // The testnet deploy writes one deployBlock; the app reads deployBlocks like on mainnet.
  if (!d.deployBlocks && d.deployBlock) {
    const b = Number(d.deployBlock);
    return { ...d, deployBlocks: { collectPacks: b, collectMarket: b, collectChat: b, collectStaking: b } };
  }
  return d;
}

export const deployment: Deployment = normalize((IS_TESTNET ? testnetDeployment : mainnetDeployment) as Deployment);
