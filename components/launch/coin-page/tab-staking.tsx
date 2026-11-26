"use client";

import { CheckIcon, PlusIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";

import { cleanButton, cleanDialog, cn, dialogClose, dialogFooter, dialogHeader, dialogLabel } from "@/components/clean-ui";
import { RARITY_NAMES } from "@/lib/contracts";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";

import { money, pct } from "./tab-format";
import type { CoinPack, CoinStakedCard } from "./types";

/** Small card thumbnail: the card's own art if given, else a rarity-toned placeholder with the ticker. */
function Thumb({ card, size = "w-9" }: { card: CoinStakedCard; size?: string }) {
  if (card.art) return <span className={cn("relative block shrink-0 overflow-hidden rounded-[3px]", size)}>{card.art}</span>;
  return (
    <span className={cn("grid aspect-[5/7] shrink-0 place-items-center rounded-[3px] border border-border bg-surface-muted text-[10px] text-muted", size)} aria-hidden="true">
      {card.ticker}
    </span>
  );
}

/** Card staking for this coin, in the Collection staking box's design: claim on top, four stats, then each staked card. */
export function TabStaking({ pack }: { pack: CoinPack }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const s = pack.staking;

  async function run(label: string, fn?: () => Promise<void>) {
    if (!fn) return;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      showToast({ kind: "error", title: `${label} failed`, detail: txErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!s) {
    return <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-sm text-muted">Staking opens after launch.</p>;
  }

  const myValue = s.staked.reduce((t, c) => t + c.valueUsd, 0);
  const stats = [
    { label: "Pool", value: money(s.poolUsd) },
    { label: "Pays out", value: `${money(s.perDayUsd)}/day` },
    { label: "Your share", value: myValue > 0 ? pct(s.share) : "—" },
    { label: "You earn", value: myValue > 0 ? `${money(s.perDayUsd * s.share)}/day` : "—" },
  ];

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-end justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">Staking{s.timeNote && <span className="text-[12px]"> · {s.timeNote}</span>}</p>
          <p className="mt-1 text-[28px] leading-none tabular-nums">{money(s.claimableUsd)}</p>
          <p className="mt-1 text-[13px] text-muted">claimable</p>
        </div>
        <button
          type="button"
          className={cn(cleanButton.solid, "min-h-11 shrink-0 px-6")}
          disabled={Boolean(busy) || s.claimableUsd <= 0 || !pack.actions.claimRewards}
          onClick={() => void run("Claim", pack.actions.claimRewards)}
        >
          {busy === "Claim" ? "Claiming…" : "Claim"}
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 border-t border-border desk:grid-cols-4">
        {stats.map((st, i) => (
          <div key={st.label} className={cn("min-w-0 px-5 py-3", i % 2 === 1 && "border-l border-border", i >= 2 && "border-border max-desk:border-t desk:border-l")}>
            <dt className="text-[12px] text-muted">{st.label}</dt>
            <dd className="mt-0.5 truncate text-base tabular-nums">{st.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-border">
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
          <p className="text-[13px] text-muted">{s.staked.length > 0 ? `Staked cards · ${s.staked.length}` : "No cards staked yet."}</p>
          <button type="button" className={cn(cleanButton.small, "min-h-9")} disabled={s.stakeable.length === 0 || !pack.actions.stake || Boolean(busy)} onClick={() => setPicking(true)}>
            <PlusIcon weight="bold" className="size-3.5" /> Stake a card
          </button>
        </div>
        {s.staked.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {s.staked.map((card) => (
              <li key={card.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-2.5 desk:grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Thumb card={card} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{card.ticker} <span className="text-muted">#{card.id}</span></span>
                  <span className="block truncate text-[12px] text-muted">{RARITY_NAMES[card.rarity] ?? "Card"} · {card.ticker}</span>
                </span>
                <span className="hidden text-sm tabular-nums desk:block"><span className="block text-[12px] text-muted">Holds</span>{money(card.valueUsd)}</span>
                <span className="hidden text-sm tabular-nums desk:block"><span className="block text-[12px] text-muted">Earns</span><span className="text-up">{money(card.earnsPerDayUsd)}/day</span></span>
                <button
                  type="button"
                  className={cn(cleanButton.small, "min-h-9 px-4")}
                  disabled={Boolean(busy) || !pack.actions.unstake}
                  onClick={() => void run("Unstake", pack.actions.unstake && (() => pack.actions.unstake!([card.id])))}
                >
                  {busy === "Unstake" ? "…" : "Unstake"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {picking && (
        <StakePicker
          cards={s.stakeable}
          busy={busy === "Stake"}
          onClose={() => setPicking(false)}
          onStake={async (ids) => {
            await run("Stake", pack.actions.stake && (() => pack.actions.stake!(ids)));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/** Pick one or more of this coin's cards to stake. */
function StakePicker({ cards, busy, onClose, onStake }: { cards: CoinStakedCard[]; busy: boolean; onClose: () => void; onStake: (ids: string[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => { dialog.current?.showModal(); }, []);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const total = cards.filter((c) => picked.has(c.id)).reduce((t, c) => t + c.valueUsd, 0);
  return (
    <dialog
      ref={dialog}
      className={cn(cleanDialog, "w-[min(560px,calc(100%-32px))]")}
      aria-labelledby="stake-pick-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <header className={dialogHeader}>
        <h2 id="stake-pick-title" className={dialogLabel}>[ stake cards ]</h2>
        <button type="button" className={dialogClose} aria-label="Close" disabled={busy} onClick={onClose}><XIcon className="size-[18px]" /></button>
      </header>
      {cards.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">No cards to stake. Open a pack first.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 p-5 phone:grid-cols-4">
          {cards.map((c) => {
            const on = picked.has(c.id);
            return (
              <li key={c.id}>
                <button type="button" aria-pressed={on} onClick={() => toggle(c.id)} className={cn("relative flex w-full flex-col gap-1.5 rounded-md border-[1.5px] p-1.5 text-left transition-colors", on ? "border-black" : "border-border hover:border-border-strong")}>
                  <Thumb card={c} size="w-full" />
                  <span className="truncate px-0.5 text-[12px] text-muted">{RARITY_NAMES[c.rarity] ?? "Card"} · {c.ticker}</span>
                  <span className="px-0.5 text-sm tabular-nums">{money(c.valueUsd)}</span>
                  {on && <span className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-black text-white"><CheckIcon weight="bold" className="size-3.5" /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className={cn(dialogFooter, "flex items-center justify-between gap-3")}>
        <span className="text-sm text-muted tabular-nums">{picked.size > 0 ? `${picked.size} · ${money(total)}` : "Pick cards"}</span>
        <button type="button" className={cn(cleanButton.solid, "min-h-11 px-6")} disabled={busy || picked.size === 0} onClick={() => onStake([...picked])}>
          {busy ? "Staking…" : picked.size > 1 ? `Stake ${picked.size}` : "Stake"}
        </button>
      </div>
    </dialog>
  );
}
