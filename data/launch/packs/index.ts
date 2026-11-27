import type { SeedPack } from "@/lib/launch/market";
import moonVault from "./moon-vault.json";
import orbitClub from "./orbit-club.json";

/**
 * Coins that ship with the app: Orbit Club (live on our OpenFour testnet) and Moon Vault (launched through Flap on
 * BSC testnet); everything else on the marketplace is launched by people (saved in their browser until it's on-chain).
 */
export const SEED_PACKS = [moonVault, orbitClub] as SeedPack[];
