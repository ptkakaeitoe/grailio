"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { formatEther, formatUnits } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { cleanButton, cn } from "@/components/clean-ui";
import { WalletEntry } from "@/components/wallet-entry";
import { appChain, explorerUrl } from "@/lib/chain";
import { startDemo, useDemo } from "@/lib/demo";
import { showToast } from "@/lib/toast";
import { TEST_USD, TEST_USD_CLAIM, testUsdAbi } from "@/lib/trade-market";
import { txErrorMessage } from "@/lib/tx-error";

/** Free tBNB for gas (BNB Chain's official testnet faucet). */
export const TBNB_FAUCET = "https://www.bnbchain.org/en/testnet-faucet";

const KEY = "bsctemp.get-started.v1";
const listeners = new Set<() => void>();
const readHidden = () => { try { return localStorage.getItem(KEY) === "done"; } catch { return false; } };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function hide() {
  try { localStorage.setItem(KEY, "done"); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 });

/** Secondary way in without a wallet: the demo wallet (everything simulated). */
export function TryDemoLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={startDemo} className={cn("text-sm text-muted underline-offset-4 transition-colors hover:text-black hover:underline", className)}>
      Try without a wallet
    </button>
  );
}

/** An empty state's actions: Connect wallet first, the demo as a small link under it. */
export function ConnectOrDemo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <WalletEntry className={cleanButton.solid} />
      <TryDemoLink />
    </div>
  );
}

/**
 * The first-run strip: Connect wallet when there's none, then three steps on BSC testnet: get tBNB for gas (faucet),
 * claim 100 test USD (Flap's open-mint test USD), trade a stock. Shows the live balances; hidden once dismissed or
 * once the wallet has both tBNB and test USD.
 */
export function GetStarted() {
  const demo = useDemo();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && Boolean(address) && chainId === appChain.id;
  const hidden = useSyncExternalStore(subscribe, readHidden, () => true);
  const client = usePublicClient({ chainId: appChain.id });
  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState(false);

  const bnb = useBalance({ chainId: appChain.id, address, query: { enabled: onChain, refetchInterval: 15_000 } });
  const usd = useReadContract({ chainId: appChain.id, address: TEST_USD, abi: testUsdAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: onChain, refetchInterval: 15_000 } });
  const bnbBal = bnb.data ? Number(formatEther(bnb.data.value)) : null;
  const usdBal = usd.data !== undefined ? Number(formatUnits(usd.data, 18)) : null;
  const hasGas = bnbBal !== null && bnbBal > 0;
  const hasUsd = usdBal !== null && usdBal > 0;

  // Done once the wallet is funded: no need to show the steps again.
  useEffect(() => { if (onChain && hasGas && hasUsd && !hidden) hide(); }, [onChain, hasGas, hasUsd, hidden]);

  if (hidden && onChain) return null;
  if (demo.active && !isConnected) return null;

  async function claim() {
    if (!address || !client) return;
    setClaiming(true);
    const id = showToast({ kind: "loading", title: "Claiming test USD", detail: "Confirm in your wallet…" });
    try {
      const hash = await writeContractAsync({ chainId: appChain.id, address: TEST_USD, abi: testUsdAbi, functionName: "mint", args: [address, TEST_USD_CLAIM] });
      showToast({ kind: "loading", title: "Claiming test USD", detail: "Confirming on BSC testnet…", href: `${explorerUrl}/tx/${hash}` }, id);
      const r = await client.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("The transaction was reverted.");
      showToast({ kind: "success", title: "100 test USD claimed", detail: "BSC testnet", href: `${explorerUrl}/tx/${hash}` }, id);
      void usd.refetch();
    } catch (e) {
      showToast({ kind: "error", title: "Claim failed", detail: txErrorMessage(e) }, id);
    } finally {
      setClaiming(false);
    }
  }

  const step = "flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3.5 text-sm transition-colors hover:border-black";
  const done = <Check className="size-4 text-up" aria-label="done" />;

  if (!onChain) {
    // No wallet yet (or the wrong network: the header shows Switch network).
    if (isConnected) return null;
    return (
      <section aria-label="Get started" className="mb-6 flex flex-col items-start justify-between gap-3 rounded-md border border-border px-4 py-3.5 phone:flex-row phone:items-center">
        <div>
          <p className="text-base">Trade on BSC testnet</p>
          <p className="text-[13px] text-muted">Free test tokens, real transactions</p>
        </div>
        <div className="flex items-center gap-4">
          <TryDemoLink />
          <WalletEntry className={cn(cleanButton.solid, "min-h-11")} />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Get started" className="mb-6 rounded-md border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base">Get started <span className="text-sm text-muted">· BSC testnet</span></p>
        <button type="button" onClick={hide} aria-label="Hide get started" className="-m-2 grid size-9 place-items-center rounded-md text-muted hover:text-black"><X className="size-4" /></button>
      </div>
      <ol className="mt-3 grid gap-2 desk:grid-cols-3">
        <li>
          <a href={TBNB_FAUCET} target="_blank" rel="noreferrer" className={step}>
            <span><span className="text-muted">1</span> Get tBNB for gas</span>
            <span className="num flex items-center gap-1.5 text-muted">{bnbBal !== null ? fmt(bnbBal) : "—"}{hasGas ? done : <ArrowUpRight className="size-4" />}</span>
          </a>
        </li>
        <li>
          <button type="button" className={cn(step, "w-full disabled:opacity-50")} disabled={claiming || !hasGas} onClick={claim}>
            <span><span className="text-muted">2</span> {claiming ? "Claiming…" : "Claim 100 test USD"}</span>
            <span className="num flex items-center gap-1.5 text-muted">{usdBal !== null ? fmt(usdBal) : "—"}{hasUsd && done}</span>
          </button>
        </li>
        <li>
          <Link href="/app/trade/stock/NVDA" className={step}>
            <span><span className="text-muted">3</span> Trade a stock</span>
            <ArrowUpRight className="size-4 text-muted" />
          </Link>
        </li>
      </ol>
    </section>
  );
}
