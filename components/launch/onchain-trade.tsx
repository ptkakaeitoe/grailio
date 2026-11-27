"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, formatEther, maxUint256, parseAbi, parseAbiItem, parseEther, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { ArrowLeftIcon, ArrowsDownUpIcon } from "@phosphor-icons/react/ssr";
import { cleanButton, cn } from "@/components/clean-ui";
import { CoinAvatar } from "@/components/launch/coin-avatar";
import { CoinLoop } from "@/components/launch/coin-page/coin-loop";
import { useCoinPack } from "@/components/launch/coin-page/use-coin-pack";
import { PriceChart, type ChartPoint } from "@/components/launch/price-chart";
import { WalletEntry } from "@/components/wallet-entry";
import { appChain, explorerUrl } from "@/lib/launch/chain";
import { FLAP_V2_FACTORY, TEST_USD, v2Abi } from "@/lib/launch/flap";
import { usd } from "@/lib/launch/format";
import type { MarketCoin } from "@/lib/launch/market";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";

/*
 * A Flap coin's trade screen: real trades against the coin's PancakeSwap pool in Flap's free test USD. The price and
 * chart come from the pool (its Sync events), the stock pool panel from the coin's pack vault, and the swap box sends
 * real router swaps (the coin's 3% tax comes off each trade).
 */

/** PancakeSwap's V2 router on BSC testnet (the one over the factory Flap seeds liquidity on). */
const ROUTER: Address = "0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3";
const routerAbi = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
]);
const mintAbi = parseAbi(["function mint(address to, uint256 amount)"]);
const syncEvent = parseAbiItem("event Sync(uint112 reserve0, uint112 reserve1)");
const LOG_CHUNK = 40_000n;

const num = (wei: bigint) => Number(formatEther(wei));
const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });
const priceText = (p: number) => (p >= 1 ? usd(p) : `$${p.toPrecision(3)}`);
const compactUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : usd(n));

export function FlapTradeScreen({ coin }: { coin: MarketCoin }) {
  const pack = useCoinPack(coin);
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const token = pack.tokenAddress as Address | null;
  const symbol = pack.ticker;
  const createTx = coin.config.onchain?.createTx;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [bal, setBal] = useState<{ usd: bigint; coin: bigint }>({ usd: 0n, coin: 0n });
  const [quote, setQuote] = useState<bigint | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);

  const path = useMemo<Address[]>(() => (token ? (side === "buy" ? [TEST_USD, token] : [token, TEST_USD]) : []), [token, side]);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const amountIn = valid ? parseEther(amount as `${number}`) : 0n;
  const payBal = side === "buy" ? bal.usd : bal.coin;
  const short = valid && amountIn > payBal;
  const payLabel = side === "buy" ? "USD" : symbol;
  const getLabel = side === "buy" ? symbol : "USD";
  const tax = Math.max(coin.config.buyTax ?? 0, coin.config.sellTax ?? 0) / 100;

  const readBalances = useCallback(async () => {
    if (!client || !address || !token) return;
    const [u, c] = await Promise.all([
      client.readContract({ address: TEST_USD, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    ]);
    setBal({ usd: u, coin: c });
  }, [client, address, token]);
  useEffect(() => { const t = setTimeout(() => void readBalances(), 0); return () => clearTimeout(t); }, [readBalances]);

  // The chart: the pool's price after every trade, from its Sync events since the launch.
  const readChart = useCallback(async () => {
    if (!client || !token || !createTx) return;
    const pair = await client.readContract({ address: FLAP_V2_FACTORY, abi: v2Abi, functionName: "getPair", args: [token, TEST_USD] });
    if (pair === zeroAddress) return;
    const usdFirst = (await client.readContract({ address: pair, abi: v2Abi, functionName: "token0" })).toLowerCase() === TEST_USD.toLowerCase();
    const from = (await client.getTransactionReceipt({ hash: createTx })).blockNumber;
    const head = await client.getBlockNumber();
    const logs = [];
    for (let b = from; b <= head; b += LOG_CHUNK) {
      const to = b + LOG_CHUNK - 1n > head ? head : b + LOG_CHUNK - 1n;
      logs.push(...(await client.getLogs({ address: pair, event: syncEvent, fromBlock: b, toBlock: to })));
    }
    const recent = logs.slice(-120);
    const blocks = [...new Set(recent.map((l) => l.blockNumber))];
    const times = new Map(await Promise.all(blocks.map(async (n) => [n, Number((await client.getBlock({ blockNumber: n })).timestamp) * 1000] as const)));
    setPoints(recent.flatMap((l) => {
      const { reserve0, reserve1 } = l.args;
      if (reserve0 === undefined || reserve1 === undefined) return [];
      const [u, c] = usdFirst ? [reserve0, reserve1] : [reserve1, reserve0];
      return c > 0n ? [{ t: times.get(l.blockNumber) ?? Date.now(), p: num(u) / num(c) }] : [];
    }));
  }, [client, token, createTx]);
  useEffect(() => { const t = setTimeout(() => void readChart(), 0); return () => clearTimeout(t); }, [readChart]);

  useEffect(() => {
    if (!client || !valid || path.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      client.readContract({ address: ROUTER, abi: routerAbi, functionName: "getAmountsOut", args: [amountIn, path] })
        .then((a) => { if (live) setQuote(a[1]); }).catch(() => { if (live) setQuote(null); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [client, valid, amountIn, path]);

  // After the coin's tax. A quote is only shown for a valid amount.
  const shown = valid ? quote : null;
  const receive = shown === null ? null : num(shown) * (1 - tax);

  async function send(call: Parameters<typeof writeContractAsync>[0]) {
    if (!client) throw new Error("No chain client");
    const hash = await writeContractAsync({ chainId: appChain.id, ...call } as Parameters<typeof writeContractAsync>[0]);
    const rec = await client.waitForTransactionReceipt({ hash });
    if (rec.status !== "success") throw new Error("Transaction reverted");
    return hash;
  }

  async function claimUsd() {
    if (!address) return;
    try {
      setBusy("Claiming…");
      await send({ address: TEST_USD, abi: mintAbi, functionName: "mint", args: [address, parseEther("1000")] });
      showToast({ kind: "success", title: "Claimed 1,000 test USD", detail: "BSC testnet" });
      await readBalances();
    } catch (e) {
      showToast({ kind: "error", title: "Claim failed", detail: txErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function swap() {
    if (!client || !address || !token || !valid || short || shown === null) return;
    try {
      const payToken = path[0];
      const allowance = await client.readContract({ address: payToken, abi: erc20Abi, functionName: "allowance", args: [address, ROUTER] });
      if (allowance < amountIn) {
        setBusy("Approving…");
        await send({ address: payToken, abi: erc20Abi, functionName: "approve", args: [ROUTER, maxUint256] });
      }
      setBusy(side === "buy" ? "Buying…" : "Selling…");
      // 10% slippage on top of the tax (thin testnet pool).
      const min = (shown * BigInt(Math.round((1 - tax) * 900))) / 1000n;
      const hash = await send({
        address: ROUTER, abi: routerAbi, functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        args: [amountIn, min, path, address, BigInt(Math.floor(Date.now() / 1000) + 600)],
      });
      showToast({ kind: "success", title: `${side === "buy" ? "Bought" : "Sold"} ${symbol}`, detail: "BSC testnet", href: `${explorerUrl}/tx/${hash}` });
      setAmount("");
      await Promise.all([readBalances(), readChart()]);
    } catch (e) {
      showToast({ kind: "error", title: "Trade failed", detail: txErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const live = pack.phase === "live";
  const change = points.length > 1 ? (points.at(-1)!.p - points[0].p) / points[0].p : null;
  const collected = pack.taxCollectedUsd;
  const rows: [string, string, boolean][] = [
    ["Mcap", pack.mcapUsd === null ? "—" : compactUsd(pack.mcapUsd), false],
    ["Liquidity", pack.liquidityUsd === null ? "—" : compactUsd(pack.liquidityUsd), false],
    ...(collected ? ([
      ["Tax collected", compactUsd(collected.pool + collected.stakers + collected.creator + collected.platform), false],
      ["to the pool", compactUsd(collected.pool), true],
      ["to stakers", compactUsd(collected.stakers), true],
    ] as [string, string, boolean][]) : []),
    ["Pack", pack.tiers[0] ? `${usd(pack.tiers[0].price, 0)} each` : "—", false],
  ];

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 pb-10 desk:max-w-[1180px] desk:pt-8">
      <Link href="/packs" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm text-muted hover:text-black"><ArrowLeftIcon weight="bold" className="size-4" /> Packs</Link>

      <header className="flex items-center gap-3">
        <CoinAvatar seed={coin.slug || coin.name} tone={coin.tone} image={coin.config.image} className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight">{symbol}</h1>
          <p className="truncate text-sm text-muted">{coin.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] leading-tight tabular-nums">{pack.priceUsd ? priceText(pack.priceUsd) : "—"}</p>
          {change !== null && <p className={cn("text-sm tabular-nums", change >= 0 ? "text-up" : "text-down")}>{change >= 0 ? "+" : ""}{(change * 100).toFixed(2)}%</p>}
          <p className="text-sm text-muted">PancakeSwap · testnet</p>
        </div>
      </header>

      <div className="grid gap-6 desk:grid-cols-[minmax(0,1fr)_380px] desk:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {points.length > 1 ? (
            <section aria-label="Chart"><PriceChart points={points} up={(change ?? 0) >= 0} /></section>
          ) : (
            <div className="grid h-[260px] place-items-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted">{live ? "No trades yet. The chart starts with the first one." : "Trading opens when the presale sells out."}</div>
          )}
          <CoinLoop pack={pack} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Pool" className="rounded-md border border-border p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm text-muted">Stock pool</h2>
              <span className="text-[13px] text-muted">{live ? "live" : "presale"}</span>
            </div>
            <p className="mt-1 text-[32px] leading-tight tabular-nums">{pack.stockPoolUsd === null ? "—" : compactUsd(pack.stockPoolUsd)}</p>
            <p className="text-[13px] text-muted">Pays out pack prizes in stocks</p>
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
              {rows.map(([label, v, sub]) => (
                <div key={label} className="contents">
                  <dt className={sub ? "pl-3 text-muted" : "text-muted"}>{label}</dt>
                  <dd className="m-0 text-right tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/packs/${coin.slug}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border-strong text-sm transition-colors hover:border-black">Open packs</Link>
          </section>

          <section aria-label="Swap" className="flex flex-col gap-1.5">
            <div className="rounded-md border border-border bg-surface-muted p-4">
              <div className="flex items-baseline justify-between gap-3 text-sm text-muted">
                <span>You pay</span>
                <span className="tabular-nums">
                  Balance {fmt(num(payBal), 4)}
                  {side === "buy" && isConnected && <button type="button" onClick={claimUsd} disabled={Boolean(busy)} className="ml-2 underline-offset-4 hover:text-black hover:underline disabled:opacity-40">Get 1,000</button>}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={`Amount of ${payLabel}`}
                  className="min-w-0 flex-1 bg-transparent text-[32px] leading-none tabular-nums outline-none placeholder:text-muted" />
                <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{payLabel}</span>
              </div>
              <div className="mt-3 flex gap-1.5">
                {[0.25, 0.5, 0.75, 1].map((f) => (
                  <button key={f} type="button" disabled={payBal === 0n} onClick={() => setAmount(formatEther(f === 1 ? payBal : (payBal * BigInt(f * 100)) / 100n))}
                    className="min-h-9 flex-1 rounded-full border border-border-strong text-sm transition-colors hover:border-black disabled:opacity-40">{f === 1 ? "Max" : `${f * 100}%`}</button>
                ))}
              </div>
            </div>

            <div className="relative z-[1] -my-4 flex justify-center">
              <button type="button" onClick={() => { setSide(side === "buy" ? "sell" : "buy"); setAmount(""); }} aria-label="Switch buy and sell"
                className="grid size-10 place-items-center rounded-full border border-border-strong bg-white transition-colors hover:border-black">
                <ArrowsDownUpIcon weight="bold" className="size-4" />
              </button>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-baseline justify-between text-sm text-muted">
                <span>You receive</span>
                <span className="tabular-nums">Balance {fmt(num(side === "buy" ? bal.coin : bal.usd), 4)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[32px] leading-none tabular-nums text-muted">{receive !== null ? fmt(receive, 4) : "—"}</span>
                <span className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-sm">{getLabel}</span>
              </div>
            </div>
          </section>

          {!isConnected ? (
            <WalletEntry className={cn(cleanButton.solid, "min-h-12 w-full justify-center")} />
          ) : (
            <button type="button" onClick={swap} disabled={Boolean(busy) || !live || !valid || short || shown === null}
              className="min-h-12 rounded-md bg-black text-base text-white transition-opacity disabled:opacity-40">
              {busy ?? (!live ? "Opens after the presale" : !valid ? "Enter an amount" : short ? `Not enough ${payLabel}` : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`)}
            </button>
          )}
          <p className="-mt-3 text-center text-sm text-muted">{tax > 0 ? `${Math.round(tax * 100)}% tax per trade · ` : ""}Free test USD · BSC testnet</p>
        </div>
      </div>
    </div>
  );
}
