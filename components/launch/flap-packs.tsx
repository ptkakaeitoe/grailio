"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRightIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import { formatEther, maxUint256, parseEther, parseEventLogs, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { CoinAvatar } from "@/components/launch/coin-avatar";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { WalletEntry } from "@/components/wallet-entry";
import { cleanButton, cn } from "@/components/clean-ui";
import { SET_FOR_SIZE, cardArt } from "@/lib/launch/cards";
import { appChain, explorerUrl } from "@/lib/launch/chain";
import { TEST_USD, flapTickerOf, flapVaultAbi, launcherAbi, testUsdAbi } from "@/lib/launch/flap";
import { RARITIES } from "@/lib/launch/pack";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";
import type { MarketCoin } from "@/lib/launch/market";

/*
 * A Flap coin, all on BSC testnet and all in Flap's free-mint test USD: the PackLauncher presale, then (after the last
 * pack launches the coin) the PackVault: claim your coins, buy Low/Medium/High packs, open them into cards holding a
 * bStock, stake cards for the tax stream, claim rewards, redeem. Every write is signed by the wallet.
 */

const usd = (wei: bigint, max = 2) => `$${Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: max })}`;
const rarityOf = (bps: number) => (bps < 9000 ? 0 : bps < 12000 ? 1 : bps < 20000 ? 2 : 3);
const TIERS = ["Low", "Medium", "High"] as const;
const PRESALE_KIND = 3;
const LOG_CHUNK = 5_000n;

type Sale = { price: bigint; forSale: bigint; sold: bigint; mine: bigint; deadline: bigint; launched: boolean; token: Address; vault: Address; claimable: bigint };
type Vault = { price: bigint; pool: bigint; top: [bigint, bigint, bigint]; packs: [bigint, bigint, bigint, bigint]; earned: bigint };
type Card = { id: bigint; ticker: string; rarity: number; value: bigint; amount: bigint; staked: boolean };

export function FlapPacks({ coin }: { coin: MarketCoin }) {
  const oc = coin.config.onchain!;
  const launcher = oc.launcher!;
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const [sale, setSale] = useState<Sale | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [usdBal, setUsdBal] = useState(0n);
  const [qty, setQty] = useState(1);
  const [tier, setTier] = useState(0);
  const [busy, setBusy] = useState("");
  const [readError, setReadError] = useState("");

  const refresh = useCallback(async () => {
    if (!client) return;
    const me = address ?? zeroAddress;
    const r = (functionName: "packPrice" | "packsForSale" | "packsSold" | "saleDeadline" | "launched" | "token" | "vault") =>
      client.readContract({ address: launcher, abi: launcherAbi, functionName });
    const [price, forSale, sold, deadline, launched, token, vaultAddr, mine, claimed, bal] = await Promise.all([
      r("packPrice"), r("packsForSale"), r("packsSold"), r("saleDeadline"), r("launched"), r("token"), r("vault"),
      client.readContract({ address: launcher, abi: launcherAbi, functionName: "packsOf", args: [me] }),
      client.readContract({ address: launcher, abi: launcherAbi, functionName: "claimed", args: [me] }),
      client.readContract({ address: TEST_USD, abi: testUsdAbi, functionName: "balanceOf", args: [me] }),
    ]);
    // Buyers share half the supply (500k) by presale packs held.
    const entitled = (forSale as bigint) > 0n ? ((mine as bigint) * 500_000n * 10n ** 18n) / (forSale as bigint) : 0n;
    const s: Sale = {
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

    if (!address) return;
    // Your cards: every card revealed to you since the presale was created, still yours or staked by you.
    const created = await client.getTransactionReceipt({ hash: oc.createTx });
    const latest = await client.getBlockNumber();
    const ids = new Set<bigint>();
    for (let from = created.blockNumber; from <= latest; from += LOG_CHUNK) {
      const logs = await client.getContractEvents({ address: v, abi: flapVaultAbi, eventName: "CardRevealed", args: { owner: address }, fromBlock: from, toBlock: from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n });
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
      return { id, ticker: flapTickerOf(stock), rarity: rarityOf(rollBps), value, amount, staked } satisfies Card;
    }));
    setCards(mineCards.filter((c): c is Card => c !== null).sort((a, b) => Number(b.id - a.id)));
  }, [client, address, launcher, oc.createTx]);

  useEffect(() => {
    const tick = () => void refresh().then(() => setReadError(""), (e: unknown) => setReadError(e instanceof Error ? e.message.split("\n")[0] : "Couldn't read the chain"));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 20_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  async function run(label: string, fn: () => Promise<void>) {
    try { setBusy(label); await fn(); await refresh(); } catch (e) {
      showToast({ kind: "error", title: `${label.replace("…", "")} failed`, detail: txErrorMessage(e) });
    } finally { setBusy(""); }
  }
  async function send(call: Parameters<typeof writeContractAsync>[0]) {
    if (!client) throw new Error("No chain client");
    const hash = await writeContractAsync({ chainId: appChain.id, ...call } as Parameters<typeof writeContractAsync>[0]);
    const rec = await client.waitForTransactionReceipt({ hash });
    if (rec.status !== "success") throw new Error("The transaction reverted");
    return rec;
  }
  /** Mints test USD if short, then approves `spender` for `cost` if the allowance is short. */
  async function payUsd(spender: Address, cost: bigint) {
    if (!client || !address) return;
    if (usdBal < cost) {
      setBusy("Claiming test USD…");
      const need = cost - usdBal;
      await send({ address: TEST_USD, abi: testUsdAbi, functionName: "mint", args: [address, need > parseEther("1000") ? need : parseEther("1000")] });
    }
    const allowance = await client.readContract({ address: TEST_USD, abi: testUsdAbi, functionName: "allowance", args: [address, spender] });
    if (allowance < cost) {
      setBusy("Approving…");
      await send({ address: TEST_USD, abi: testUsdAbi, functionName: "approve", args: [spender, maxUint256] });
    }
  }

  const claimUsd = () => run("Claiming…", async () => {
    if (!address) return;
    await send({ address: TEST_USD, abi: testUsdAbi, functionName: "mint", args: [address, parseEther("1000")] });
    showToast({ kind: "success", title: "1,000 test USD claimed", detail: "BSC testnet" });
  });

  const buyPresale = () => run("Buying…", async () => {
    if (!sale) return;
    const n = BigInt(qty);
    await payUsd(launcher, sale.price * n);
    setBusy("Buying…");
    await send({ address: launcher, abi: launcherAbi, functionName: "buyPacks", args: [n] });
    showToast({ kind: "success", title: `${qty} presale ${qty === 1 ? "pack" : "packs"} bought`, detail: sale.sold + n === sale.forSale ? "Sold out: the coin launched" : "Flap · BSC testnet" });
  });

  const claimCoins = () => run("Claiming…", async () => {
    await send({ address: launcher, abi: launcherAbi, functionName: "claim" });
    showToast({ kind: "success", title: `${coin.config.ticker || coin.name} claimed`, detail: "Your share of the buyers' supply" });
  });

  const buyTier = () => run("Buying…", async () => {
    if (!sale || !vault) return;
    const n = BigInt(qty);
    await payUsd(sale.vault, vault.price * n);
    setBusy("Buying…");
    await send({ address: sale.vault, abi: flapVaultAbi, functionName: "buy", args: [tier, n] });
    showToast({ kind: "success", title: `${qty} ${TIERS[tier]} ${qty === 1 ? "pack" : "packs"} bought`, detail: "Flap · BSC testnet" });
  });

  const open = (kind: number) => run("Opening…", async () => {
    if (!client || !sale) return;
    const rec = await send({ address: sale.vault, abi: flapVaultAbi, functionName: "open", args: [kind] });
    const opened = parseEventLogs({ abi: flapVaultAbi, logs: rec.logs, eventName: "PackOpened" })[0];
    if (!opened) throw new Error("The pack didn't open");
    setBusy("Revealing…");
    // The card is drawn from the next block's hash.
    while ((await client.getBlockNumber()) <= opened.args.revealBlock) await new Promise((r) => setTimeout(r, 1200));
    const revealRec = await send({ address: sale.vault, abi: flapVaultAbi, functionName: "reveal", args: [opened.args.revealId] });
    const card = parseEventLogs({ abi: flapVaultAbi, logs: revealRec.logs, eventName: "CardRevealed" })[0];
    if (card) showToast({ kind: "success", title: `${RARITIES[rarityOf(card.args.rollBps)]} · ${flapTickerOf(card.args.stock)}`, detail: `Card #${card.args.cardId} holds ${Number(formatEther(card.args.amount)).toFixed(4)} ${flapTickerOf(card.args.stock)}` });
  });

  const stake = (ids: bigint[], on: boolean) => run(on ? "Staking…" : "Unstaking…", async () => {
    if (!sale) return;
    await send({ address: sale.vault, abi: flapVaultAbi, functionName: on ? "stake" : "unstake", args: [ids] });
  });
  const claimRewards = () => run("Claiming…", async () => {
    if (!sale) return;
    await send({ address: sale.vault, abi: flapVaultAbi, functionName: "claimRewards" });
  });
  const redeem = (id: bigint) => run("Redeeming…", async () => {
    if (!sale) return;
    await send({ address: sale.vault, abi: flapVaultAbi, functionName: "redeem", args: [id] });
    showToast({ kind: "success", title: `Card #${id} redeemed`, detail: "The bStock is in your wallet" });
  });

  const left = sale ? Number(sale.forSale - sale.sold) : 0;
  const presale = sale ? !sale.launched : true;
  const maxQty = presale ? Math.max(1, Math.min(50, left)) : 20;
  const n = Math.min(qty, maxQty);
  const tierLocked = vault ? vault.top[tier] > vault.price && vault.pool < (vault.top[tier] - vault.price) * BigInt(n) : false;
  const unopened = vault ? vault.packs.reduce((t, x) => t + x, 0n) : 0n;
  const stat = "rounded-md border border-border p-4";

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-6 pt-2 pb-10 desk:pt-4">
      <header className="flex items-center gap-3">
        <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className="size-12 rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight">{coin.name}</h1>
          <a href={`${explorerUrl}/address/${sale?.launched ? sale.token : launcher}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-black">
            Flap · BSC testnet · test USD <ArrowUpRightIcon weight="bold" className="size-3.5" />
          </a>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-1.5" aria-label="Status">
        <div className={stat}>
          <p className="text-sm text-muted">{presale ? "Presale" : "Stock pool"}</p>
          <p className="tabular-nums mt-1 text-[22px] leading-tight">{!sale ? "—" : presale ? `${sale.sold}/${sale.forSale}` : vault ? usd(vault.pool) : "…"}</p>
        </div>
        <div className={stat}>
          <p className="text-sm text-muted">Your packs</p>
          <p className="tabular-nums mt-1 text-[22px] leading-tight">{!isConnected ? "—" : presale ? (sale ? sale.mine.toString() : "…") : unopened.toString()}</p>
        </div>
        <div className={stat}>
          <p className="text-sm text-muted">Test USD</p>
          <p className="tabular-nums mt-1 text-[22px] leading-tight">{isConnected ? usd(usdBal, 0) : "—"}</p>
        </div>
      </section>

      {readError && <p className="text-sm text-down" role="alert">{readError}</p>}

      {!isConnected ? (
        <WalletEntry className={cn(cleanButton.solid, "w-full justify-center")} />
      ) : (
        <>
          {!presale && vault && (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Risk">
              {TIERS.map((t, i) => {
                const need = vault.top[i] > vault.price ? vault.top[i] - vault.price : 0n;
                return (
                  <button key={t} type="button" aria-pressed={tier === i} onClick={() => setTier(i)}
                    className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-black aria-pressed:border-black">
                    <strong className="text-base font-normal">{t}</strong>
                    <span className="tabular-nums text-[13px] text-muted">{need === 0n ? "∞" : vault.pool >= need ? `${vault.pool / need} left` : "Locked"}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border">
              <button type="button" className="grid size-12 place-items-center disabled:opacity-30" aria-label="Fewer" disabled={n <= 1} onClick={() => setQty(n - 1)}><MinusIcon weight="bold" className="size-4" /></button>
              <span className="tabular-nums w-8 text-center">{n}</span>
              <button type="button" className="grid size-12 place-items-center disabled:opacity-30" aria-label="More" disabled={n >= maxQty} onClick={() => setQty(n + 1)}><PlusIcon weight="bold" className="size-4" /></button>
            </div>
            {presale ? (
              <button type="button" className={cn(cleanButton.solid, "min-h-12 flex-1 justify-center")} disabled={Boolean(busy) || !sale || left === 0} onClick={buyPresale}>
                {busy || (sale ? `Buy · ${usd(sale.price * BigInt(n), 0)} test USD` : "…")}
              </button>
            ) : (
              <button type="button" className={cn(cleanButton.solid, "min-h-12 flex-1 justify-center")} disabled={Boolean(busy) || !vault || tierLocked} onClick={buyTier}>
                {busy || (tierLocked ? "Pool too small" : vault ? `Buy ${TIERS[tier]} · ${usd(vault.price * BigInt(n), 0)}` : "…")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={cn(cleanButton.small, "min-h-10")} disabled={Boolean(busy)} onClick={claimUsd}>Claim 1,000 test USD</button>
            {sale?.launched && sale.claimable > 0n && <button type="button" className={cn(cleanButton.small, "min-h-10")} disabled={Boolean(busy)} onClick={claimCoins}>Claim {Number(formatEther(sale.claimable)).toLocaleString("en-US", { maximumFractionDigits: 0 })} {coin.config.ticker || "coins"}</button>}
            {vault && vault.earned > 0n && <button type="button" className={cn(cleanButton.small, "min-h-10")} disabled={Boolean(busy)} onClick={claimRewards}>Claim {usd(vault.earned, 4)} rewards</button>}
          </div>

          {!presale && vault && unopened > 0n && (
            <section aria-label="Unopened packs" className="flex flex-wrap gap-1.5">
              {([[PRESALE_KIND, "Presale", vault.packs[0]], [0, "Low", vault.packs[1]], [1, "Medium", vault.packs[2]], [2, "High", vault.packs[3]]] as const)
                .filter(([, , count]) => count > 0n)
                .map(([kind, label, count]) => (
                  <button key={label} type="button" className={cn(cleanButton.outline, "min-h-11")} disabled={Boolean(busy)} onClick={() => open(kind)}>
                    Open {label} · {count.toString()}
                  </button>
                ))}
            </section>
          )}

          {cards.length > 0 && (
            <section aria-label="Your cards">
              <h2 className="mb-3 text-sm text-muted">Your cards · {cards.length}</h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {cards.map((c) => (
                  <li key={c.id.toString()} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="relative block w-10 shrink-0 overflow-hidden rounded-[3px]">
                      <StockCardFront art={cardArt(c.ticker, c.rarity, SET_FOR_SIZE.standard)} rarity={c.rarity} brand={coin.name} decorative sizes="40px" className="w-full" />
                      <Holo rarity={c.rarity} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">#{c.id.toString()} · {RARITIES[c.rarity]} · {c.ticker}{c.staked && <span className="text-muted"> · staked</span>}</span>
                      <span className="tabular-nums block truncate text-[12px] text-muted">{Number(formatEther(c.amount)).toFixed(4)} {c.ticker} · opened at {usd(c.value)}</span>
                    </span>
                    <button type="button" className={cn(cleanButton.small, "min-h-9")} disabled={Boolean(busy)} onClick={() => stake([c.id], !c.staked)}>{c.staked ? "Unstake" : "Stake"}</button>
                    {!c.staked && <button type="button" className={cn(cleanButton.small, "min-h-9")} disabled={Boolean(busy)} onClick={() => redeem(c.id)}>Redeem</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-center text-sm text-muted">BSC testnet · paid in Flap test USD</p>
        </>
      )}
    </div>
  );
}
