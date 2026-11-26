"use client";

import { ArrowRightIcon, ArrowUpRightIcon, PlusIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useDemo } from "@/components/demo-provider";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";
import { useConnectWallet } from "@/components/beta-access";
import { cleanButton, cleanDialog, cn, dialogClose, dialogFooter, dialogHeader, dialogLabel } from "@/components/clean-ui";
import { NetworkSwitch } from "@/components/network-switch";

const note = "mt-4 block text-[13px] text-muted";

/**
 * "Connect": opens the get-started panel just under the nav's connect button
 * (top right), or under whichever button opened it when the nav one isn't shown.
 * `navAnchor` marks the nav's button as that anchor.
 */
export function WalletEntry({ className = cleanButton.solid, disabled = false, navAnchor = false }: { className?: string; disabled?: boolean; navAnchor?: boolean }) {
  const demo = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  const [place, setPlace] = useState<CSSProperties>();
  function open(trigger: HTMLElement) {
    const nav = document.querySelector<HTMLElement>("[data-wallet-anchor]");
    const anchor = nav && nav.getClientRects().length > 0 ? nav : trigger;
    const r = anchor.getBoundingClientRect();
    // Right edge under the anchor's right edge, but never past either side: on phones the panel is nearly
    // full width, so it slides right until its left edge sits 16px in (matches w-[min(380px,calc(100vw-32px))]).
    const width = Math.min(380, window.innerWidth - 32);
    setPlace({ top: r.bottom + 8, right: Math.min(Math.max(16, window.innerWidth - r.right), window.innerWidth - width - 16) });
    dialog.current?.showModal();
  }
  const { openConnect } = useConnectWallet();
  const router = useRouter();

  return <>
    <button type="button" className={className} disabled={disabled} aria-haspopup="dialog" data-wallet-anchor={navAnchor || undefined} onClick={(e) => open(e.currentTarget)}>
      <span>Connect<span className="wallet-word"> wallet</span></span><span aria-hidden="true"><PlusIcon /></span>
    </button>
    <dialog ref={dialog} style={place} className={cn(cleanDialog, "drop-panel inset-auto m-0 w-[min(380px,calc(100vw-32px))] max-h-[calc(100dvh-96px)]")} aria-label="Welcome to grailio" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header className={dialogHeader}><span className={dialogLabel}>[ get started ]</span><button type="button" className={dialogClose} aria-label="Close" onClick={() => dialog.current?.close()}><XIcon /></button></header>
      <div className="p-6">
        <NetworkSwitch className="mb-6" />
        <h2 className="text-3xl leading-[1.1] font-normal tracking-[-0.02em]">Your next move.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">Connect to trade and collect, or take a look around.</p>
      </div>
      <div className={cn(dialogFooter, "flex flex-col")}>
        <button type="button" className={cn(cleanButton.solid, "w-full justify-between")} onClick={() => { dialog.current?.close(); demo.exit(); openConnect(); }}>Connect wallet <ArrowUpRightIcon weight="bold" /></button>
        <small className={note}>Beta code required.</small>
        <button type="button" className={cn(cleanButton.outline, "mt-4 w-full justify-between border-border-strong hover:border-black hover:bg-transparent hover:text-black")} onClick={() => { dialog.current?.close(); demo.start(); router.push("/packs"); }}>Try demo <ArrowRightIcon weight="bold" /></button>
      </div>
    </dialog>
  </>;
}
