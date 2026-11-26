import type { SeedPack } from "@/lib/market";
import chipRush from "./chip-rush.json";
import orbitClub from "./orbit-club.json";
import steadyStack from "./steady-stack.json";

/** Seed packs for the marketplace, each designed in Pack studio and exported with its config. */
export const SEED_PACKS = [chipRush, orbitClub, steadyStack] as SeedPack[];
