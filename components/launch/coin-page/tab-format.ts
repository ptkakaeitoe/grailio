/** Formatting shared by the coin page tabs. */
export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 1 ? 4 : 2 })}`;
export const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: n < 0.01 ? 2 : 1 })}%`;

export function ago(at: number, now: number) {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
