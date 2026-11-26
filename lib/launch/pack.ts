import { useSyncExternalStore } from "react";
import { stockOf } from "./stocks";
import type { ArtSet } from "./cards";

/** Everything the creator decides in the pack studio. This is what the launcher will receive. */
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
export const RARITY_DOT: Record<Rarity, string> = { common: "#8a9183", rare: "#779bad", epic: "#9883aa", legendary: "#b29451" };

export type Pattern = "stripes" | "dots" | "grid" | "plain";
export type Launchpad = "flap" | "four";
export type CardArt = "chart" | "rays" | "halftone" | "waves" | "grid";
export const CARD_ARTS: CardArt[] = ["chart", "rays", "halftone", "waves", "grid"];
/** How the card inside a pack looks, per rarity. Every card also gets its own serial, which varies the art. */
export type CardDesign = {
  title: string;
  color: string;
  art: CardArt;
  /** Data URL of uploaded card art. Kept for this session only; not saved in the draft. */
  image: string | null;
  /** Art set whose art this rarity's card uses (cards.ts). Unset: the art follows the pack size. An image overrides it. */
  set?: ArtSet;
};

/**
 * Pack sizes x risk tiers. The size sets the price; the risk tier sets how the payout swings.
 *  - Low: every rarity pays the same share of the price (0.95x). Fully paid by the buyer, so it never needs the pool.
 *  - Medium / High: payouts swing by rarity and average a little less (about 0.91x); the swing is paid by the stock
 *    pool, so a risky pack is only sold while the pool could pay its top prize in full.
 * Payout = size price x tier multiplier for the drawn rarity.
 */
export type RiskId = "low" | "medium" | "high";
export type RiskTier = { id: RiskId; name: string; blurb: string; tiers: { odds: number; mult: number }[] };
export type PackSize = { id: string; name: string; price: number };

export const DEFAULT_SIZES: PackSize[] = [
  { id: "starter", name: "Starter", price: 5 },
  { id: "standard", name: "Standard", price: 10 },
  { id: "grail", name: "Grail", price: 25 },
];

export const DEFAULT_RISKS: RiskTier[] = [
  { id: "low", name: "Low", blurb: "a steady glow", tiers: [{ odds: 50, mult: 0.95 }, { odds: 25, mult: 0.95 }, { odds: 20, mult: 0.95 }, { odds: 5, mult: 0.95 }] },
  { id: "medium", name: "Medium", blurb: "some sparks", tiers: [{ odds: 50, mult: 0.46 }, { odds: 25, mult: 0.8 }, { odds: 20, mult: 1.4 }, { odds: 5, mult: 4 }] },
  { id: "high", name: "High", blurb: "chase the grail", tiers: [{ odds: 60, mult: 0.2 }, { odds: 25, mult: 0.6 }, { odds: 12, mult: 2.8 }, { odds: 3, mult: 10.13 }] },
];

/** Average share of the price a tier pays back (e.g. 0.95). */
export const tierReturn = (r: RiskTier) => r.tiers.reduce((s, t) => s + (t.odds / 100) * t.mult, 0) / Math.max(1e-9, r.tiers.reduce((s, t) => s + t.odds, 0) / 100);
export const tierMaxMult = (r: RiskTier) => Math.max(...r.tiers.map((t) => t.mult));
/**
 * Growth model (no presale): the coin launches with Low packs only. Pack margin and trading tax fill the stock pool;
 * once the pool has ever reached a tier's threshold, that tier unlocks for good. An unlocked tier still only sells
 * while the pool can pay its top prize (canSell). Coin holders manage the pack's settings by vote.
 */
export type Unlocks = { medium: number; high: number };
export const DEFAULT_UNLOCKS: Unlocks = { medium: 1000, high: 5000 };
export const unlockAt = (u: Unlocks, risk: RiskId) => (risk === "low" ? 0 : u[risk]);

/** Low risk is self-funded. Riskier tiers sell only if the pool, after taking this payment, can pay the top prize in full. */
export const canSell = (r: RiskTier, price: number, poolUsd: number) => r.id === "low" || poolUsd + price >= price * tierMaxMult(r);

export type Currency = "bnb" | "token";

/**
 * Pack-first launch: Season 1 packs are sold in a presale (BNB). When the target is hit, the memecoin
 * launches through a Flap Launcher. The pack part of the raise fills the stock pool; the coin part seeds
 * the coin's liquidity (Flap requires a minimum; about $1,500 at a 1× multiplier with half the supply in the pool).
 */
export type Presale = {
  /** Season 1 packs sold in the presale. */
  packs: number;
  /** BNB (in USD) that seeds the coin's liquidity pool. Must meet Flap's minimum. */
  liquidityUsd: number;
  /** Share of the coin supply put in the pool; the rest goes to presale buyers. */
  poolTokenPct: number;
};

/** Points from trading and holding the coin; every `perPack` points claims a free pack. */
export type Points = {
  perUsdTraded: number;
  /** Points per day for every 100,000 coins held. */
  perDayPer100k: number;
  perPack: number;
};
export type Sale = {
  enabled: boolean;
  /** What buyers can pay with. "token" is the memecoin itself. */
  currencies: Currency[];
  /** Percent on top of pack value. The pack still holds pack value (× rarity); the premium is the margin. */
  premium: number;
  /** Percent off when paying with the memecoin. */
  tokenDiscount: number;
  /** Where the premium goes. */
  premiumTo: "creator" | "burn";
};
export type Trigger = { kind: "vault"; usd: number } | { kind: "daily" } | { kind: "weekly" };

export type PackConfig = {
  name: string;
  ticker: string;
  tagline: string;
  tone: string;
  pattern: Pattern;
  /** Data URL of an uploaded cover. Kept for this session only; not saved in the draft. */
  image: string | null;
  basket: { ticker: string; weight: number }[];
  /** Odds in percent and value multiplier for each rarity, in RARITIES order. */
  tiers: { odds: number; mult: number }[];
  packValue: number;
  buyTax: number;
  sellTax: number;
  /** Percent of the tax that buys stocks; the rest goes to the creator. */
  stockShare: number;
  trigger: Trigger;
  minHolding: number;
  launchpad: Launchpad;
  sale: Sale;
  /** One design per rarity, in RARITIES order. */
  cards: CardDesign[];
  season: number;
  presale: Presale;
  /** Packs in the coin's launch presale (demo launch, PackLauncherFactory packsForSale). See PRESALE_LIMITS. */
  presalePacks?: number;
  points: Points;
  /** Set once the coin exists on-chain (BSC testnet): its token, sale vault and pack vault. */
  onchain?: {
    pad: Launchpad;
    token: `0x${string}`;
    saleVault: `0x${string}`;
    packVault: `0x${string}`;
    createTx: `0x${string}`;
    /** Flap only: the PackLauncher running the presale. Token and vault are read from it once it launches. */
    launcher?: `0x${string}`;
  };
  /** Percent of every trade's tax that goes to the platform, before the pool/creator split. */
  platformCut: number;
  /** Average payout of a pack as a percent of its price (fixed amounts by rarity average to this). */
  payoutRate: number;
  /** Share of the pack-sale margin (100 − payoutRate) that goes to the platform; the rest to the creator. */
  marginToPlatform: number;
  /** Pack sizes (price) and risk tiers (payout swing). See DEFAULT_SIZES / DEFAULT_RISKS. */
  sizes: PackSize[];
  risks: RiskTier[];
  /** Pool value (USD) at which Medium and High unlock. */
  unlocks: Unlocks;
  /** "custom" when the creator designed the pack and cards in the Launch flow; otherwise the app's default art is used. */
  design?: "default" | "custom";
  /** Pack cover art: a set cover path (/art/packs/…) or a small uploaded data URL. Unset: colour and pattern. */
  cover?: string | null;
  /** Optional coin links set in the Launch flow (short strings, saved with the published coin). */
  links?: CoinLinks;
  /** "classic": a pack collection with no coin (no ticker, launchpad, presale or tax). Unset or "coin": a coin with its pack. */
  kind?: "coin" | "classic";
};

export type CoinLinks = { website?: string; x?: string; telegram?: string };

export const TONES = ["#111111", "#3a1f5c", "#2f5f8f", "#2b8a3e", "#c2255c", "#c78a5c"];

export const BASKET_PRESETS: { id: string; name: string; basket: PackConfig["basket"] }[] = [
  { id: "mag", name: "Big tech", basket: [{ ticker: "NVDA", weight: 30 }, { ticker: "AAPL", weight: 25 }, { ticker: "MSFT", weight: 25 }, { ticker: "GOOGL", weight: 20 }] },
  { id: "index", name: "Index", basket: [{ ticker: "SPY", weight: 70 }, { ticker: "NVDA", weight: 15 }, { ticker: "AAPL", weight: 15 }] },
  { id: "chips", name: "AI chips", basket: [{ ticker: "NVDA", weight: 40 }, { ticker: "AMD", weight: 30 }, { ticker: "MU", weight: 30 }] },
  { id: "crypto", name: "Crypto stocks", basket: [{ ticker: "COIN", weight: 40 }, { ticker: "MSTR", weight: 35 }, { ticker: "CRCL", weight: 25 }] },
  { id: "moon", name: "Moonshot", basket: [{ ticker: "TQQQ", weight: 40 }, { ticker: "SOXL", weight: 30 }, { ticker: "TSLA", weight: 30 }] },
];

/** Tier presets borrowed from merger's stock packs, rescaled so the average pack is worth exactly its value. */
export const TIER_PRESETS: { id: string; name: string; blurb: string; tiers: PackConfig["tiers"] }[] = [
  { id: "steady", name: "Steady", blurb: "low spread", tiers: balance([{ odds: 70, mult: 0.83 }, { odds: 25, mult: 1 }, { odds: 4.5, mult: 1.4 }, { odds: 0.5, mult: 3 }]) },
  { id: "classic", name: "Classic", blurb: "balanced", tiers: balance([{ odds: 60, mult: 0.55 }, { odds: 28, mult: 1 }, { odds: 10, mult: 1.8 }, { odds: 2, mult: 6 }]) },
  { id: "moonshot", name: "Moonshot", blurb: "high variance", tiers: balance([{ odds: 72, mult: 0.32 }, { odds: 18, mult: 0.8 }, { odds: 7, mult: 2.5 }, { odds: 3, mult: 12 }]) },
];

export const DEFAULT_CONFIG: PackConfig = {
  name: "Robo Rally",
  ticker: "ROBO",
  tagline: "",
  tone: TONES[1],
  pattern: "stripes",
  image: null,
  basket: BASKET_PRESETS[2].basket,
  tiers: TIER_PRESETS[1].tiers,
  packValue: 10,
  buyTax: 3,
  sellTax: 3,
  stockShare: 80,
  trigger: { kind: "vault", usd: 500 },
  minHolding: 10000,
  launchpad: "flap",
  sale: { enabled: true, currencies: ["bnb", "token"], premium: 10, tokenDiscount: 5, premiumTo: "creator" },
  cards: [
    { title: "Spark", color: "#8a9183", art: "chart", image: null },
    { title: "Circuit", color: "#3b82c4", art: "grid", image: null },
    { title: "Neon", color: "#9c36b5", art: "waves", image: null },
    { title: "Crown", color: "#c8930f", art: "rays", image: null },
  ],
  season: 1,
  presale: { packs: 300, liquidityUsd: 1500, poolTokenPct: 50 },
  presalePacks: 10,
  points: { perUsdTraded: 1, perDayPer100k: 1, perPack: 100 },
  platformCut: 5,
  payoutRate: 95,
  marginToPlatform: 50,
  sizes: DEFAULT_SIZES,
  risks: DEFAULT_RISKS,
  unlocks: DEFAULT_UNLOCKS,
};

/**
 * Presale bounds, mirroring contracts/src/packs/PackLauncherFactory.sol in USD: packs 1 to MAX_PACKS (10,000),
 * pack price up to MAX_PACK_PRICE (1,000 quote units), raise (packs x price) up to MAX_RAISE (1,000,000).
 * The contract's tiny minimums (0.001 a pack, 0.1 raise) become $1 a pack in the demo.
 */
export const PRESALE_LIMITS = { minPacks: 1, maxPacks: 10_000, minPrice: 1, maxPrice: 1_000, maxRaise: 1_000_000 } as const;

/** The Standard size's price (or the first size's): the coin's pack price. */
export function standardPrice(c: PackConfig) {
  const sizes = c.sizes?.length ? c.sizes : DEFAULT_SIZES;
  return (sizes.find((s) => s.id === "standard") ?? sizes[0]).price;
}

/** A short error when the presale is out of bounds, else "". */
export function presaleError(packs: number, price: number) {
  const L = PRESALE_LIMITS;
  const n = (v: number) => v.toLocaleString("en-US");
  if (!Number.isInteger(packs) || packs < L.minPacks || packs > L.maxPacks) return `Packs: ${L.minPacks} to ${n(L.maxPacks)}`;
  if (!Number.isFinite(price) || price < L.minPrice || price > L.maxPrice) return `Price: $${L.minPrice} to $${n(L.maxPrice)}`;
  if (packs * price > L.maxRaise) return `Raise: up to $${n(L.maxRaise)}`;
  return "";
}

/* ---------- math ---------- */

// Function declarations (hoisted): the presets above call these while the module loads.
export function oddsTotal(tiers: PackConfig["tiers"]) { return round(tiers.reduce((s, t) => s + t.odds, 0), 2); }
export function expectedMult(tiers: PackConfig["tiers"]) { return tiers.reduce((s, t) => s + (t.odds / 100) * t.mult, 0); }

/** Rescale multipliers so the average pack is worth exactly 1× its value (no house edge, no leak). */
export function balance(tiers: PackConfig["tiers"]): PackConfig["tiers"] {
  const ev = expectedMult(tiers) * (100 / (oddsTotal(tiers) || 100));
  return ev > 0 ? tiers.map((t) => ({ ...t, mult: round(t.mult / ev, 3) })) : tiers;
}

/** Set one stock's weight and spread the remainder over the others in proportion, keeping integers that sum to 100. */
export function setWeight(basket: PackConfig["basket"], ticker: string, weight: number): PackConfig["basket"] {
  if (basket.length === 1) return [{ ticker, weight: 100 }];
  const w = Math.max(1, Math.min(100 - (basket.length - 1), Math.round(weight)));
  const others = basket.filter((b) => b.ticker !== ticker);
  const otherTotal = others.reduce((s, b) => s + b.weight, 0);
  let left = 100 - w;
  const spread = others.map((b, i) => {
    const share = i === others.length - 1 ? left : Math.max(1, Math.round(otherTotal ? ((100 - w) * b.weight) / otherTotal : (100 - w) / others.length));
    left -= share;
    return { ...b, weight: share };
  });
  // Rounding can push the last share below 1; take it back from the largest.
  const last = spread[spread.length - 1];
  if (last.weight < 1) {
    const big = spread.reduce((a, b) => (b.weight > a.weight ? b : a));
    big.weight -= 1 - last.weight;
    last.weight = 1;
  }
  return basket.map((b) => (b.ticker === ticker ? { ticker, weight: w } : spread.find((s) => s.ticker === b.ticker)!));
}

export function evenSplit(tickers: string[]): PackConfig["basket"] {
  const base = Math.floor(100 / tickers.length);
  return tickers.map((ticker, i) => ({ ticker, weight: base + (i < 100 - base * tickers.length ? 1 : 0) }));
}

/** What one pack of a given rarity holds: dollars and shares of each stock. */
export function contents(c: PackConfig, rarityIndex: number) {
  const value = c.packValue * c.tiers[rarityIndex].mult;
  return c.basket.map((b) => {
    const s = stockOf(b.ticker);
    const usdValue = (value * b.weight) / 100;
    return { ...s, weight: b.weight, usd: usdValue, shares: s.price ? usdValue / s.price : 0 };
  });
}

/** Simulate fees from a trading volume: what reaches the vault and how many packs that makes. */
/* ---------- pack-first model ---------- */

/** Where each unit of trade tax goes: platform cut first, then the pool/creator split (stockShare = pool). */
export function taxSplit(c: PackConfig) {
  const platform = c.platformCut / 100;
  const pool = (1 - platform) * (c.stockShare / 100);
  return { pool, creator: 1 - platform - pool, platform };
}

/** Fixed stock payout (USD) of a pack of this rarity. Rarity multipliers average 1×, so payouts average payoutRate% of the price. */
export const payoutUsd = (c: PackConfig, rarityIndex: number) => c.packValue * (c.payoutRate / 100) * c.tiers[rarityIndex].mult;

/** Margin kept from each pack sale and how it splits. */
export function packMargin(c: PackConfig) {
  const margin = c.packValue * (1 - c.payoutRate / 100);
  return { margin, platform: margin * (c.marginToPlatform / 100), creator: margin * (1 - c.marginToPlatform / 100) };
}

/** Presale totals: pack money backs the stock pool, coin money seeds liquidity. One ticket = 1 pack + coins. */
export function presalePlan(c: PackConfig) {
  const packMoney = c.presale.packs * c.packValue;
  const total = packMoney + c.presale.liquidityUsd;
  return { packMoney, total, ticketUsd: total / Math.max(1, c.presale.packs), coinPartUsd: c.presale.liquidityUsd / Math.max(1, c.presale.packs) };
}

/** Flap's creation floor (mainnet, 1× multiplier): $750 × total supply / pool tokens. */
export const flapLiquidityFloor = (poolTokenPct: number, multiplier = 1) => 750 * multiplier * (100 / Math.max(1, poolTokenPct));

/** Demo assumption for the memecoin's price until it trades: 20M tokens per BNB. */
export const DEMO_TOKENS_PER_BNB = 20_000_000;

/** Price of one pack in USD for a currency: pack value + premium, minus the token discount when paying in the memecoin. */
export function packPriceUsd(c: PackConfig, currency: Currency) {
  const base = c.packValue * (1 + c.sale.premium / 100);
  return currency === "token" ? base * (1 - c.sale.tokenDiscount / 100) : base;
}

export function packPrice(c: PackConfig, currency: Currency, bnbUsd: number) {
  const usdPrice = packPriceUsd(c, currency);
  const bnb = usdPrice / bnbUsd;
  return { usd: usdPrice, bnb, tokens: currency === "token" ? bnb * DEMO_TOKENS_PER_BNB : null };
}

export function simulate(c: PackConfig, volume: number) {
  const fees = volume * ((c.buyTax + c.sellTax) / 2 / 100);
  const toStocks = fees * (c.stockShare / 100);
  const packs = Math.floor(toStocks / c.packValue);
  return { fees, toStocks, toCreator: fees - toStocks, packs };
}

export function problems(c: PackConfig): string[] {
  const out: string[] = [];
  if (!c.name.trim()) out.push("Give the pack a name.");
  if (!/^[A-Z0-9]{2,10}$/.test(c.ticker)) out.push("Ticker: 2–10 letters or digits.");
  if (c.basket.length === 0) out.push("Pick at least one stock.");
  if (c.basket.reduce((s, b) => s + b.weight, 0) !== 100) out.push("Basket weights must add up to 100%.");
  if (Math.abs(oddsTotal(c.tiers) - 100) > 0.01) out.push(`Rarity odds add up to ${oddsTotal(c.tiers)}%, not 100%.`);
  if (Math.abs(expectedMult(c.tiers) - 1) > 0.01) out.push("Average pack value isn't 1×. Press Balance.");
  if (c.packValue < 1) out.push("Pack value must be at least $1.");
  if (c.sale.enabled && c.sale.currencies.length === 0) out.push("Pick at least one currency for pack sales.");
  if (c.sale.enabled && c.sale.tokenDiscount > c.sale.premium && c.sale.currencies.includes("token")) out.push("Token discount is bigger than the premium, so token buyers pay less than the pack holds.");
  return out;
}

function round(v: number, d: number) { return Math.round(v * 10 ** d) / 10 ** d; }

/* ---------- draft store (per-browser convenience) ---------- */

const KEY = "bsctemp.pack-draft.v1";
let state: PackConfig | null = null;
const listeners = new Set<() => void>();

function load(): PackConfig {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    state = saved
      ? {
          ...DEFAULT_CONFIG,
          ...saved,
          sale: { ...DEFAULT_CONFIG.sale, ...saved.sale },
          cards: DEFAULT_CONFIG.cards.map((d, i) => ({ ...d, ...(saved.cards?.[i] ?? {}), image: null })),
          presale: { ...DEFAULT_CONFIG.presale, ...saved.presale },
          sizes: Array.isArray(saved.sizes) && saved.sizes.length ? saved.sizes : DEFAULT_SIZES,
          risks: Array.isArray(saved.risks) && saved.risks.length === DEFAULT_RISKS.length ? saved.risks : DEFAULT_RISKS,
          unlocks: { ...DEFAULT_UNLOCKS, ...saved.unlocks },
          points: { ...DEFAULT_CONFIG.points, ...saved.points },
          image: null,
        }
      : DEFAULT_CONFIG;
  } catch {
    state = DEFAULT_CONFIG;
  }
  return state!;
}

export function updatePack(patch: Partial<PackConfig> | ((c: PackConfig) => Partial<PackConfig>)) {
  const cur = load();
  state = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    // Uploaded images can be large: keep them in memory only.
    const { image: _image, ...rest } = state;
    void _image;
    localStorage.setItem(KEY, JSON.stringify({ ...rest, cards: rest.cards.map((d) => ({ ...d, image: null })) }));
  } catch {
    /* storage unavailable: keep the draft in memory */
  }
  listeners.forEach((l) => l());
}

export function resetPack() {
  state = DEFAULT_CONFIG;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const usePack = () => useSyncExternalStore(subscribe, load, () => DEFAULT_CONFIG);

/** How far a risk style stretches Medium and High around their average (Low stays flat). */
const SPREAD: Record<string, number> = { steady: 0.55, classic: 1, moonshot: 1.5 };

/**
 * The shop's risk tiers for a studio risk style: Steady narrows Medium and High's swing, Moonshot widens it, and each
 * tier keeps its average payback (so the vault's maths doesn't change). Low always pays 0.95x.
 */
export function risksFor(style: string): RiskTier[] {
  const k = SPREAD[style] ?? 1;
  return DEFAULT_RISKS.map((r) => {
    if (r.id === "low") return r;
    const avg = tierReturn(r);
    const stretched = r.tiers.map((t) => ({ ...t, mult: Math.max(0.05, avg + (t.mult - avg) * k) }));
    const scaled = { ...r, tiers: stretched };
    const fix = avg / tierReturn(scaled);
    return { ...r, tiers: stretched.map((t) => ({ ...t, mult: Math.round(t.mult * fix * 100) / 100 })) };
  });
}
