import { concat, encodeAbiParameters, getAddress, keccak256, parseAbi, toHex, type Address, type Hex } from "viem";
import deployments from "../../contracts/deployments/97.json" with { type: "json" };

/*
 * Flap Pool Launch with our pack factories, quoted in Flap's free-mint testnet USD (anyone can mint it, so the pool is
 * seeded with fake USDT instead of tBNB). A coin's life: newLauncher (presale of packs priced in USD) → the last pack
 * launches the tax token + pool through the Portal → the PackVault takes the tax (50/30/15/5), sells Low/Medium/High
 * packs, opens cards holding a bStock, stakes cards and pays stakers. The Portal only accepts our factories once Flap
 * enables them (launcherFactoryMultiplier); until then the app keeps Flap launches simulated.
 */

export const FLAP_PORTAL = getAddress(deployments.flapPortal);
export const FLAP_LAUNCHER_FACTORY = getAddress(deployments.PackLauncherFactory);
export const FLAP_VAULT_FACTORY = getAddress(deployments.PackVaultFactory);
export const FLAP_MARKET = getAddress(deployments.MockStockMarket);
export const TEST_USD = getAddress(deployments.flapTestUSD);
/** Flap's tax-token implementation: launched tokens are its EIP-1167 clones, at addresses ending in 7777. */
const FLAP_TOKEN_IMPL = "0x7777c57ff7dc441c1715b2e36fa581c48B782222" as Address;

/** bStocks listed on the pack vaults' market, by plain ticker (NVDAB → NVDA). */
export const FLAP_STOCKS: Record<string, Address> = Object.fromEntries(
  Object.entries(deployments.stocks).map(([sym, addr]) => [sym.replace(/B$/, ""), getAddress(addr)]),
);
export const flapTickerOf = (stock: string) =>
  Object.entries(FLAP_STOCKS).find(([, a]) => a.toLowerCase() === stock.toLowerCase())?.[0] ?? "";

/** The Portal's liquidity floor at Flap's default multiplier, in quote (USD): 70% of the raise must clear ~$1,500. */
export const FLAP_MIN_RAISE_USD = 2200;
export const FLAP_SEED_BPS = 3000;
export const FLAP_SALE_DAYS = 7;

export const portalAbi = parseAbi([
  "function SALT_LOCK_FEE() view returns (uint256)",
  "function launcherFactoryMultiplier(address factory) view returns (bool enabled, uint16 multiplierBps)",
  "function vaultFactoryMultiplier(address factory) view returns (bool enabled, uint16 multiplierBps)",
  "function newLauncher(address launcherFactory, bytes data) payable returns (address launcher)",
]);

export const launcherFactoryAbi = parseAbi(["event PackLauncherCreated(address indexed launcher, address indexed creator, bytes32 launchSalt)"]);

export const launcherAbi = parseAbi([
  "function packPrice() view returns (uint256)",
  "function packsForSale() view returns (uint256)",
  "function packsSold() view returns (uint256)",
  "function packsOf(address) view returns (uint256)",
  "function saleDeadline() view returns (uint256)",
  "function launched() view returns (bool)",
  "function token() view returns (address)",
  "function vault() view returns (address)",
  "function claimed(address) view returns (uint256)",
  "function buyPacks(uint256 quantity) payable",
  "function claim()",
  "function refund()",
]);

export const flapVaultAbi = parseAbi([
  "function packPrice() view returns (uint256)",
  "function pool() view returns (uint256)",
  "function maxPayout(uint8 tier) view returns (uint256)",
  "function poolNeeded(uint8 tier, uint256 quantity) view returns (uint256)",
  "function packsOf(address) view returns (uint256 presale, uint256 low, uint256 medium, uint256 high)",
  "function earned(address) view returns (uint256)",
  "function stakedBy(uint256) view returns (address)",
  "function cards(uint256) view returns (address stock, uint8 kind, uint16 rollBps, uint256 value, uint256 amount)",
  "function ownerOf(uint256) view returns (address)",
  "function buy(uint8 tier, uint256 quantity) payable",
  "function open(uint8 kind) returns (uint256 id)",
  "function reveal(uint256 id) returns (uint256 cardId)",
  "function redeem(uint256 cardId)",
  "function stake(uint256[] cardIds)",
  "function unstake(uint256[] cardIds)",
  "function claimRewards()",
  "function sync()",
  "event PackOpened(uint256 indexed revealId, address indexed owner, uint8 kind, uint256 revealBlock)",
  "event CardRevealed(uint256 indexed revealId, uint256 indexed cardId, address indexed owner, uint8 kind, address stock, uint16 rollBps, uint256 value, uint256 amount, bool late)",
  "event Staked(address indexed account, uint256 indexed cardId, uint256 weight)",
  "event Unstaked(address indexed account, uint256 indexed cardId, uint256 weight)",
]);

export const testUsdAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/** PackConfig, exactly as PackLauncherFactory decodes it (it rejects any other encoding). */
const PACK_CONFIG = [{
  type: "tuple",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "meta", type: "string" },
    { name: "salt", type: "bytes32" },
    { name: "quoteToken", type: "address" },
    { name: "packPrice", type: "uint256" },
    { name: "packsForSale", type: "uint256" },
    { name: "saleDuration", type: "uint256" },
    { name: "vaultFactory", type: "address" },
    { name: "seedBps", type: "uint16" },
    {
      name: "basket",
      type: "tuple",
      components: [
        { name: "market", type: "address" },
        { name: "stocks", type: "address[]" },
        { name: "weights", type: "uint16[]" },
      ],
    },
  ],
}] as const;

export type FlapLaunchInput = { name: string; symbol: string; meta: string; salt: Hex; packPriceUsd: number; packs: number; basket: { ticker: string; weight: number }[] };

/** Basket weights (percent) → bps summing to exactly 10000, for listed stocks only. */
export function basketBps(basket: { ticker: string; weight: number }[]) {
  const listed = basket.filter((b) => FLAP_STOCKS[b.ticker]).slice(0, 4);
  const total = listed.reduce((t, b) => t + b.weight, 0) || 1;
  const bps = listed.map((b) => Math.floor((b.weight / total) * 10_000));
  if (bps.length) bps[0] += 10_000 - bps.reduce((t, x) => t + x, 0);
  return { stocks: listed.map((b) => FLAP_STOCKS[b.ticker]), weights: bps };
}

export function encodePackConfig(i: FlapLaunchInput): Hex {
  const { stocks, weights } = basketBps(i.basket);
  return encodeAbiParameters(PACK_CONFIG, [{
    name: i.name,
    symbol: i.symbol,
    meta: i.meta,
    salt: i.salt,
    quoteToken: TEST_USD,
    packPrice: BigInt(Math.round(i.packPriceUsd * 100)) * 10n ** 16n,
    packsForSale: BigInt(i.packs),
    saleDuration: BigInt(FLAP_SALE_DAYS * 86_400),
    vaultFactory: FLAP_VAULT_FACTORY,
    seedBps: FLAP_SEED_BPS,
    basket: { market: FLAP_MARKET, stocks, weights },
  }]);
}

/** USD per presale pack for an on-chain Flap launch: the coin's price, raised so the raise clears the Portal floor. */
export const flapPackPrice = (price: number, packs: number) => Math.max(price, Math.ceil(FLAP_MIN_RAISE_USD / Math.max(1, packs)));

const CLONE_INIT_HASH = keccak256(concat(["0x3d602d80600a3d3981f3363d3d373d3d3d363d73", FLAP_TOKEN_IMPL, "0x5af43d82803e903d91602b57fd5bf3"]));
const tokenAddressFor = (salt: Hex) =>
  `0x${keccak256(concat(["0xff", FLAP_PORTAL, salt, CLONE_INIT_HASH])).slice(-40)}` as Address;

/**
 * Finds a launch salt whose token address ends in 7777 (Flap's rule for tax tokens). About 65k tries; yields to the
 * page every few thousand so the UI stays responsive.
 */
export async function minePackSalt(seed: string): Promise<Hex> {
  const base = keccak256(toHex(seed));
  for (let i = 0n; ; i++) {
    const salt = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [base, i]));
    if (tokenAddressFor(salt).toLowerCase().endsWith("7777")) return salt;
    if (i % 4000n === 3999n) await new Promise((r) => setTimeout(r, 0));
  }
}
