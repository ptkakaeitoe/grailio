/*
 * Generative coin art: each coin gets a deterministic emblem (no images, no network). The emblem family comes from
 * the coin's name when it says something obvious (Orbit → planet, Ember → flame, Coral → wave), otherwise from a hash,
 * so every coin keeps the same look everywhere: avatars, packs, cards.
 */

export type Emblem = "planet" | "flame" | "wave" | "crown" | "gem" | "moon" | "bolt" | "leaf" | "rocket" | "paw" | "star" | "eye";
export type Pattern = "dots" | "rings" | "stripes" | "grid";

const EMBLEMS: Emblem[] = ["planet", "flame", "wave", "crown", "gem", "moon", "bolt", "leaf", "rocket", "paw", "star", "eye"];
const PATTERNS: Pattern[] = ["dots", "rings", "stripes", "grid"];

/** Words that pick an emblem when they appear in the coin's name or ticker. */
const KEYWORDS: [RegExp, Emblem][] = [
  [/orbit|planet|space|galax|cosmo|astro|saturn|mars/, "planet"],
  [/ember|fire|flame|blaze|burn|inferno|sun|solar|heat|lava/, "flame"],
  [/wave|ocean|sea|coral|tide|surf|pirate|ship|sail|aqua/, "wave"],
  [/king|queen|crown|royal|prince|emper|lord/, "crown"],
  [/gem|diamond|crystal|jewel|ruby|emerald|gold|grail/, "gem"],
  [/moon|luna|night|dream|sleep|owl/, "moon"],
  [/bolt|thunder|volt|storm|zap|flash|spark/, "bolt"],
  [/leaf|forest|tree|green|frog|garden|bloom|flower/, "leaf"],
  [/rocket|launch|pump|jet|turbo/, "rocket"],
  [/dog|doge|cat|paw|pnut|squirrel|shib|inu|pup|kitty|bear|bull/, "paw"],
  [/star|nova|comet|lucky|shine/, "star"],
  [/eye|see|vision|watch|oracle/, "eye"],
];

/** FNV-1a: a small stable hash of the seed. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function coinArt(seed: string) {
  const s = seed.toLowerCase();
  const h = hashSeed(s || "coin");
  const emblem = KEYWORDS.find(([re]) => re.test(s))?.[1] ?? EMBLEMS[h % EMBLEMS.length];
  const pattern = PATTERNS[(h >>> 4) % PATTERNS.length];
  const tilt = ((h >>> 8) % 50) - 25; // degrees, for the pattern and the planet's ring
  return { emblem, pattern, tilt, h };
}

/** Mix a #rrggbb colour toward black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  const ch = (v: number) => Math.round(v + (target - v) * a).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** A tone from the seed for coins without one (e.g. a classic collection). */
export function seedTone(seed: string): string {
  const hue = hashSeed(seed.toLowerCase()) % 360;
  return `hsl(${hue} 45% 38%)`;
}
