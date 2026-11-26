export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const usd = (v: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

export const amount = (v: number, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
