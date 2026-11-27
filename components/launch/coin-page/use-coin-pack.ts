"use client";

import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, formatEther, maxUint256, parseEther, parseEventLogs, zeroAddress, type Address } from "viem";
import { useAccount, useBalance, usePublicClient, useWriteContract } from "wagmi";

import { useConnectWallet } from "@/components/beta-access";
import { designedCard } from "@/components/launch/launch-design";
import { useBnbUsd, useNow } from "@/components/launch/stake-panel";
import { StockCardFront } from "@/components/stock-card-front";
import { SET_FOR_SIZE, cardArt } from "@/lib/launch/cards";
import { appChain, explorerUrl } from "@/lib/launch/chain";
import { addCard, useCollection, type OwnedCard } from "@/lib/launch/collection";
import { startDemo, useDemo } from "@/lib/launch/demo";
import {
  BUYERS_SUPPLY, SEED_SHARE, STREAM_DAYS, STREAM_MS, TABLES, TAX_SPLIT, TIERS, TOTAL_SUPPLY, buyPresale, buyTier, canBuyTier, claimRewards,
  openBought, openPresale, otherBuysPresale, packSizeOf, poolNeeded, presalePacksOf, simTokenPrice, simulateTax, stakeCards, stakeStats,
  topMult, unstakeCards, useLaunchSim, type Opened, type Tier,
} from "@/lib/launch/demo-launch";
import { FLAP_SEED_BPS, FLAP_V2_FACTORY, TEST_USD, flapTickerOf, flapVaultAbi, launcherAbi, v2Abi } from "@/lib/launch/flap";
import { demoTokenPrice, type MarketCoin } from "@/lib/launch/market";
import { MARKET, OPENFOUR, SALE, coreAbi, marketAbi, packVaultAbi, saleVaultAbi, tickerOfStock, toolsAbi } from "@/lib/launch/onchain";
import { stockOf } from "@/lib/launch/stocks";
import { showToast } from "@/lib/toast";

import type { CoinActivityItem, CoinPack, CoinPull, CoinSource, CoinStakedCard, CoinTier, RiskTier } from "./types";

/*
 * The adapter behind the coin pack page: one CoinPack for every launched coin, whatever runs it. Three sources share
 * the same output so the header, buy panel and tabs never branch on the launchpad:
 *  - "sim": the browser simulation (lib/launch/demo-launch), paid from the demo wallet in BNB.
 *  - "four": an OpenFour (Four.meme) coin on BSC testnet: the sale vault's fixed-price presale, then the pack vault.
 *  - "flap": a Flap coin on BSC testnet in Flap test USD: the PackLauncher presale, then the PackVault.
 * Actions throw on failure; callers show the error.
 */

const PCT = { pool: TAX_SPLIT.pool * 100, stakers: TAX_SPLIT.stakers * 100, creator: TAX_SPLIT.creator * 100, platform: TAX_SPLIT.platform * 100 };
const NO_TAX = { pool: 0, stakers: 0, creator: 0, platform: 0 };
const num = (wei: bigint) => Number(formatEther(wei));
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 })}`;
/** Card rarity from an on-chain roll (bps of the pack price). */
const rarityOfBps = (bps: number) => (bps < 9000 ? 0 : bps < 12000 ? 1 : bps < 20000 ? 2 : 3);
/** Card rarity from a simulated roll (a multiple of the price, or of the presale share). */
const rarityOfMult = (mult: number) => (mult >= 2 ? 3 : mult >= 1.2 ? 2 : mult >= 1 ? 1 : 0);
const LOG_CHUNK = 5_000n;

/** Picks a basket stock by weight. */
function drawStock(basket: { ticker: string; weight: number }[]) {
  let roll = Math.random() * basket.reduce((s, b) => s + b.weight, 0);
  return (basket.find((b) => (roll -= b.weight) < 0) ?? basket[0])?.ticker ?? "";
}

function sourceOf(coin: MarketCoin): CoinSource {
  if (coin.config.onchain?.pad === "flap" && coin.config.onchain.launcher) return "flap";
  if (coin.config.onchain) return "four";
  return "sim";
}

/** Small card art for staking rows. */
function cardThumb(coin: MarketCoin, card: { ticker: string; rarity: number }) {
  const size = packSizeOf(coin).id;
  const art = coin.config.design === "custom"
    ? designedCard(coin.config.cards[card.rarity], card.rarity, card.ticker, size)
    : cardArt(card.ticker, card.rarity, SET_FOR_SIZE[size] ?? "fable");
  return createElement(StockCardFront, { art, rarity: card.rarity, brand: coin.name, decorative: true, sizes: "40px", className: "w-full" });
}

/** Shared busy / pull / error-free runner for async chain actions. */
function useRunner(refresh?: () => Promise<void>) {
  const [busy, setBusy] = useState("");
  const [lastPull, setLastPull] = useState<CoinPull | null>(null);
  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      await refresh?.();
    } finally {
      setBusy("");
    }
  }, [refresh]);
  return { busy, setBusy, run, lastPull, setLastPull, clearPull: () => setLastPull(null) };
}

function baseFields(coin: MarketCoin) {
  return {
    coin,
    basket: coin.basket,
    ticker: coin.config.ticker || coin.name,
  };
}

/* ---------------------------------------------------------------- simulation */

function useSimPack(coin: MarketCoin, enabled: boolean): CoinPack {
  const sim = useLaunchSim(coin);
  const demo = useDemo();
  const bnbUsd = useBnbUsd();
  const collection = useCollection();
  const [filling, setFilling] = useState(false);
  const [lastPull, setLastPull] = useState<CoinPull | null>(null);
  // Ticks every second while this coin is shown, so the reward stream counts up.
  const now = useNow(enabled, 1000);

  // Simulated other buyers take a pack every 400ms until it sells out.
  useEffect(() => {
    if (!filling || !enabled) return;
    const t = setInterval(() => { if (!otherBuysPresale(coin)) setFilling(false); }, 400);
    return () => clearInterval(t);
  }, [filling, enabled, coin]);

  const size = packSizeOf(coin);
  const cards = collection.filter((c) => c.coin === coin.slug && !c.redeemedAt && !c.onchain);
  const stats = stakeStats(sim, now);
  const raise = sim.price * sim.packsForSale;
  const price = simTokenPrice({ [coin.slug]: sim }, coin) ?? demoTokenPrice(coin);
  const live = sim.phase === "live";

  function pullFrom(res: Opened, presale: boolean): CoinPull {
    const rarity = rarityOfMult(res.roll);
    const ticker = drawStock(coin.basket);
    const set = (coin.config.design === "custom" ? coin.config.cards[rarity]?.set : undefined) ?? SET_FOR_SIZE[size.id] ?? "fable";
    const stockPrice = stockOf(ticker)?.price;
    addCard({ coin: coin.slug, coinName: coin.name, size: size.id, set, ticker, rarity, usd: res.value, shares: stockPrice ? res.value / stockPrice : 0 });
    return { ticker, rarity, valueUsd: res.value, amount: stockPrice ? res.value / stockPrice : undefined, note: presale ? `${res.roll.toFixed(2)}× its share` : `${Math.round(res.roll * 100)}% of the price` };
  }
  const needBnb = () => { if (!bnbUsd) throw new Error("BNB price unavailable"); if (!demo.active) throw new Error("Start the demo first"); return bnbUsd; };
  const toCard = (c: OwnedCard, perDay: number): CoinStakedCard => ({
    id: String(c.id), ticker: c.ticker, rarity: c.rarity, valueUsd: c.usd,
    earnsPerDayUsd: stats.totalWeight > 0 && c.stakedAt ? (perDay * c.usd) / stats.totalWeight : 0, art: cardThumb(coin, c),
  });

  const tiers: CoinTier[] = TIERS.map((t) => {
    const need = poolNeeded(sim, t.id, 1);
    const open = canBuyTier(sim, t.id, 1);
    return {
      id: t.id, name: t.name, price: bnbUsd ? sim.price / bnbUsd : sim.price, priceUsd: sim.price, outcomes: TABLES[t.id],
      left: topMult(t.id) <= 1 ? null : live && need > 0 ? Math.floor(sim.pool / need) : 0,
      lockedReason: !live ? "Opens after the presale" : open ? null : `Unlocks at a ${money(need)} pool`,
      unopened: sim.bought[t.id],
    };
  });
  const activity: CoinActivityItem[] = cards
    .slice().sort((a, b) => b.openedAt - a.openedAt).slice(0, 12)
    .map((c) => ({ id: `card-${c.id}`, label: `Opened a ${["Common", "Rare", "Epic", "Legendary"][c.rarity]} card`, detail: `${c.ticker} · ${money(c.usd)}`, at: c.openedAt }));

  return {
    ...baseFields(coin),
    source: "sim", simulated: true, phase: sim.phase, launchpad: coin.launchpad === "flap" ? "Flap" : coin.launchpad === "four" ? "Four.meme" : null,
    tokenAddress: null, explorerUrl: null, quote: "BNB",
    priceUsd: live ? price : null, mcapUsd: live ? price * TOTAL_SUPPLY : null, liquidityUsd: live ? sim.liquidity : null, stockPoolUsd: live ? sim.pool : null,
    presale: {
      packsSold: sim.packsSold, packsForSale: sim.packsForSale, price: bnbUsd ? sim.price / bnbUsd : sim.price, priceUsd: sim.price,
      coinsPerPack: BUYERS_SUPPLY / sim.packsForSale, mine: live ? presalePacksOf(sim) : sim.mine, deadline: null,
      toLiquidityUsd: raise * (1 - SEED_SHARE), toPoolUsd: raise * SEED_SHARE,
    },
    tiers,
    taxSplit: PCT, taxCollectedUsd: sim.tax,
    staking: {
      claimableUsd: stats.claimable, poolUsd: stats.streaming + stats.queued, perDayUsd: stats.perDay,
      share: stats.totalWeight > 0 ? Math.min(1, cards.filter((c) => c.stakedAt).reduce((t, c) => t + c.usd, 0) / stats.totalWeight) : 0,
      staked: cards.filter((c) => c.stakedAt).map((c) => toCard(c, stats.perDay)),
      stakeable: cards.filter((c) => !c.stakedAt && c.usd > 0).map((c) => toCard(c, stats.perDay)),
      timeNote: `${STREAM_DAYS} days run in ${Math.round(STREAM_MS / 1000)}s`,
    },
    activity,
    ready: demo.active, needsWallet: false, balance: demo.active ? demo.bnb : null,
    actions: {
      connect: startDemo,
      buyPresale: async (q) => { if (!buyPresale(coin, q, needBnb())) throw new Error("Not enough BNB"); },
      openPresale: async () => { const res = openPresale(coin); if (!res) throw new Error("No presale packs to open"); setLastPull(pullFrom(res, true)); },
      buyTier: async (tier, q) => { if (!buyTier(coin, tier as Tier, q, needBnb())) throw new Error(canBuyTier(sim, tier as Tier, q) ? "Not enough BNB" : "The pool is too small for that tier"); },
      openTier: async (tier) => { const res = openBought(coin, tier as Tier); if (!res) throw new Error("No packs to open"); setLastPull(pullFrom(res, false)); },
      stake: async (ids) => { stakeCards(coin, cards.filter((c) => ids.includes(String(c.id)))); },
      unstake: async (ids) => { unstakeCards(coin, cards.filter((c) => ids.includes(String(c.id))), needBnb()); },
      claimRewards: async () => { claimRewards(coin, needBnb()); },
    },
    demo: {
      simulateBuyers: sim.phase === "presale" ? () => setFilling(true) : undefined,
      simulateTrading: live ? () => simulateTax(coin, Math.round((3 + Math.random() * 5) * 100) / 100) : undefined,
    },
    lastPull, clearPull: () => setLastPull(null), busy: filling ? "Other buyers joining…" : "",
    loading: false, error: null,
  };
}

/* ---------------------------------------------------------------- shared chain helpers */

function useChainBasics(enabled: boolean, token: Address | undefined) {
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const { openConnect } = useConnectWallet();
  const [symbol, setSymbol] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !client || !token || token === zeroAddress) return;
    let live = true;
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).then((s) => { if (live) setSymbol(s); }, () => {});
    return () => { live = false; };
  }, [enabled, client, token]);
  /** Sends a contract write and waits for a successful receipt. Loosely typed: each call site's ABI checks its args. */
  const send = useCallback(async (call: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[]; value?: bigint }) => {
    if (!client) throw new Error("No chain client");
    const hash = await writeContractAsync({ chainId: appChain.id, ...call } as unknown as Parameters<typeof writeContractAsync>[0]);
    const rec = await client.waitForTransactionReceipt({ hash });
    if (rec.status !== "success") throw new Error("The transaction reverted");
    return rec;
  }, [client, writeContractAsync]);
  return { address, isConnected, client, send, openConnect, symbol };
}

/** Polls `refresh` while enabled; keeps the last read error. */
function usePoll(enabled: boolean, refresh: () => Promise<void>, ms: number) {
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => void refresh().then(() => { setError(null); setLoaded(true); }, (e: unknown) => { setError(e instanceof Error ? e.message.split("\n")[0] : "Couldn't read the chain"); setLoaded(true); });
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [enabled, refresh, ms]);
  return { error, loading: enabled && !loaded };
}

/* ---------------------------------------------------------------- OpenFour (Four.meme) */

const FOUR_MIGRATED = 3;
const FOUR_SALE_PACKS = Number(SALE.saleAmount / SALE.tokensPerPack);

type FourState = { phase: number; remaining: bigint; free: bigint; maxPayout: bigint; packs: bigint; tokens: bigint; deadline: number | null };

function useFourPack(coin: MarketCoin, enabled: boolean): CoinPack {
  const oc = coin.config.onchain;
  const chain = useChainBasics(enabled, oc?.token);
  const { address, client, send } = chain;
  const bnbUsd = useBnbUsd();
  const bal = useBalance({ address, chainId: appChain.id, query: { enabled: enabled && Boolean(address), refetchInterval: 15_000 } });
  const [s, setS] = useState<FourState | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !oc) return;
    const [phase, remaining, free, maxPayout, packs, tokens] = await Promise.all([
      client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "phase" }),
      client.readContract({ address: oc.saleVault, abi: saleVaultAbi, functionName: "remainingForSale" }),
      client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "freeBalance" }),
      client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "maxPayout" }),
      address ? client.readContract({ address: oc.packVault, abi: packVaultAbi, functionName: "packsOf", args: [address] }) : Promise.resolve(0n),
      address ? client.readContract({ address: oc.token, abi: erc20Abi, functionName: "balanceOf", args: [address] }) : Promise.resolve(0n),
    ]);
    let deadline: number | null = s?.deadline ?? null;
    if (deadline === null && oc.createTx) {
      const rec = await client.getTransactionReceipt({ hash: oc.createTx }).catch(() => null);
      const block = rec ? await client.getBlock({ blockNumber: rec.blockNumber }).catch(() => null) : null;
      if (block) deadline = (Number(block.timestamp) + Number(SALE.duration)) * 1000;
    }
    setS({ phase: Number(phase), remaining, free, maxPayout, packs, tokens, deadline });
  }, [client, oc, address, s?.deadline]);
  const run = useRunner(refresh);
  const poll = usePoll(enabled && Boolean(oc), refresh, 15_000);

  const live = s ? s.phase >= FOUR_MIGRATED : false;
  const leftInSale = s ? Number(s.remaining / SALE.tokensPerPack) : FOUR_SALE_PACKS;
  const sold = FOUR_SALE_PACKS - leftInSale;
  const packPrice = num(SALE.packPrice);
  const tokenPrice = num(SALE.fixedPrice);
  const raiseBnb = packPrice * FOUR_SALE_PACKS;
  const poolShare = SALE.stockPoolBps / 10_000;
  const usdOf = (bnb: number) => (bnbUsd ? bnb * bnbUsd : null);
  const left = s && live ? (s.maxPayout > 0n ? Number(s.free / s.maxPayout) : null) : 0;

  const buyPresaleFn = async (q: number) => run.run("Buying…", async () => {
    if (!client || !address || !oc) throw new Error("Connect a wallet");
    const amount = SALE.tokensPerPack * BigInt(q);
    const { result } = await client.simulateContract({ address: OPENFOUR.tools, abi: toolsAbi, functionName: "estimateBuy", args: [oc.token, address, amount, 0n, "0x"], account: address });
    const maxPay = (result.userPays * 10_500n) / 10_000n;
    await send({ address: OPENFOUR.core, abi: coreAbi, functionName: "buy", args: [oc.token, amount, maxPay, 0n, "0x"], value: maxPay });
    showToast({ kind: "success", title: `${q} presale ${q === 1 ? "pack" : "packs"} bought`, detail: "Four.meme · BSC testnet" });
  });
  const buyTierFn = async (_tier: RiskTier, q: number) => run.run("Buying…", async () => {
    if (!oc) return;
    await send({ address: oc.packVault, abi: packVaultAbi, functionName: "buy", args: [BigInt(q)], value: SALE.packPrice * BigInt(q) });
    showToast({ kind: "success", title: `${q} ${q === 1 ? "pack" : "packs"} bought`, detail: "Four.meme · BSC testnet" });
  });
  const openFn = async () => run.run("Opening…", async () => {
    if (!client || !oc) return;
    run.setLastPull(null);
    const openRec = await send({ address: oc.packVault, abi: packVaultAbi, functionName: "open" });
    const opened = parseEventLogs({ abi: packVaultAbi, logs: openRec.logs, eventName: "PackOpened" })[0];
    if (!opened) throw new Error("The pack didn't open");
    run.setBusy("Revealing…");
    // The card is drawn from the next block's hash.
    while ((await client.getBlockNumber()) <= opened.args.revealBlock) await new Promise((r) => setTimeout(r, 1200));
    const revealRec = await send({ address: oc.packVault, abi: packVaultAbi, functionName: "reveal", args: [opened.args.revealId] });
    const card = parseEventLogs({ abi: packVaultAbi, logs: revealRec.logs, eventName: "CardRevealed" })[0];
    if (!card) throw new Error("The card wasn't revealed");
    const ticker = tickerOfStock(card.args.stock);
    const rarity = rarityOfBps(card.args.rollBps);
    const usdPrice = await client.readContract({ address: MARKET, abi: marketAbi, functionName: "usdPrice", args: [card.args.stock] });
    const amount = num(card.args.amount);
    const value = amount * num(usdPrice);
    addCard({ coin: coin.slug, coinName: coin.name, size: "standard", set: SET_FOR_SIZE.standard, ticker, rarity, usd: value, shares: amount, onchain: { vault: oc.packVault, cardId: card.args.cardId.toString(), amount: card.args.amount.toString() } });
    run.setLastPull({ ticker, rarity, valueUsd: value, amount, note: `${(card.args.rollBps / 100).toFixed(0)}% of the price`, cardId: card.args.cardId.toString() });
  });

  return {
    ...baseFields(coin),
    ticker: chain.symbol ?? coin.config.ticker ?? coin.name,
    source: "four", simulated: false, phase: live ? "live" : "presale", launchpad: "Four.meme",
    tokenAddress: oc?.token ?? null, explorerUrl: oc ? `${explorerUrl}/token/${oc.token}` : null, quote: "tBNB",
    priceUsd: usdOf(tokenPrice), mcapUsd: usdOf(tokenPrice * TOTAL_SUPPLY), liquidityUsd: null, stockPoolUsd: s && live ? usdOf(num(s.free)) : null,
    presale: {
      packsSold: sold, packsForSale: FOUR_SALE_PACKS, price: packPrice, priceUsd: usdOf(packPrice),
      coinsPerPack: num(SALE.tokensPerPack), mine: s ? (live ? 0 : Number(s.tokens / SALE.tokensPerPack)) : 0, deadline: s?.deadline ?? null,
      toLiquidityUsd: usdOf(raiseBnb * (1 - poolShare)), toPoolUsd: usdOf(raiseBnb * poolShare),
    },
    tiers: [{
      id: 0, name: "Pack", price: packPrice, priceUsd: usdOf(packPrice), outcomes: [], left: live ? left : 0,
      lockedReason: !live ? "Opens after the presale" : s && s.free < s.maxPayout ? "The pool is filling" : null, unopened: s ? Number(s.packs) : 0,
    }],
    taxSplit: NO_TAX, taxCollectedUsd: null, staking: null, activity: [],
    ready: chain.isConnected, needsWallet: !chain.isConnected, balance: bal.data ? num(bal.data.value) : null,
    actions: { connect: chain.openConnect, buyPresale: buyPresaleFn, buyTier: buyTierFn, openTier: () => openFn() },
    demo: null, lastPull: run.lastPull, clearPull: run.clearPull, busy: run.busy,
    loading: poll.loading, error: poll.error,
  };
}

/* ---------------------------------------------------------------- Flap */

type FlapSale = { price: bigint; forSale: bigint; sold: bigint; mine: bigint; deadline: bigint; launched: boolean; token: Address; vault: Address; claimable: bigint };
type FlapVault = { price: bigint; pool: bigint; top: [bigint, bigint, bigint]; packs: [bigint, bigint, bigint, bigint]; earned: bigint };
type FlapCard = { id: bigint; ticker: string; rarity: number; value: bigint; amount: bigint; staked: boolean };
const FLAP_PRESALE_KIND = 3;

function useFlapPack(coin: MarketCoin, enabled: boolean): CoinPack {
  const oc = coin.config.onchain;
  const launcher = oc?.launcher;
  const [sale, setSale] = useState<FlapSale | null>(null);
  const chain = useChainBasics(enabled, sale?.launched ? sale.token : undefined);
  const { address, client, send } = chain;
  const [vault, setVault] = useState<FlapVault | null>(null);
  const [cards, setCards] = useState<FlapCard[]>([]);
  const [usdBal, setUsdBal] = useState(0n);
  /** The coin's V2 pool reserves: test USD and coins. */
  const [reserves, setReserves] = useState<{ usd: bigint; coin: bigint } | null>(null);
  const now = useNow(enabled, 30_000);

  const refresh = useCallback(async () => {
    if (!client || !launcher || !oc) return;
    const me = address ?? zeroAddress;
    const r = (functionName: "packPrice" | "packsForSale" | "packsSold" | "saleDeadline" | "launched" | "token" | "vault") =>
      client.readContract({ address: launcher, abi: launcherAbi, functionName });
    const [price, forSale, sold, deadline, launched, token, vaultAddr, mine, claimed, bal] = await Promise.all([
      r("packPrice"), r("packsForSale"), r("packsSold"), r("saleDeadline"), r("launched"), r("token"), r("vault"),
      client.readContract({ address: launcher, abi: launcherAbi, functionName: "packsOf", args: [me] }),
      client.readContract({ address: launcher, abi: launcherAbi, functionName: "claimed", args: [me] }),
      client.readContract({ address: TEST_USD, abi: erc20Abi, functionName: "balanceOf", args: [me] }),
    ]);
    // Buyers share half the supply (500k) by presale packs held.
    const entitled = (forSale as bigint) > 0n ? ((mine as bigint) * 500_000n * 10n ** 18n) / (forSale as bigint) : 0n;
    const s: FlapSale = {
      price: price as bigint, forSale: forSale as bigint, sold: sold as bigint, mine: mine as bigint, deadline: deadline as bigint,
      launched: launched as boolean, token: token as Address, vault: vaultAddr as Address, claimable: launched ? entitled - (claimed as bigint) : 0n,
    };
    setSale(s);
    setUsdBal(bal as bigint);
    if (!s.launched || s.vault === zeroAddress) return;
    const v = s.vault;
    const [vPrice, pool, t0, t1, t2, packs, earned] = await Promise.all([
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "packPrice" }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "pool" }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "maxPayout", args: [0] }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "maxPayout", args: [1] }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "maxPayout", args: [2] }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "packsOf", args: [me] }),
      client.readContract({ address: v, abi: flapVaultAbi, functionName: "earned", args: [me] }),
    ]);
    setVault({ price: vPrice, pool, top: [t0, t1, t2], packs: packs as unknown as [bigint, bigint, bigint, bigint], earned });
    const pair = await client.readContract({ address: FLAP_V2_FACTORY, abi: v2Abi, functionName: "getPair", args: [s.token, TEST_USD] }).catch(() => zeroAddress);
    if (pair !== zeroAddress) {
      const [[r0, r1], token0] = await Promise.all([
        client.readContract({ address: pair, abi: v2Abi, functionName: "getReserves" }),
        client.readContract({ address: pair, abi: v2Abi, functionName: "token0" }),
      ]);
      const usdFirst = token0.toLowerCase() === TEST_USD.toLowerCase();
      setReserves({ usd: usdFirst ? r0 : r1, coin: usdFirst ? r1 : r0 });
    }
    if (!address) return;
    // Your cards: every card revealed to you since the presale was created, still yours or staked by you.
    const created = await client.getTransactionReceipt({ hash: oc.createTx });
    const latest = await client.getBlockNumber();
    const ids = new Set<bigint>();
    for (let from = created.blockNumber; from <= latest; from += LOG_CHUNK) {
      const to = from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n;
      const logs = await client.getContractEvents({ address: v, abi: flapVaultAbi, eventName: "CardRevealed", args: { owner: address }, fromBlock: from, toBlock: to });
      logs.forEach((l) => l.args.cardId !== undefined && ids.add(l.args.cardId));
    }
    const mineCards = await Promise.all([...ids].map(async (id) => {
      const [owner, stakedBy, c] = await Promise.all([
        client.readContract({ address: v, abi: flapVaultAbi, functionName: "ownerOf", args: [id] }).catch(() => zeroAddress),
        client.readContract({ address: v, abi: flapVaultAbi, functionName: "stakedBy", args: [id] }),
        client.readContract({ address: v, abi: flapVaultAbi, functionName: "cards", args: [id] }),
      ]);
      const staked = stakedBy.toLowerCase() === address.toLowerCase();
      if (!staked && owner.toLowerCase() !== address.toLowerCase()) return null;
      const [stock, , rollBps, value, amount] = c;
      return { id, ticker: flapTickerOf(stock), rarity: rarityOfBps(rollBps), value, amount, staked } satisfies FlapCard;
    }));
    setCards(mineCards.filter((c): c is FlapCard => c !== null).sort((a, b) => Number(b.id - a.id)));
  }, [client, address, launcher, oc]);
  const run = useRunner(refresh);
  const poll = usePoll(enabled && Boolean(launcher), refresh, 20_000);

  /** Mints test USD if short, then approves `spender` for `cost` if the allowance is short. */
  async function payUsd(spender: Address, cost: bigint) {
    if (!client || !address) throw new Error("Connect a wallet");
    if (usdBal < cost) {
      run.setBusy("Claiming test USD…");
      const need = cost - usdBal;
      await send({ address: TEST_USD, abi: [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }] as const, functionName: "mint", args: [address, need > parseEther("1000") ? need : parseEther("1000")] });
    }
    const allowance = await client.readContract({ address: TEST_USD, abi: erc20Abi, functionName: "allowance", args: [address, spender] });
    if (allowance < cost) {
      run.setBusy("Approving…");
      await send({ address: TEST_USD, abi: erc20Abi, functionName: "approve", args: [spender, maxUint256] });
    }
  }
  const openKind = (kind: number) => run.run("Opening…", async () => {
    if (!client || !sale) return;
    run.setLastPull(null);
    const rec = await send({ address: sale.vault, abi: flapVaultAbi, functionName: "open", args: [kind] });
    const opened = parseEventLogs({ abi: flapVaultAbi, logs: rec.logs, eventName: "PackOpened" })[0];
    if (!opened) throw new Error("The pack didn't open");
    run.setBusy("Revealing…");
    while ((await client.getBlockNumber()) <= opened.args.revealBlock) await new Promise((r) => setTimeout(r, 1200));
    const revealRec = await send({ address: sale.vault, abi: flapVaultAbi, functionName: "reveal", args: [opened.args.revealId] });
    const card = parseEventLogs({ abi: flapVaultAbi, logs: revealRec.logs, eventName: "CardRevealed" })[0];
    if (!card) throw new Error("The card wasn't revealed");
    const ticker = flapTickerOf(card.args.stock);
    run.setLastPull({ ticker, rarity: rarityOfBps(card.args.rollBps), valueUsd: num(card.args.value), amount: num(card.args.amount), note: `${(card.args.rollBps / 100).toFixed(0)}% of the price`, cardId: card.args.cardId.toString() });
  });

  const live = Boolean(sale?.launched);
  const refund = sale && !sale.launched && sale.deadline > 0n && now / 1000 > Number(sale.deadline) && sale.sold < sale.forSale;
  const priceUsd = sale ? num(sale.price) : 0;
  const forSale = sale ? Number(sale.forSale) : 0;
  const raise = priceUsd * forSale;
  const seed = FLAP_SEED_BPS / 10_000;
  const coinPrice = live && reserves && reserves.coin > 0n ? num(reserves.usd) / num(reserves.coin) : null;
  const tierNames = ["Low", "Medium", "High"] as const;
  const toCard = (c: FlapCard): CoinStakedCard => ({ id: c.id.toString(), ticker: c.ticker, rarity: c.rarity, valueUsd: num(c.value), earnsPerDayUsd: 0, art: cardThumb(coin, c) });
  const tiers: CoinTier[] = tierNames.map((name, i) => {
    const need = vault && vault.top[i] > vault.price ? vault.top[i] - vault.price : 0n;
    const leftN = !vault ? 0 : need === 0n ? null : Number(vault.pool / need);
    return {
      id: i as RiskTier, name, price: vault ? num(vault.price) : priceUsd, priceUsd: vault ? num(vault.price) : priceUsd, outcomes: TABLES[i as Tier],
      left: live ? leftN : 0,
      lockedReason: !live ? "Opens after the presale" : leftN === 0 ? `Unlocks at a $${num(need).toLocaleString("en-US", { maximumFractionDigits: 0 })} pool` : null,
      unopened: vault ? Number(vault.packs[i + 1]) : 0,
    };
  });

  return {
    ...baseFields(coin),
    ticker: chain.symbol ?? coin.config.ticker ?? coin.name,
    source: "flap", simulated: false, phase: refund ? "refund" : live ? "live" : "presale", launchpad: "Flap",
    tokenAddress: live && sale ? sale.token : null, explorerUrl: live && sale ? `${explorerUrl}/token/${sale.token}` : launcher ? `${explorerUrl}/address/${launcher}` : null, quote: "USD",
    priceUsd: coinPrice, mcapUsd: coinPrice === null ? null : coinPrice * TOTAL_SUPPLY, liquidityUsd: !live ? null : reserves ? num(reserves.usd) : raise * (1 - seed), stockPoolUsd: vault ? num(vault.pool) : null,
    presale: {
      packsSold: sale ? Number(sale.sold) : 0, packsForSale: forSale, price: priceUsd, priceUsd,
      coinsPerPack: forSale > 0 ? 500_000 / forSale : 0, mine: live ? (vault ? Number(vault.packs[0]) : 0) : sale ? Number(sale.mine) : 0,
      deadline: sale && sale.deadline > 0n ? Number(sale.deadline) * 1000 : null, toLiquidityUsd: raise * (1 - seed), toPoolUsd: raise * seed,
    },
    tiers,
    taxSplit: PCT, taxCollectedUsd: null,
    staking: live ? {
      claimableUsd: vault ? num(vault.earned) : 0, poolUsd: 0, perDayUsd: 0, share: 0,
      staked: cards.filter((c) => c.staked).map(toCard), stakeable: cards.filter((c) => !c.staked).map(toCard), timeNote: null,
    } : null,
    activity: cards.map((c) => ({ id: `card-${c.id}`, label: `Card #${c.id} · ${["Common", "Rare", "Epic", "Legendary"][c.rarity]}`, detail: `${num(c.amount).toFixed(4)} ${c.ticker}`, at: 0 })),
    ready: chain.isConnected, needsWallet: !chain.isConnected, balance: num(usdBal),
    actions: {
      connect: chain.openConnect,
      claimTestUsd: () => run.run("Claiming…", async () => {
        if (!address) throw new Error("Connect a wallet");
        await send({ address: TEST_USD, abi: [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }] as const, functionName: "mint", args: [address, parseEther("1000")] });
        showToast({ kind: "success", title: "1,000 test USD claimed", detail: "BSC testnet" });
      }),
      buyPresale: (q) => run.run("Buying…", async () => {
        if (!sale || !launcher) return;
        await payUsd(launcher, sale.price * BigInt(q));
        run.setBusy("Buying…");
        await send({ address: launcher, abi: launcherAbi, functionName: "buyPacks", args: [BigInt(q)] });
        showToast({ kind: "success", title: `${q} presale ${q === 1 ? "pack" : "packs"} bought`, detail: "Flap · BSC testnet" });
      }),
      openPresale: () => openKind(FLAP_PRESALE_KIND),
      claimCoins: () => run.run("Claiming…", async () => { if (launcher) await send({ address: launcher, abi: launcherAbi, functionName: "claim" }); }),
      refund: () => run.run("Refunding…", async () => { if (launcher) await send({ address: launcher, abi: launcherAbi, functionName: "refund" }); }),
      buyTier: (tier, q) => run.run("Buying…", async () => {
        if (!sale || !vault) return;
        await payUsd(sale.vault, vault.price * BigInt(q));
        run.setBusy("Buying…");
        await send({ address: sale.vault, abi: flapVaultAbi, functionName: "buy", args: [tier, BigInt(q)] });
        showToast({ kind: "success", title: `${q} ${tierNames[tier]} ${q === 1 ? "pack" : "packs"} bought`, detail: "Flap · BSC testnet" });
      }),
      openTier: (tier) => openKind(tier),
      stake: (ids) => run.run("Staking…", async () => { if (sale) await send({ address: sale.vault, abi: flapVaultAbi, functionName: "stake", args: [ids.map(BigInt)] }); }),
      unstake: (ids) => run.run("Unstaking…", async () => { if (sale) await send({ address: sale.vault, abi: flapVaultAbi, functionName: "unstake", args: [ids.map(BigInt)] }); }),
      claimRewards: () => run.run("Claiming…", async () => { if (sale) await send({ address: sale.vault, abi: flapVaultAbi, functionName: "claimRewards" }); }),
    },
    demo: null, lastPull: run.lastPull, clearPull: run.clearPull, busy: run.busy,
    claimableCoins: sale ? num(sale.claimable) : 0,
    loading: poll.loading, error: poll.error,
  };
}

/* ---------------------------------------------------------------- entry */

/** The coin pack page's data for any launched coin. */
export function useCoinPack(coin: MarketCoin): CoinPack {
  const source = useMemo(() => sourceOf(coin), [coin]);
  const sim = useSimPack(coin, source === "sim");
  const four = useFourPack(coin, source === "four");
  const flap = useFlapPack(coin, source === "flap");
  return source === "flap" ? flap : source === "four" ? four : sim;
}
