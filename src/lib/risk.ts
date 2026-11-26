/*
 * The vault's risk check, shared by the server route and the pack page.
 *
 * The pool holds bStocks. Before risky packs keep selling, the vault asks Cournot how likely its biggest stock is to
 * fall by DROP_PCT. Cournot matches the question to live prediction markets; we pick a market whose price level sits
 * near that drop and read which way it points, so "bad" always means "the stock ends up below the level":
 *   - "hit (LOW) $330", "below $330", "less than $330"  -> bad if YES
 *   - "close above $340" with $340 under today's price  -> bad if NO
 * Cournot's probability of "bad" then decides what stays on sale (RISK_RULES). Low packs are self-funded, so they
 * always sell.
 */

/** The drop the vault guards against, as a share of today's price. */
export const DROP_PCT = 0.1;

/** At or above these chances of the drop, the tier pauses. */
export const RISK_RULES = { pauseHigh: 0.25, pauseMedium: 0.5 } as const;

/** Markets whose level is this far from the target drop (as a share of price) are too far off to use. */
const MAX_LEVEL_GAP = 0.08;

export type CournotMarket = {
  id: string;
  title: string;
  endTime: string | null;
  confidence: number;
};

export type MarketReading = { level: number; badIfYes: boolean };

/** Reads the dollar level and direction out of a market title. Market-cap or unclear titles return null. */
export function readMarket(title: string, price: number): MarketReading | null {
  const m = title.match(/\$\s?([\d,]+(?:\.\d+)?)\s*([KMBT])?\b/i);
  if (!m || m[2]) return null; // no level, or a market-cap style "$4.00T"
  const level = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(level) || level <= 0) return null;
  const t = title.toLowerCase();
  if (/\(low\)|\bbelow\b|\bless than\b|\bunder\b|\bdip\b|\bfall\b|\bdrop\b/.test(t)) return { level, badIfYes: true };
  if (/\babove\b|\bover\b|\bgreater than\b|\bat or above\b/.test(t)) {
    // "Above X" only says something about a drop when X is under today's price.
    return level < price ? { level, badIfYes: false } : null;
  }
  return null;
}

/** Picks the market closest to the guarded drop that hasn't ended yet, preferring sooner ones on ties. */
export function pickMarket(markets: CournotMarket[], price: number, now = Date.now()) {
  const target = price * (1 - DROP_PCT);
  const usable = markets
    .map((market) => ({ market, reading: readMarket(market.title, price) }))
    .filter((x): x is { market: CournotMarket; reading: MarketReading } => {
      if (!x.reading) return false;
      if (x.market.endTime && Date.parse(x.market.endTime) <= now) return false;
      return Math.abs(x.reading.level - target) / price <= MAX_LEVEL_GAP;
    })
    .sort((a, b) => {
      const gap = Math.abs(a.reading.level - target) - Math.abs(b.reading.level - target);
      if (Math.abs(gap) > price * 0.01) return gap;
      return (Date.parse(a.market.endTime ?? "") || Infinity) - (Date.parse(b.market.endTime ?? "") || Infinity);
    });
  return usable[0] ?? null;
}

export type RiskDecision = { mediumOpen: boolean; highOpen: boolean };

export const decide = (chanceOfDrop: number): RiskDecision => ({
  highOpen: chanceOfDrop < RISK_RULES.pauseHigh,
  mediumOpen: chanceOfDrop < RISK_RULES.pauseMedium,
});

/** What the pack page shows. Everything here came back from Cournot or Atlas; nothing is filled in. */
export type RiskCheck = {
  coin: string;
  stock: { ticker: string; name: string; price: number };
  /** The question sent to Cournot. */
  claim: string;
  market: { id: string; title: string; endTime: string | null };
  badIfYes: boolean;
  /** Cournot's probability for the market's YES outcome. */
  probabilityYes: number;
  /** Chance the stock ends up below the level: probabilityYes or 1 − probabilityYes. */
  chanceOfDrop: number;
  decision: RiskDecision;
  /** Cournot's returned assessment fields, as sent. */
  result: Record<string, unknown>;
  /** Cournot's returned evidence, as sent. */
  basis: unknown;
  billing: string | null;
  checkedAt: number;
};

/** "… at any time before 2026-11-02 04:59 UTC" → "… before November 2, 2026", as Cournot asks titles to be shown. */
export function displayTitle(title: string) {
  return title
    .replace(/\s*at any time\s*/gi, " ")
    .replace(/(\d{4})-(\d{2})-(\d{2}) \d{2}:\d{2} UTC/g, (_, y, mo, d) =>
      `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+mo - 1]} ${+d}, ${y}`)
    .replace(/\s{2,}/g, " ")
    .trim();
}
