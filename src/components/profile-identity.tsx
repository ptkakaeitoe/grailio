"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, Check, Pencil, X } from "lucide-react";
import { Holo, StockCardFront } from "@/components/stock-card-front";
import { cleanButton, cleanDialog, cleanDrawerRight, cleanField, cn, dialogClose, dialogHeader, dialogLabel } from "@/components/clean-ui";
import type { StockCard } from "@/lib/cards";
import { useCollection, type OwnedCard } from "@/lib/collection";
import { useCardArt } from "@/lib/design";
import { avatarCard, bioBytes, MAX_BIO, MAX_ZOOM, MIN_ZOOM, NAME_MAX, saveProfile, useProfile, validName, type Profile, type ProfileAvatar } from "@/lib/profile";

/* Profile picture, username and bio (ported from graily's demo profile and card avatar). */

/** Card art is 2:3, so it is 1.5× as tall as it is wide. */
const CARD_ASPECT = 1.5;
const RARITY = ["Common", "Rare", "Epic", "Legendary"];

/** Keeps the focus point far enough from the edges that the art always covers the circle at this zoom (basis points). */
function clampCrop(x: number, y: number, zoom: number) {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const clamp = (v: number, size: number) => Math.min(Math.max(v, (50 / size) * 10_000), ((size - 50) / size) * 10_000);
  return { x: Math.round(clamp(x, z)), y: Math.round(clamp(y, z * CARD_ASPECT)), zoom: z };
}

/** Places the art so the focus point sits in the middle of the avatar. */
function cropStyle(x: number, y: number, zoom: number): CSSProperties {
  const c = clampCrop(x, y, zoom);
  return {
    position: "absolute", maxWidth: "none", objectFit: "cover",
    width: `${c.zoom}%`, height: `${c.zoom * CARD_ASPECT}%`,
    left: `${50 - (c.x / 10_000) * c.zoom}%`, top: `${50 - (c.y / 10_000) * c.zoom * CARD_ASPECT}%`,
  };
}

/** A round picture cropped from a card's art; fills its (relative) parent. */
function CropArt({ art, crop, px }: { art: StockCard; crop: { x: number; y: number; zoom: number }; px: number }) {
  // The art is drawn at zoom% of the avatar's width, so ask for an image that wide.
  const sizes = `${Math.min(1024, Math.ceil((px * crop.zoom) / 100))}px`;
  return (
    <span className="absolute inset-0 block overflow-hidden rounded-full">
      <Image src={art.src} alt="" width={1024} height={1536} sizes={sizes} quality={90} unoptimized={!art.src.startsWith("/")} style={cropStyle(crop.x, crop.y, crop.zoom)} draggable={false} />
    </span>
  );
}

/** Your cards in this browser that can be a picture: every card you still hold. */
function useAvatarCards(enabled: boolean) {
  const all = useCollection();
  return enabled ? all.filter((c) => !c.redeemedAt) : [];
}

/** The saved picture (or initials, if unset or the card is gone). */
export function ProfileAvatarView({ profile, cards, fallback, className, px = 80 }: { profile: Profile; cards: OwnedCard[]; fallback: string; className?: string; px?: number }) {
  const cardArt = useCardArt();
  const card = avatarCard(profile.avatar, cards);
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-muted text-muted uppercase", className)} aria-hidden="true">
      {card && profile.avatar ? <CropArt art={cardArt(card)} crop={profile.avatar} px={px * 2} /> : fallback.slice(0, 2)}
    </span>
  );
}

/**
 * The profile header: picture, @username (or the wallet), bio, Edit profile and the given account actions.
 * `storeKey` is the wallet address or "demo"; `cardsEnabled` is false where there are no cards to pick from.
 */
export function ProfileHeader({ storeKey, fallbackName, initials, cardsEnabled, mono, actions }: {
  storeKey: string;
  fallbackName: string;
  initials: string;
  cardsEnabled: boolean;
  mono?: boolean;
  actions?: ReactNode;
}) {
  const profile = useProfile(storeKey);
  const cards = useAvatarCards(cardsEnabled);
  const [editing, setEditing] = useState(false);
  const fallback = profile.name || initials;

  return (
    <section aria-label="Identity" className="mt-4 flex flex-col gap-5 phone:flex-row phone:items-start desk:mt-6">
      <ProfileAvatarView profile={profile} cards={cards} fallback={fallback} className="size-20 text-2xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-4 desk:flex-row desk:items-start desk:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <p className={cn("truncate text-[28px] leading-[1.2] tracking-tight", !profile.name && mono && "tabular-nums")}>{profile.name ? `@${profile.name}` : fallbackName}</p>
            <button type="button" className="grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-black" aria-label="Edit profile" aria-haspopup="dialog" onClick={() => setEditing(true)}><Pencil className="size-4" /></button>
          </div>
          {profile.bio && <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed break-words whitespace-pre-line">{profile.bio}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-1.5 desk:justify-end">{actions}</div>}
      </div>
      {editing && <ProfileEditor storeKey={storeKey} profile={profile} cards={cards} initials={initials} onClose={() => setEditing(false)} />}
    </section>
  );
}

const label = "flex flex-col gap-1.5 text-sm text-muted";
const field = cn(cleanField, "text-black");

/** Edit profile, in a drawer from the right: picture, username and bio, saved together. */
function ProfileEditor({ storeKey, profile, cards, initials, onClose }: { storeKey: string; profile: Profile; cards: OwnedCard[]; initials: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cardArt = useCardArt();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  // A picture whose card is gone starts cleared.
  const [avatar, setAvatar] = useState<ProfileAvatar | null>(avatarCard(profile.avatar, cards) ? profile.avatar : null);
  const [picking, setPicking] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  const card = avatarCard(avatar, cards);
  const nameOk = validName(name);
  const size = bioBytes(bio.trim());
  const valid = nameOk && size <= MAX_BIO;

  // Slide back out to the right, then unmount (matches the .side-drawer transition).
  function dismiss() {
    dialog.current?.close();
    window.setTimeout(onClose, 340);
  }

  function pick(c: OwnedCard) {
    setAvatar({ cardId: c.id, openedAt: c.openedAt, ...clampCrop(5000, 3000, 200) });
  }

  function setCrop(x: number, y: number, zoom: number) {
    setAvatar((a) => (a ? { ...a, ...clampCrop(x, y, zoom) } : a));
  }

  return (
    <dialog ref={dialog} className={cn(cleanDrawerRight, "w-[min(420px,calc(100vw-16px))] max-phone:top-auto max-phone:h-auto max-phone:max-h-[calc(100dvh-80px)]")} aria-labelledby="edit-profile-title"
      onCancel={(e) => { e.preventDefault(); dismiss(); }} onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <header className={dialogHeader}>
        <h2 id="edit-profile-title" className={dialogLabel}>Edit profile</h2>
        <button type="button" className={dialogClose} aria-label="Close" onClick={dismiss}><X className="size-5" /></button>
      </header>
      <form className="flex flex-1 flex-col gap-6 px-5 pt-5" onSubmit={(e) => { e.preventDefault(); if (!valid) return; saveProfile(storeKey, { name, bio, avatar: card ? avatar : null }); dismiss(); }}>
        <div className="flex items-center gap-4">
          {/* Drag the picture to frame it. */}
          <span
            className={cn("relative grid size-24 shrink-0 touch-none place-items-center overflow-hidden rounded-full bg-surface-muted text-xl text-muted uppercase select-none", card && "cursor-grab active:cursor-grabbing")}
            aria-hidden="true"
            onPointerDown={(e) => { if (!avatar || !card) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: avatar.x, y: avatar.y }; }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || !avatar) return;
              const w = (e.currentTarget.offsetWidth * avatar.zoom) / 100;
              setCrop(d.x - ((e.clientX - d.px) / w) * 10_000, d.y - ((e.clientY - d.py) / (w * CARD_ASPECT)) * 10_000, avatar.zoom);
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            {card && avatar ? <CropArt art={cardArt(card)} crop={avatar} px={192} /> : (name || initials).slice(0, 2)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button type="button" className={cn(cleanButton.small, "min-h-11 justify-center")} aria-haspopup="dialog" onClick={() => setPicking(true)}>{card ? "Change card" : "Choose card"}</button>
            {card && <button type="button" className="min-h-11 rounded-md text-sm text-muted transition-colors hover:text-black" onClick={() => setAvatar(null)}>Remove picture</button>}
          </div>
        </div>
        {card && avatar && (
          <label className={cn(label, "-mt-2")}>
            <span>Zoom</span>
            <input type="range" className="h-11 accent-black" min={MIN_ZOOM} max={MAX_ZOOM} step={5} value={avatar.zoom} onChange={(e) => setCrop(avatar.x, avatar.y, Number(e.target.value))} />
          </label>
        )}

        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <label className={label}>
            <span>Username</span>
            <span className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true">@</span>
              <input className={cn(field, "pl-7")} value={name} maxLength={NAME_MAX} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!nameOk || undefined}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
            </span>
            {!nameOk && <span className="text-down">3–16 letters, numbers or _</span>}
          </label>
          <label className={label}>
            <span className="flex justify-between"><span>Bio</span><span className={cn("tabular-nums", size > MAX_BIO && "text-down")}>{size}/{MAX_BIO}</span></span>
            <textarea rows={3} className={cn(field, "h-auto resize-none py-2")} value={bio} aria-invalid={size > MAX_BIO || undefined} onChange={(e) => setBio(e.target.value)} />
          </label>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 border-t border-border bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="submit" className={cn(cleanButton.solid, "w-full justify-center")} disabled={!valid}>Save</button>
        </div>
      </form>
      {picking && <CardPickerDialog cards={cards} selected={card?.id ?? null} onSelect={pick} onClose={() => setPicking(false)} />}
    </dialog>
  );
}

/** Pick one of your cards as your picture. */
function CardPickerDialog({ cards, selected, onSelect, onClose }: { cards: OwnedCard[]; selected: number | null; onSelect: (card: OwnedCard) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cardArt = useCardArt();
  useEffect(() => { dialog.current?.showModal(); }, []);
  const sorted = [...cards].reverse();

  return (
    <dialog ref={dialog} className={cn(cleanDialog, "w-[min(560px,calc(100%-32px))]")} aria-labelledby="card-picker-title"
      onCancel={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <header className={dialogHeader}>
        <span className={dialogLabel} id="card-picker-title">Choose a card</span>
        <button type="button" className={dialogClose} aria-label="Close" onClick={onClose}><X className="size-5" /></button>
      </header>
      <div className="p-5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-base text-muted">No cards yet.</p>
            <Link className={cleanButton.solid} href="/app/packs">Browse packs <ArrowUpRight className="size-4" /></Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 phone:grid-cols-3" aria-label="Your cards">
            {sorted.map((c) => {
              const art = cardArt(c);
              const picked = c.id === selected;
              return (
                <li key={c.id} className="min-w-0">
                  <button type="button" aria-pressed={picked} onClick={() => { onSelect(c); onClose(); }}
                    className={cn("relative flex w-full flex-col gap-2 rounded-md border p-2 text-left transition-colors", picked ? "border-black" : "border-border hover:border-black")}>
                    <span className="relative block overflow-hidden rounded-[4px]">
                      <StockCardFront art={art} rarity={c.rarity} brand={c.coinName} decorative sizes="160px" className="w-full" />
                      <Holo rarity={c.rarity} />
                    </span>
                    <span className="min-w-0 px-0.5">
                      <span className="block truncate text-sm">#{c.id} · {RARITY[c.rarity] ?? ""}</span>
                      <span className="block truncate text-[13px] text-muted">{c.ticker} · {art.name}</span>
                    </span>
                    {picked && <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-black text-white"><Check className="size-3.5" /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
