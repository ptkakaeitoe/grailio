"use client";

import { useSyncExternalStore } from "react";
import type { OwnedCard } from "@/lib/collection";

/*
 * Your profile: username, bio and a picture cropped from one of your cards. Saved in this browser, per wallet
 * address (or "demo"), until Grailio has profile contracts on BSC testnet. Same rules as graily's CollectNames and
 * CollectProfiles contracts; usernames can't be checked for uniqueness locally.
 */

/** graily CollectNames.isValid: 3–16 of a–z, 0–9 and _. */
export const NAME_PATTERN = /^[a-z0-9_]{3,16}$/;
export const NAME_MAX = 16;
/** graily CollectProfiles.MAX_BIO: 160 bytes of UTF-8. */
export const MAX_BIO = 160;
/** graily CollectProfiles: zoom 100–400 (% of the avatar's width), focus in basis points. */
export const MIN_ZOOM = 100;
export const MAX_ZOOM = 400;

/** The card the picture comes from (id plus opened time, since ids restart after a demo reset) and its crop. */
export type ProfileAvatar = { cardId: number; openedAt: number; x: number; y: number; zoom: number };
export type Profile = { name: string; bio: string; avatar: ProfileAvatar | null };

const KEY = "bsctemp.profile.v1";
export const EMPTY_PROFILE: Profile = { name: "", bio: "", avatar: null };
const listeners = new Set<() => void>();
let cache: Record<string, Profile> | null = null;
const NONE: Record<string, Profile> = {};

function load(): Record<string, Profile> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { cache = {}; }
  if (!cache || typeof cache !== "object") cache = {};
  return cache!;
}

function save(next: Record<string, Profile>) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep it in memory */ }
  listeners.forEach((l) => l());
}

/** Storage key: the wallet address (lowercase) or "demo". */
export const profileKey = (demo: boolean, address?: string) => (demo ? "demo" : address ? address.toLowerCase() : "");

export const bioBytes = (bio: string) => new TextEncoder().encode(bio).length;
export const validName = (name: string) => name === "" || NAME_PATTERN.test(name);

export function saveProfile(key: string, profile: Profile) {
  if (!key) return;
  const name = profile.name.trim();
  const bio = profile.bio.trim();
  if (!validName(name) || bioBytes(bio) > MAX_BIO) return;
  save({ ...load(), [key]: { name, bio, avatar: profile.avatar } });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The saved profile for a key; empty if none. */
export function useProfile(key: string): Profile {
  const all = useSyncExternalStore(subscribe, load, () => NONE);
  return (key && all[key]) || EMPTY_PROFILE;
}

/** The avatar's card if you still hold it (not redeemed); otherwise null, so the initials show. */
export function avatarCard(avatar: ProfileAvatar | null, cards: OwnedCard[]) {
  if (!avatar) return null;
  return cards.find((c) => c.id === avatar.cardId && c.openedAt === avatar.openedAt && !c.redeemedAt) ?? null;
}
