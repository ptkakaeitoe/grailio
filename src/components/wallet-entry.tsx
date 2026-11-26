"use client";

import { ArrowUpRight, Copy, KeyRound, LogOut, Wallet, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { cleanButton, cleanDialog, cn, dialogClose, dialogFooter, dialogHeader, dialogLabel } from "@/components/clean-ui";
import { appChain, explorerUrl } from "@/lib/chain";
import { startDemo } from "@/lib/demo";
import { useWalletAuth } from "@/lib/wallet-auth";
import { NetworkSwitch } from "@/components/network-switch";

/** The header's wallet buttons: the hero's outlined button, a touch smaller on phones. */
const headerButton = cn(cleanButton.outline, "shrink-0 max-phone:min-h-10 max-phone:px-3");

/**
 * Closes a dialog, then runs `action` once its close transition has played. For actions that unmount the dialog
 * (starting demo hides the header's Connect; signing out swaps the wallet button), so it isn't torn out mid-animation.
 */
function closeThen(el: HTMLDialogElement | null, action: () => void) {
  if (!el) return action();
  el.close();
  // Reading animations flushes style, so the close transitions (panel and ::backdrop) are already listed here.
  const closing = el.getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition);
  void Promise.allSettled(closing.map((a) => a.finished)).then(action);
}

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
  return { dialog, place, open, close, closeThen: (action: () => void) => closeThen(dialog.current, action) };
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

const walletRow = "flex min-h-[72px] w-full items-center gap-3.5 rounded-lg border border-border px-4 text-left transition-colors hover:border-black disabled:opacity-40 disabled:hover:border-border";
const rowIcon = "grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted";

/** "Connect": a centred wallet-connect modal with the network switch and the ways in. */
export function WalletEntry({ className = headerButton, disabled = false }: { className?: string; disabled?: boolean }) {
  const { mode, available, login, wallets = [] } = useWalletAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return <>
    <button type="button" className={className} disabled={disabled} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <Wallet className="size-4 max-phone:hidden" aria-hidden="true" /><span>Connect<span className="max-phone:hidden"> wallet</span></span>
    </button>
    <dialog ref={dialog} aria-label="Connect a wallet" className={cn(cleanDialog, "w-[min(460px,calc(100vw-24px))] max-h-[calc(100dvh-48px)]")} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <header className={dialogHeader}>
        <h2 className="text-lg leading-tight font-normal">Connect</h2>
        <button type="button" className={dialogClose} aria-label="Close" onClick={close}><X className="size-5" /></button>
      </header>
      <div className="flex flex-col gap-6 p-5 phone:p-6">
        <NetworkSwitch wide />
        <div className="flex flex-col gap-2.5">
          {mode === "privy" ? (
            <button type="button" className={walletRow} onClick={() => { close(); login(); }}>
              <span className={rowIcon}><Wallet className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-base">Email, Google or wallet</span></span>
              <ArrowUpRight className="size-4 text-muted" aria-hidden="true" />
            </button>
          ) : wallets.length > 0 ? (
            wallets.map((w) => (
              <button key={w.id} type="button" className={walletRow} onClick={() => { close(); login(w.id); }}>
                <span className={cn(rowIcon, "overflow-hidden")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the wallet's own data-URL icon (EIP-6963) */}
                  {w.icon ? <img src={w.icon} alt="" className="size-6" /> : <Wallet className="size-5" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-base">{w.name}</span></span>
                <span className="shrink-0 text-[13px] text-up">Detected</span>
              </button>
            ))
          ) : (
            <button type="button" className={walletRow} onClick={() => { close(); login(); }}>
              <span className={rowIcon}><Wallet className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-base">Browser wallet</span>
                <span className="block truncate text-[13px] text-muted">MetaMask, Rabby</span>
              </span>
              <span className={cn("shrink-0 text-[13px]", available ? "text-up" : "text-muted")}>{available ? "Detected" : "Not found"}</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-5 text-[13px] text-muted phone:px-6">
        <span>{appChain.name}</span>
        <button type="button" className="underline-offset-4 transition-colors hover:text-black hover:underline" onClick={() => closeThen(dialog.current, startDemo)}>Try without a wallet (simulated)</button>
      </div>
    </dialog>
  </>;
}

/** Header wallet: Connect, a switch-network prompt, or your address (opens a small account panel). */
export function HeaderWallet() {
  const auth = useWalletAuth();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const panel = useDropPanel();
  const { open, close, closeThen } = panel;
  const [copied, setCopied] = useState(false);

  if (!isConnected || !address) return <WalletEntry disabled={!auth.ready || auth.restoring} />;
  if (chainId !== appChain.id) {
    return (
      <button type="button" className={cn(headerButton, "text-warning")} disabled={isPending} onClick={() => switchChain({ chainId: appChain.id })}>
        {isPending ? "Switching…" : <>Switch<span className="max-phone:hidden"> network</span></>}
      </button>
    );
  }
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const row = "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-surface-muted";
  return <>
    <button type="button" className={cn(headerButton, "max-phone:px-2.5")} aria-haspopup="dialog" aria-label={`Wallet ${address}`} onClick={(e) => open(e.currentTarget)}>
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
        <button type="button" className={cn(cleanButton.outline, "w-full justify-between")} onClick={() => closeThen(() => void auth.logout())}>Sign out <LogOut className="size-5" /></button>
      </div>
    </DropPanel>
  </>;
}

