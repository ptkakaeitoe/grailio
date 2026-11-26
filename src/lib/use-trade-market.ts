"use client";

import { useCallback, useState } from "react";
import { erc20Abi, formatEther, formatUnits, parseEther, parseUnits, zeroAddress, type Hex } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { appChain, explorerUrl } from "@/lib/chain";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";
import {
  refreshTradePrices, TEST_USD, TEST_USD_CLAIM, testUsdAbi, TRADE_MARKET, tradeLive, tradeMarketAbi, TRADE_STOCKS,
} from "@/lib/trade-market";

export type TradeCurrency = "USD" | "BNB";

/**
 * Real trading on the testnet trade market for the connected wallet: test USD and tBNB balances, Claim test USD, and
 * buy / sell of listed stocks with a toast per step. `live` is false (callers keep demo mode) until the market is
 * deployed and a wallet is connected on BSC testnet.
 */
export function useTradeMarket() {
  const { address, chainId, isConnected } = useAccount();
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const live = tradeLive && isConnected && Boolean(address) && chainId === appChain.id;
  const [busy, setBusy] = useState<string | null>(null);

  const usd = useReadContract({ chainId: appChain.id, address: TEST_USD, abi: testUsdAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: live, refetchInterval: 15_000 } });
  const bnb = useBalance({ chainId: appChain.id, address, query: { enabled: live, refetchInterval: 15_000 } });
  const usdBalance = usd.data !== undefined ? Number(formatUnits(usd.data, 18)) : null;
  const bnbBalance = bnb.data ? Number(formatEther(bnb.data.value)) : null;

  const refetch = useCallback(() => { void usd.refetch(); void bnb.refetch(); }, [usd, bnb]);

  /** Wraps one wallet flow: busy label, a loading toast that turns into done (with a BscScan link) or the error. */
  const run = useCallback(async (label: string, done: string, fn: (step: (hash: Hex) => Promise<void>) => Promise<void>) => {
    if (!client) return false;
    setBusy(label);
    const id = showToast({ kind: "loading", title: label, detail: "Confirm in your wallet…" });
    let last: Hex | undefined;
    try {
      await fn(async (hash) => {
        last = hash;
        showToast({ kind: "loading", title: label, detail: "Confirming on BSC testnet…", href: `${explorerUrl}/tx/${hash}` }, id);
        const r = await client.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error("The transaction was reverted.");
      });
      showToast({ kind: "success", title: done, detail: "BSC testnet", href: last ? `${explorerUrl}/tx/${last}` : undefined }, id);
      return true;
    } catch (e) {
      showToast({ kind: "error", title: `${label.replace("…", "")} failed`, detail: txErrorMessage(e), href: last ? `${explorerUrl}/tx/${last}` : undefined }, id);
      return false;
    } finally {
      setBusy(null);
      refetch();
    }
  }, [client, refetch]);

  /** Mints 100 test USD to the wallet (Flap's test USD is open to anyone). */
  const claimUsd = useCallback(() => {
    if (!address) return Promise.resolve(false);
    return run("Claiming test USD…", "100 test USD claimed", async (step) => {
      await step(await writeContractAsync({ chainId: appChain.id, address: TEST_USD, abi: testUsdAbi, functionName: "mint", args: [address, TEST_USD_CLAIM] }));
    });
  }, [address, run, writeContractAsync]);

  /** Buys `ticker` with `amount` (decimal string) of test USD or tBNB, after asking the keeper for a fresh price. */
  const buy = useCallback((ticker: string, currency: TradeCurrency, amount: string) => {
    const stock = TRADE_STOCKS[ticker];
    if (!address || !client || !TRADE_MARKET || !stock) return Promise.resolve(false);
    const market = TRADE_MARKET;
    return run(`Buying ${ticker}…`, `Bought ${ticker}`, async (step) => {
      await refreshTradePrices([ticker]);
      if (currency === "BNB") {
        await step(await writeContractAsync({ chainId: appChain.id, address: market, abi: tradeMarketAbi, functionName: "buy", args: [stock, address], value: parseEther(amount) }));
        return;
      }
      const raw = parseUnits(amount, 18);
      const allowance = await client.readContract({ address: TEST_USD, abi: testUsdAbi, functionName: "allowance", args: [address, market] });
      if (allowance < raw) await step(await writeContractAsync({ chainId: appChain.id, address: TEST_USD, abi: testUsdAbi, functionName: "approve", args: [market, raw] }));
      await step(await writeContractAsync({ chainId: appChain.id, address: market, abi: tradeMarketAbi, functionName: "buyWith", args: [stock, TEST_USD, raw, address] }));
    });
  }, [address, client, run, writeContractAsync]);

  /** Sells `amount` (decimal string) of `ticker` for test USD (or tBNB from the market's reserve). */
  const sell = useCallback((ticker: string, amount: string, currency: TradeCurrency = "USD") => {
    const stock = TRADE_STOCKS[ticker];
    if (!address || !TRADE_MARKET || !stock) return Promise.resolve(false);
    const market = TRADE_MARKET;
    return run(`Selling ${ticker}…`, `Sold ${ticker}`, async (step) => {
      await refreshTradePrices([ticker]);
      await step(await writeContractAsync({ chainId: appChain.id, address: market, abi: tradeMarketAbi, functionName: "sellFor", args: [stock, currency === "BNB" ? zeroAddress : TEST_USD, parseUnits(amount, 18), address] }));
    });
  }, [address, run, writeContractAsync]);

  return { live, address, busy, usdBalance, bnbBalance, claimUsd, buy, sell, refetch };
}

/** The wallet's balance of one listed stock (18 decimals), live only. */
export function useStockBalance(ticker: string | null) {
  const { address } = useAccount();
  const stock = ticker ? TRADE_STOCKS[ticker] : undefined;
  const r = useReadContract({ chainId: appChain.id, address: stock, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: Boolean(stock && address), refetchInterval: 15_000 } });
  return { balance: r.data !== undefined ? Number(formatUnits(r.data, 18)) : null, refetch: r.refetch };
}

/** Quote units (test USD or tBNB, 18 decimals) per whole listed stock on the market, live only. */
export function useMarketPrice(ticker: string | null, currency: TradeCurrency) {
  const stock = ticker ? TRADE_STOCKS[ticker] : undefined;
  const r = useReadContract({
    chainId: appChain.id, address: TRADE_MARKET ?? undefined, abi: tradeMarketAbi, functionName: "priceIn",
    args: stock ? [stock, currency === "BNB" ? zeroAddress : TEST_USD] : undefined,
    query: { enabled: Boolean(stock && TRADE_MARKET), refetchInterval: 30_000 },
  });
  return r.data !== undefined && r.data > 0n ? Number(formatUnits(r.data, 18)) : null;
}
