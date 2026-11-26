"use client";

import { ArrowUpRight, Copy, KeyRound, LogOut, Play, Wallet, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { cleanButton, cleanDialog, cn, dialogClose, dialogFooter, dialogHeader, dialogLabel } from "@/components/clean-ui";
import { appChain, explorerUrl } from "@/lib/chain";
import { startDemo } from "@/lib/demo";
import { useWalletAuth } from "@/lib/wallet-auth";
import { NetworkSwitch } from "@/components/network-switch";

const note = "mt-4 block text-[13px] text-muted";

/** Opens a drop panel just under the button that opened it (on phones, centred: `.drop-panel` in globals.css). */
function useDropPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [place, setPlace] = useState<CSSProperties>();
  function open(trigger: HTMLElement) {
    const r = trigger.getBoundingClientRect();
    // Right edge under the trigger's right edge, but never past either side (matches w-[min(380px,calc(100vw-32px))]).
    const width = Math.min(380, window.innerWidth - 32);
    setPlace({ top: r.bottom + 8, right: Math.min(Math.max(16, window.innerWidth - r.right), window.innerWidth - width - 16) });
    dialog.current?.showModal();
  }
  const close = () => dialog.current?.close();
  return { dialog, place, open, close };
}

function DropPanel({ panel, label, title, children }: { panel: ReturnType<typeof useDropPanel>; label: ReactNode; title: string; children: ReactNode }) {
  const { dialog, place, close } = panel;
  return (
    <dialog ref={dialog} style={place} className={cn(cleanDialog, "drop-panel inset-auto m-0 w-[min(380px,calc(100vw-32px))] max-h-[calc(100dvh-96px)]")} aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <header className={dialogHeader}>{typeof label === "string" ? <span className={dialogLabel}>[ {label} ]</span> : label}<button type="button" className={dialogClose} aria-label="Close" onClick={close}><X className="size-5" /></button></header>
      {children}
    </dialog>
  );
}

/** "Connect": opens the get-started panel under the button. */
export function WalletEntry({ className = "btn btn-ghost shrink-0", disabled = false }: { className?: string; disabled?: boolean }) {
  const { mode, available, login } = useWalletAuth();
  const panel = useDropPanel();
  const { open, close } = panel;

  return <>
    <button type="button" className={className} disabled={disabled} aria-haspopup="dialog" onClick={(e) => open(e.currentTarget)}>
      <Wallet className="size-4 max-phone:hidden" aria-hidden="true" /><span>Connect<span className="max-phone:hidden"> wallet</span></span>
    </button>
    <DropPanel panel={panel} label={<NetworkSwitch />} title="Connect a wallet">
      <div className="p-6">
        <h2 className="display text-3xl">Your next move.</h2>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button type="button" className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-md bg-black p-4 text-left text-base text-white transition-opacity hover:opacity-90 disabled:opacity-40" disabled={!available} onClick={() => { close(); login(); }}>
            <Wallet className="size-5" aria-hidden="true" />
            Connect wallet
          </button>
          <button type="button" className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-md border border-border-strong p-4 text-left text-base transition-colors hover:border-black" onClick={() => { close(); startDemo(); }}>
            <Play className="size-5" aria-hidden="true" />
            Try the demo
          </button>
        </div>
        {mode !== "privy" && !available && <small className={note}>No browser wallet found.</small>}
      </div>
    </DropPanel>
  </>;
}

/** Header wallet: Connect, a switch-network prompt, or your address (opens a small account panel). */
export function HeaderWallet() {
  const auth = useWalletAuth();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const panel = useDropPanel();
  const { open, close } = panel;
  const [copied, setCopied] = useState(false);

  if (!isConnected || !address) return <WalletEntry disabled={!auth.ready || auth.restoring} />;
  if (chainId !== appChain.id) {
    return (
      <button type="button" className="btn btn-ghost shrink-0 text-warning" disabled={isPending} onClick={() => switchChain({ chainId: appChain.id })}>
        {isPending ? "Switching…" : <>Switch<span className="max-phone:hidden"> network</span></>}
      </button>
    );
  }
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const row = "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-surface-muted";
  return <>
    <button type="button" className="btn btn-ghost shrink-0 max-phone:px-2.5" aria-haspopup="dialog" aria-label={`Wallet ${address}`} onClick={(e) => open(e.currentTarget)}>
      <Wallet className="size-4" aria-hidden="true" /><span className="num max-phone:hidden">{short}</span>
    </button>
    <DropPanel panel={panel} label="wallet" title="Your wallet">
      <div className="p-5">
        <p className="text-sm text-muted">Connected on {appChain.name}</p>
        <p className="num mt-1 text-lg break-all">{address}</p>
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        <button type="button" className={row} onClick={() => { void navigator.clipboard?.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
          {copied ? "Copied" : "Copy address"} <Copy className="size-4 text-muted" />
        </button>
        <a className={row} href={`${explorerUrl}/address/${address}`} target="_blank" rel="noreferrer">View on BscScan <ArrowUpRight className="size-4 text-muted" /></a>
        {auth.exportWallet && (
          <button type="button" className={row} onClick={() => { close(); void auth.exportWallet?.(); }}>Export wallet <KeyRound className="size-4 text-muted" /></button>
        )}
      </div>
      <div className={dialogFooter}>
        <button type="button" className={cn(cleanButton.outline, "w-full justify-between")} onClick={() => { close(); void auth.logout(); }}>Sign out <LogOut className="size-5" /></button>
      </div>
    </DropPanel>
  </>;
}

