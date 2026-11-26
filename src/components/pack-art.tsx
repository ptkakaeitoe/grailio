import type { CSSProperties, ReactNode } from "react";
import { RARITIES, RARITY_DOT, type CardArt, type PackConfig, type Pattern, type Rarity } from "@/lib/pack";
import { stockOf } from "@/lib/stocks";
import { cn, usd } from "@/lib/format";
import { logoFor } from "@/lib/atlas-feeds";

function sleeve(tone: string, pattern: Pattern, image: string | null): CSSProperties {
  const mix = `color-mix(in srgb, ${tone} 82%, white)`;
  if (image) return { background: `linear-gradient(180deg, transparent 45%, rgb(0 0 0 / .65)), url(${image}) center / cover, ${tone}` };
  switch (pattern) {
    case "stripes": return { background: `repeating-linear-gradient(135deg, ${tone} 0 14px, ${mix} 14px 28px)` };
    case "dots": return { background: `radial-gradient(circle, ${mix} 2.2px, transparent 2.8px) 0 0 / 16px 16px, ${tone}` };
    case "grid": return { background: `linear-gradient(${mix} 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, ${mix} 1px, transparent 1px) 0 0 / 18px 18px, ${tone}` };
    default: return { background: `linear-gradient(160deg, ${tone}, color-mix(in srgb, ${tone} 65%, black))` };
  }
}

/** Sealed pack, merger's foil sleeve made customizable: tone, pattern or uploaded cover, name and basket. */
export function PackArt({ c, className, shaking }: { c: Pick<PackConfig, "name" | "ticker" | "tagline" | "tone" | "pattern" | "image" | "basket">; className?: string; shaking?: boolean }) {
  return (
    <div
      className={cn("relative grid aspect-[3/4.4] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[14px] text-white shadow-[0_18px_30px_-18px_#000a] [container-type:inline-size]", shaking && "animate-[pack-shake_.12s_ease-in-out_infinite_alternate]", className)}
      style={sleeve(c.tone, c.pattern, c.image)}
    >
      <div className="flex h-[9cqw] items-center justify-between border-b border-dashed border-white/40 bg-black/15 px-[5cqw] font-mono text-[3.6cqw] tracking-[0.18em]">
        <span>${c.ticker || "TICKER"}</span>
        <span className="opacity-70">STOCK PACK</span>
      </div>
      <div className="grid place-items-center px-[7cqw] text-center">
        <div>
          <p className="display text-[13cqw] leading-[0.95] [overflow-wrap:anywhere]">{c.name || "Untitled"}</p>
          {c.tagline && <p className="mt-[3cqw] text-[4.6cqw] opacity-80">{c.tagline}</p>}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-[3cqw] gap-y-[1cqw] bg-black/20 px-[5cqw] py-[3.5cqw] font-mono text-[3.4cqw] tracking-[0.06em]">
        {c.basket.map((b) => <span key={b.ticker}>{b.ticker} {b.weight}%</span>)}
      </div>
      <div className="holo holo--rare opacity-60" />
    </div>
  );
}

/** Small seeded RNG so a card's art is the same every time it renders, but differs card to card. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generative card art in a 100×100 box, driven by the design's style and the card's serial. */
export function CardArtView({ art, color, seed }: { art: CardArt; color: string; seed: number }) {
  const r = rng(seed);
  const f = (n: number) => +n.toFixed(2);
  let body: ReactNode = null;

  if (art === "chart") {
    const pts: (readonly [number, number])[] = [];
    for (let i = 0, y = 70 - r() * 20; i < 13; i++) {
      y = Math.max(12, Math.min(88, y - 9 + r() * 14));
      pts.push([i * (100 / 12), y]);
    }
    const line = pts.map(([x, py]) => `${f(x)},${f(py)}`).join(" ");
    body = (
      <>
        <polygon points={`0,100 ${line} 100,100`} fill={color} opacity={0.18} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
        <circle cx={f(pts[12][0])} cy={f(pts[12][1])} r={3} fill={color} />
      </>
    );
  } else if (art === "rays") {
    const cx = 35 + r() * 30, cy = 35 + r() * 30, n = 12 + Math.floor(r() * 8), turn = r() * Math.PI;
    body = (
      <>
        {Array.from({ length: n }, (_, i) => {
          const a1 = turn + (i / n) * Math.PI * 2, a2 = a1 + Math.PI / n;
          return <polygon key={i} points={`${f(cx)},${f(cy)} ${f(cx + Math.cos(a1) * 120)},${f(cy + Math.sin(a1) * 120)} ${f(cx + Math.cos(a2) * 120)},${f(cy + Math.sin(a2) * 120)}`} fill={color} opacity={i % 2 ? 0.12 : 0.32} />;
        })}
        <circle cx={f(cx)} cy={f(cy)} r={9 + r() * 6} fill={color} />
      </>
    );
  } else if (art === "halftone") {
    const ox = r() * 100, oy = r() * 100;
    const dots: ReactNode[] = [];
    for (let x = 5; x < 100; x += 10) for (let y = 5; y < 100; y += 10) {
      const d = Math.hypot(x - ox, y - oy);
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={f(Math.max(0.6, 4.6 - d / 22))} fill={color} opacity={0.85} />);
    }
    body = <>{dots}</>;
  } else if (art === "waves") {
    body = (
      <>
        {Array.from({ length: 6 }, (_, i) => {
          const amp = 4 + r() * 9, phase = r() * Math.PI * 2, freq = 1.5 + r() * 2, base = 18 + i * 13;
          const d = Array.from({ length: 21 }, (_, k) => {
            const x = k * 5;
            return `${k ? "L" : "M"}${x},${f(base + Math.sin((x / 100) * Math.PI * 2 * freq + phase) * amp)}`;
          }).join(" ");
          return <path key={i} d={d} fill="none" stroke={color} strokeWidth={2.2} opacity={0.35 + i * 0.1} strokeLinecap="round" />;
        })}
      </>
    );
  } else {
    const horizon = 34 + r() * 16, vp = 30 + r() * 40;
    body = (
      <>
        <circle cx={f(vp)} cy={f(horizon - 6)} r={10 + r() * 8} fill={color} opacity={0.45} />
        <line x1={0} y1={f(horizon)} x2={100} y2={f(horizon)} stroke={color} strokeWidth={1.4} />
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={f(vp)} y1={f(horizon)} x2={-50 + i * 20} y2={100} stroke={color} strokeWidth={1} opacity={0.7} />)}
        {Array.from({ length: 6 }, (_, i) => {
          const y = horizon + (100 - horizon) * ((i + 1) / 6) ** 1.7;
          return <line key={`h${i}`} x1={0} y1={f(y)} x2={100} y2={f(y)} stroke={color} strokeWidth={1} opacity={0.7} />;
        })}
      </>
    );
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden
      style={{ filter: `hue-rotate(${f((r() - 0.5) * 36)}deg)` }}>
      {body}
    </svg>
  );
}

/**
 * The card inside a pack (stonks card front), with the creator's design for its rarity:
 * title and color on the masthead, generative or uploaded art, and a serial that varies the art per card.
 */
export function PackCard({ c, rarity, value, serial = 1, className }: { c: Pick<PackConfig, "name" | "basket" | "cards">; rarity: Rarity; value: number; serial?: number; className?: string }) {
  const ri = RARITIES.indexOf(rarity);
  const d = c.cards[ri];
  return (
    <div className={cn("tilt relative grid aspect-[2/3] grid-rows-[14%_65%_21%] overflow-hidden rounded-[6px] border border-[#181818] bg-white text-[#111] shadow-[0_10px_24px_-14px_#0007] [container-type:inline-size]", className)}>
      <div className="flex items-center justify-between px-[5cqw] text-white" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${d.color} 70%, #111), #111)` }}>
        <strong className="truncate text-[9cqw] leading-none font-extrabold tracking-[-0.05em] uppercase">{d.title || rarity}</strong>
        <span className="num shrink-0 pl-[2cqw] text-[5cqw]">{usd(value)}</span>
      </div>
      <div className="relative overflow-hidden border-b border-[#111]" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${d.color} 10%, #fafafa), color-mix(in srgb, ${d.color} 22%, #e9e9ec))` }}>
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL from the studio upload
          <img src={d.image} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <CardArtView art={d.art} color={d.color} seed={serial * 7919 + ri * 104729} />
        )}
        <div className="absolute inset-x-[5cqw] bottom-[4cqw] flex flex-col gap-[1.6cqw] rounded-[2cqw] bg-white/80 px-[3cqw] py-[2.5cqw] backdrop-blur-sm">
          {c.basket.map((b) => {
            const s = stockOf(b.ticker);
            return (
              <div key={b.ticker} className="flex items-center gap-[2cqw]">
                {logoFor(s.ticker) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local logo
                  <img src={logoFor(s.ticker)!} alt="" className="size-[4.6cqw] shrink-0 rounded-full" />
                ) : null}
                <span className="w-[13cqw] font-mono text-[4cqw] font-semibold">{s.ticker}</span>
                <span className="h-[3cqw] rounded-[1cqw]" style={{ width: `${b.weight * 0.5}cqw`, background: s.accent }} />
                <span className="num text-[3.6cqw] text-[#555]">{b.weight}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-[1.5cqw] px-[5cqw] uppercase" style={{ borderTop: `1.5cqw solid ${RARITY_DOT[rarity]}` }}>
        <strong className="truncate text-[8cqw] leading-[1.05] font-extrabold tracking-[-0.04em]">{c.name || "Untitled"}</strong>
        <span className="flex justify-between text-[4.2cqw] leading-none font-semibold tracking-[0.06em] text-[#666]">
          <span>{rarity}</span>
          <span className="num">No. {String(serial).padStart(4, "0")}</span>
        </span>
      </div>
      {rarity !== "common" && <div className={`holo holo--${rarity}`} />}
    </div>
  );
}
