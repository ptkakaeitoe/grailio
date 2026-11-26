export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const usd = (v: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

export const amount = (v: number, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);

/** How long ago a Unix timestamp (seconds) was, from `now` (milliseconds): "5s ago", "3m ago", "2h ago". */
export const ago = (ts: number, now: number) => {
  const s = Math.max(0, Math.round(now / 1000 - ts));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};
