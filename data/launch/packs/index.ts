import type { SeedPack } from "@/lib/launch/market";
import orbitClub from "./orbit-club.json";

/**
 * Coins that ship with the app. Only Orbit Club, which is live on our OpenFour testnet; everything else on the
 * marketplace is launched by people (saved in their browser until it's on-chain).
 */
export const SEED_PACKS = [orbitClub] as SeedPack[];
