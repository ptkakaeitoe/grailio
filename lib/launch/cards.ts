import { stockOf } from "@/lib/launch/stocks";

/*
 * Card identities. The art follows the pack size and the rarity; the bStock a
 * card holds only sets its label, logo and stripe. Art: the Fable, Saga and Mythos sets, ordered Common →
 * Legendary, with no labels or frame (StockCardFront draws those).
 */

export type StockCard = {
  slug: string;
  /** bStock ticker the card holds (e.g. "TSLA"). */
  ticker: string;
  /** Card name from the art set. */
  name: string;
  /** Company or fund name of the stock. */
  tokenName: string;
  src: string;
  accent: string;
  number: string;
  /** Total in the series, shown after the number ("02 / 04"). */
  of: string;
};

export type ArtSet = "fable" | "saga" | "mythos";

const SETS: Record<ArtSet, { name: string; src: string }[]> = {
  fable: [
    { name: "Coal Worker", src: "/art/fable/coal-worker-wide-v2.jpg" },
    { name: "Flame Smith", src: "/art/fable/flame-smith-wide-v2.jpg" },
    { name: "Cinder Knight", src: "/art/fable/cinder-knight-wide-v2.jpg" },
    { name: "Ember King", src: "/art/fable/ember-king-wide-v2.jpg" },
  ],
  saga: [
    { name: "Deckhand", src: "/art/saga/deckhand-v1.jpg" },
    { name: "Raider", src: "/art/saga/raider-v1.jpg" },
    { name: "Captain", src: "/art/saga/captain-v1.jpg" },
    { name: "Pirate Lord", src: "/art/saga/pirate-lord-v1.jpg" },
  ],
  mythos: [
    { name: "Imp", src: "/art/mythos/imp-v1.jpg" },
    { name: "Gargoyle", src: "/art/mythos/gargoyle-v1.jpg" },
    { name: "Wyrm", src: "/art/mythos/wyrm-v1.jpg" },
    { name: "Ancient Dragon", src: "/art/mythos/ancient-dragon-v1.jpg" },
  ],
};

/** Each pack size opens one art set. */
export const SET_FOR_SIZE: Record<string, ArtSet> = { starter: "fable", standard: "saga", grail: "mythos" };

/** Pack cover art per set. */
export const PACK_COVER: Record<ArtSet, string> = {
  fable: "/art/packs/fable-cover-v1.jpg",
  saga: "/art/packs/saga-cover-v1.jpg",
  mythos: "/art/packs/mythos-cover-v1.jpg",
};

/** The card for a stock at a rarity (0 Common … 3 Legendary) from a set. */
export function cardArt(ticker: string, rarity: number, set: ArtSet = "fable"): StockCard {
  const stock = ticker ? stockOf(ticker) : undefined;
  const art = SETS[set][rarity] ?? SETS[set][0];
  return {
    slug: `${set}-${ticker.toLowerCase() || "any"}-r${rarity}`,
    ticker,
    tokenName: stock?.name ?? ticker,
    name: art.name,
    src: art.src,
    accent: stock?.accent ?? "#888",
    number: String(rarity + 1).padStart(2, "0"),
    of: "04",
  };
}
